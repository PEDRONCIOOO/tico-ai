/**
 * Tico Local Dev Proxy
 * Routes (all require Authorization: Bearer <supabase-jwt>):
 *   POST /chat       → Claude API (real, counts as 1 use)
 *   POST /transcribe → OpenAI Whisper (real, no usage increment)
 *   POST /tts        → ElevenLabs TTS (auth required, not metered)
 *   POST /usage      → Returns current usage from Supabase RPC check_usage
 */

require("dotenv").config();
const http = require("http");
const nodeFetch = require("node-fetch");

// Override global fetch with node-fetch (fixes Node 24 strict header validation)
global.fetch = nodeFetch;
global.Headers = nodeFetch.Headers;
global.Request = nodeFetch.Request;
global.Response = nodeFetch.Response;

const FormData = require("form-data");

const PORT = 3000;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// ElevenLabs keys no longer needed — TTS migrated to OpenAI
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const required = { ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY };
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error("❌ Missing required environment variables:");
  for (const name of missing) console.error("   " + name);
  process.exit(1);
}

// ─── Input validation constants ─────────────────────────────────────
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
const MAX_TOKENS_MIN = 256;
const MAX_TOKENS_MAX = 4096;
const TTS_TEXT_MAX_LENGTH = 5000;

// ─── Rate limiting (in-memory, per-IP) ──────────────────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.reset) rateLimitMap.delete(key);
    }
  }
  return entry.count <= RATE_LIMIT;
}

const server = http.createServer(async (req, res) => {
  // CORS — restrict to localhost origins (dev only)
  const origin = req.headers["origin"];
  if (!origin || origin.startsWith("http://localhost")) {
    res.setHeader("Access-Control-Allow-Origin", origin || "http://localhost:3000");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== "POST") {
    return jsonError(res, 405, "Method not allowed");
  }

  // Rate limit by IP
  const ip = req.socket.remoteAddress || "unknown";
  if (!checkRateLimit(ip)) {
    return jsonError(res, 429, "Too many requests");
  }

  try {
    // All routes require auth
    const authResult = await requireAuth(req);
    if (authResult.error) {
      return jsonError(res, 401, authResult.error);
    }
    const userId = authResult.userId;

    switch (req.url) {
      case "/chat":
        return await handleChat(req, res, userId);
      case "/transcribe":
        return await handleTranscribe(req, res, userId);
      case "/tts":
        return await handleTts(req, res, userId);
      case "/usage":
        return await handleUsage(res, userId);
      default:
        return jsonError(res, 404, "Not found");
    }
  } catch (err) {
    console.error("Error:", err.message);
    jsonError(res, 500, err.message);
  }
});

// ─── Auth ────────────────────────────────────────────────────────────

/**
 * Validates the Authorization header by calling Supabase /auth/v1/user.
 * Returns { userId, error }. If error is set, the request should be rejected.
 */
async function requireAuth(req) {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { userId: null, error: "Missing Authorization: Bearer <token>" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { userId: null, error: "Empty bearer token" };
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      return { userId: null, error: "Invalid or expired session" };
    }
    const user = await response.json();
    if (!user.id) {
      return { userId: null, error: "Auth response missing user id" };
    }
    return { userId: user.id, error: null };
  } catch (err) {
    return { userId: null, error: `Auth check failed: ${err.message}` };
  }
}

// ─── Usage (Supabase RPCs) ────────────────────────────────────────────

async function checkUsage(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/check_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`check_usage RPC failed: ${response.status} ${text}`);
  }
  return await response.json();
}

async function incrementUsage(userId) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`increment_usage RPC failed: ${response.status} ${text}`);
  }
}

// ─── /chat → Claude API (counts as 1 use) ────────────────────────────

async function handleChat(req, res, userId) {
  // Enforce usage limit before proxying
  const usage = await checkUsage(userId);
  if (!usage.allowed) {
    console.log(`🚫 /chat blocked for ${userId.slice(0, 8)} — ${usage.used}/${usage.limit} (${usage.tier})`);
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: `Limite do plano ${usage.tier} atingido (${usage.used}/${usage.limit}).`,
      tier: usage.tier,
      used: usage.used,
      limit: usage.limit,
    }));
    return;
  }

  const body = await readBody(req);
  const parsed = JSON.parse(body);

  // Validate model
  const model = parsed.model || "claude-sonnet-4-6";
  if (!ALLOWED_MODELS.has(model)) {
    return jsonError(res, 400, `Model not allowed: ${model}`);
  }

  // Clamp max_tokens
  const maxTokens = Math.max(MAX_TOKENS_MIN, Math.min(MAX_TOKENS_MAX, parsed.max_tokens || 1024));

  console.log(`📡 /chat → Claude (user=${userId.slice(0, 8)}, ${usage.used}/${usage.limit} ${usage.tier})`);
  console.log("   Model:", model);
  console.log("   Messages:", parsed.messages?.length || 0);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: parsed.system || "",
      messages: parsed.messages || [],
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("   ❌ Claude error:", response.status, errText);
    res.writeHead(response.status, { "Content-Type": "application/json" });
    res.end(errText);
    return;
  }

  // Increment usage now that Claude accepted the request.
  // We do this before streaming so a disconnect mid-stream still counts.
  try {
    await incrementUsage(userId);
  } catch (err) {
    console.error("   ⚠️  increment_usage failed:", err.message);
    // Don't fail the request — let the user have their response.
  }

  console.log("   ✅ Streaming response...");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  response.body.on("data", (chunk) => res.write(chunk));
  response.body.on("end", () => {
    res.end();
    console.log("   ✅ Response complete");
  });
  response.body.on("error", (e) => {
    console.error("   Stream error:", e.message);
    res.end();
  });
}

// ─── /transcribe → OpenAI Whisper (auth required, not metered) ──────

async function handleTranscribe(req, res, userId) {
  const rawBody = await readBodyRaw(req);

  console.log(`🎤 /transcribe → Whisper (user=${userId.slice(0, 8)}, ${(rawBody.length / 1024).toFixed(1)} KB)`);

  // Parse multipart to extract audio file
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(.+)/);

  let audioBuffer = rawBody;

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawBody.toString("binary").split("--" + boundary);
    for (const part of parts) {
      if (part.includes("filename=")) {
        const headerEnd = part.indexOf("\r\n\r\n");
        if (headerEnd !== -1) {
          const bodyStr = part.substring(headerEnd + 4);
          const cleanBody = bodyStr.endsWith("\r\n") ? bodyStr.slice(0, -2) : bodyStr;
          audioBuffer = Buffer.from(cleanBody, "binary");
        }
      }
    }
  }

  try {
    const { execSync } = require("child_process");
    const fs = require("fs");
    const os = require("os");
    const path = require("path");

    const tmpFile = path.join(os.tmpdir(), `tico_${Date.now()}.wav`);
    fs.writeFileSync(tmpFile, audioBuffer);

    const curlResult = execSync(
      `curl -s -X POST "https://api.openai.com/v1/audio/transcriptions" ` +
      `-H "Authorization: Bearer ${OPENAI_API_KEY.trim()}" ` +
      `-F "file=@${tmpFile}" ` +
      `-F "model=whisper-1"`,
      { encoding: "utf-8", timeout: 30000 }
    );

    try { fs.unlinkSync(tmpFile); } catch {}

    const result = JSON.parse(curlResult);
    console.log("   ✅ Transcribed:", result.text || result.error?.message || "(empty)");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ text: result.text }));
  } catch (err) {
    console.error("   ❌ Whisper error:", err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ─── /tts → OpenAI TTS (auth required, not metered) ─────────────────

async function handleTts(req, res, userId) {
  const body = await readBody(req);
  const parsed = JSON.parse(body);
  const text = (parsed.text || "").slice(0, TTS_TEXT_MAX_LENGTH);

  console.log(`🔊 /tts → OpenAI TTS (user=${userId.slice(0, 8)})`);
  console.log("   Text:", text.substring(0, 80) + (text.length > 80 ? "..." : ""));

  if (!text.trim()) {
    res.writeHead(200, { "Content-Type": "audio/mpeg" });
    res.end(Buffer.alloc(0));
    return;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: text,
        voice: "nova",
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`   ❌ OpenAI TTS error ${response.status}: ${errText}`);
      res.writeHead(200, { "Content-Type": "audio/mpeg" });
      res.end(Buffer.alloc(0));
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    console.log("   ✅ Audio generated:", (audioBuffer.length / 1024).toFixed(1), "KB");
    res.writeHead(200, { "Content-Type": "audio/mpeg" });
    res.end(audioBuffer);
  } catch (err) {
    console.error("   ❌ TTS error:", err.message);
    res.writeHead(200, { "Content-Type": "audio/mpeg" });
    res.end(Buffer.alloc(0));
  }
}

// ─── /usage → Real Supabase check_usage ─────────────────────────────

async function handleUsage(res, userId) {
  try {
    const usage = await checkUsage(userId);
    console.log(`📊 /usage → ${usage.used}/${usage.limit} ${usage.tier} (user=${userId.slice(0, 8)})`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(usage));
  } catch (err) {
    console.error("   ❌ check_usage failed:", err.message);
    jsonError(res, 500, err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function jsonError(res, status, message) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

function readBodyRaw(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

// ─── Start ───────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log("");
  console.log("🟣 Tico Local Proxy");
  console.log(`   http://localhost:${PORT}`);
  console.log("");
  console.log("   /chat       → Claude API (counts as 1 use)");
  console.log("   /transcribe → OpenAI Whisper");
  console.log("   /tts        → ElevenLabs TTS");
  console.log("   /usage      → Supabase check_usage RPC");
  console.log("");
  console.log("   All routes require Authorization: Bearer <supabase-jwt>");
  console.log("   Ready! Press Ctrl+C to stop.");
  console.log("");
});
