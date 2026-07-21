/**
 * Tico Proxy — Cloudflare Worker (production)
 *
 * Routes (all require Authorization: Bearer <supabase-jwt>):
 *   POST /chat       → Claude Messages API (streaming SSE, counts as 1 use)
 *   POST /transcribe → OpenAI Whisper API (auth required, not metered)
 *   POST /tts        → ElevenLabs TTS API (auth required, not metered)
 *   POST /usage      → Supabase check_usage RPC
 *
 * Required secrets (set via `wrangler secret put`):
 *   ANTHROPIC_API_KEY           — Anthropic API key
 *   OPENAI_API_KEY              — OpenAI API key (for Whisper)
 *   ELEVENLABS_API_KEY          — ElevenLabs API key
 *   ELEVENLABS_VOICE_ID         — ElevenLabs voice ID
 *   SUPABASE_URL                — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Supabase service role key (server-side only)
 *
 * Security:
 *   - CORS restricted to tico.app origins (desktop app sends no Origin header)
 *   - Per-IP rate limiting (60 req/min) via in-memory sliding window
 *   - Voice ID validation (alphanumeric only)
 *   - Bearer JWT validated against Supabase on every request
 *   - Usage tier enforcement before Claude API calls
 */

// ─── Security constants ──────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  "https://ticoai.app",
  "https://www.ticoai.app",
]);

const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

// ─── Input validation constants ─────────────────────────────────────
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);
const MAX_TOKENS_MIN = 256;
const MAX_TOKENS_MAX = 8192;
const TTS_TEXT_MAX_LENGTH = 5000;
const ALLOWED_TTS_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

// ─── Entry point ─────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (request.method !== "POST") {
      return jsonError("Method not allowed", 405, cors);
    }

    // Rate limit by IP
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(ip)) {
      return jsonError("Too many requests", 429, cors);
    }

    const url = new URL(request.url);

    // All routes require auth
    const authResult = await requireAuth(request, env);
    if (authResult.error) {
      return jsonError(authResult.error, 401, cors);
    }
    const userId = authResult.userId;

    try {
      switch (url.pathname) {
        case "/chat":
          return await handleChat(request, env, userId, cors);
        case "/transcribe":
          return await handleTranscribe(request, env, userId, cors);
        case "/tts":
          return await handleTts(request, env, userId, cors);
        case "/usage":
          return await handleUsage(env, userId, cors);
        default:
          return jsonError("Not found", 404, cors);
      }
    } catch (err) {
      console.error("Worker error:", err);
      return jsonError(err.message || "Internal error", 500, cors);
    }
  },
};

// ─── Rate Limiting ───────────────────────────────────────────────────

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    return true;
  }

  entry.count++;

  // Prevent unbounded map growth
  if (rateLimitMap.size > 10000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.reset) rateLimitMap.delete(key);
    }
  }

  return entry.count <= RATE_LIMIT;
}

// ─── Auth ────────────────────────────────────────────────────────────

async function requireAuth(request, env) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { userId: null, error: "Missing Authorization: Bearer <token>" };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { userId: null, error: "Empty bearer token" };
  }

  try {
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
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

async function checkUsage(env, userId) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/check_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`check_usage RPC failed: ${response.status} ${text}`);
  }
  return await response.json();
}

async function incrementUsage(env, userId) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/increment_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`increment_usage RPC failed: ${response.status} ${text}`);
  }
}

// ─── /chat → Claude API (counts as 1 use) ────────────────────────────

async function handleChat(request, env, userId, cors) {
  const usage = await checkUsage(env, userId);
  if (!usage.allowed) {
    return new Response(
      JSON.stringify({
        error: `Limite do plano ${usage.tier} atingido (${usage.used}/${usage.limit}).`,
        tier: usage.tier,
        used: usage.used,
        limit: usage.limit,
      }),
      { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const body = await request.json();

  // Validate model
  const model = body.model || "claude-sonnet-4-6";
  if (!ALLOWED_MODELS.has(model)) {
    return jsonError(`Model not allowed: ${model}`, 400, cors);
  }

  // Clamp max_tokens
  const maxTokens = Math.max(MAX_TOKENS_MIN, Math.min(MAX_TOKENS_MAX, body.max_tokens || 1024));

  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "web-search-2025-03-05",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: body.system || "",
      messages: body.messages || [],
      stream: true,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        },
      ],
    }),
  });

  if (!anthropicResponse.ok) {
    const errText = await anthropicResponse.text();
    return new Response(errText, {
      status: anthropicResponse.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    await incrementUsage(env, userId);
  } catch (err) {
    console.error("increment_usage failed:", err.message);
  }

  return new Response(anthropicResponse.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

// ─── /transcribe → OpenAI Whisper (auth required, not metered) ──────

async function handleTranscribe(request, env, _userId, cors) {
  // .NET MultipartFormDataContent is incompatible with Cloudflare Workers' formData() parser.
  // Rebuild the multipart body from the raw bytes, appending the "model" field.
  const rawBody = await request.arrayBuffer();
  const contentType = request.headers.get("Content-Type") || "";
  const boundaryMatch = contentType.match(/boundary=("?)(.+?)\1(?:;|$)/);

  if (!boundaryMatch) {
    return jsonError("Missing multipart boundary", 400, cors);
  }
  const boundary = boundaryMatch[2];

  // Build a fresh multipart body with the audio and model field
  const freshBoundary = "----WhisperBoundary" + Date.now();
  const audioBytes = new Uint8Array(rawBody);

  // Extract the raw file bytes from between the first pair of boundaries
  const fileBytes = extractFileBytes(audioBytes, boundary);
  if (!fileBytes) {
    return jsonError("Could not extract audio from multipart body", 400, cors);
  }

  // Assemble a clean multipart body that OpenAI will accept
  const enc = new TextEncoder();
  // Detect audio format: prefer explicit header, fall back to multipart parsing
  const detectedType = request.headers.get('X-Audio-Content-Type')
    || extractPartHeaders(audioBytes, boundary)?.contentType
    || 'audio/wav';
  const ext = detectedType.includes('webm') ? 'webm' : detectedType.includes('mp4') ? 'mp4' : 'wav';

  const filePart = [
    `--${freshBoundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n`,
    `Content-Type: ${detectedType}\r\n\r\n`,
  ].join("");
  const modelPart = [
    `\r\n--${freshBoundary}\r\n`,
    `Content-Disposition: form-data; name="model"\r\n\r\n`,
    `whisper-1`,
    `\r\n--${freshBoundary}--\r\n`,
  ].join("");

  const filePartBytes = enc.encode(filePart);
  const modelPartBytes = enc.encode(modelPart);
  const body = new Uint8Array(filePartBytes.length + fileBytes.length + modelPartBytes.length);
  body.set(filePartBytes, 0);
  body.set(fileBytes, filePartBytes.length);
  body.set(modelPartBytes, filePartBytes.length + fileBytes.length);

  let whisperResponse;
  try {
    whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": `multipart/form-data; boundary=${freshBoundary}`,
      },
      body: body.buffer,
    });
  } catch (err) {
    console.error("Whisper fetch error:", err.message);
    return jsonError(`Whisper request failed: ${err.message}`, 502, cors);
  }

  if (!whisperResponse.ok) {
    const errText = await whisperResponse.text();
    console.error(`Whisper API error ${whisperResponse.status}: ${errText}`);
    return new Response(errText, {
      status: whisperResponse.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const result = await whisperResponse.json();
  return new Response(JSON.stringify({ text: result.text }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ─── /tts → OpenAI TTS (auth required, not metered) ─────────────────

async function handleTts(request, env, _userId, cors) {
  const body = await request.json();
  const text = (body.text || "").slice(0, TTS_TEXT_MAX_LENGTH);

  if (!text.trim()) {
    return new Response(new ArrayBuffer(0), {
      status: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg" },
    });
  }

  const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: ALLOWED_TTS_VOICES.has(body.voice) ? body.voice : "nova",
      response_format: "mp3",
    }),
  });

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    console.error(`OpenAI TTS error ${ttsResponse.status}: ${errText}`);
    return new Response(errText, {
      status: ttsResponse.status,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(ttsResponse.body, {
    status: 200,
    headers: { ...cors, "Content-Type": "audio/mpeg" },
  });
}

// ─── /usage → Real Supabase check_usage ─────────────────────────────

async function handleUsage(env, userId, cors) {
  const usage = await checkUsage(env, userId);
  return new Response(JSON.stringify(usage), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Audio-Content-Type",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.startsWith("chrome-extension://"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonError(message, status, cors) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ─── Multipart parser (extracts raw file bytes from first part) ─────

function extractFileBytes(data, boundary) {
  const enc = new TextEncoder();
  const delim = enc.encode("--" + boundary);

  // Find first boundary
  let pos = indexOf(data, delim, 0);
  if (pos < 0) return null;
  pos += delim.length;

  // Skip \r\n after boundary
  while (pos < data.length && (data[pos] === 0x0d || data[pos] === 0x0a)) pos++;

  // Find blank line separating headers from body (\r\n\r\n)
  const sep = enc.encode("\r\n\r\n");
  const headerEnd = indexOf(data, sep, pos);
  if (headerEnd < 0) return null;

  const bodyStart = headerEnd + 4;

  // Find next boundary
  const bodyEnd = indexOf(data, delim, bodyStart);
  if (bodyEnd < 0) return null;

  // Strip trailing \r\n before boundary
  let end = bodyEnd;
  if (end >= 2 && data[end - 2] === 0x0d && data[end - 1] === 0x0a) end -= 2;

  return data.slice(bodyStart, end);
}

function indexOf(haystack, needle, from) {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function extractPartHeaders(data, boundary) {
  const enc = new TextEncoder();
  const delim = enc.encode("--" + boundary);
  let pos = indexOf(data, delim, 0);
  if (pos < 0) return null;
  pos += delim.length;
  while (pos < data.length && (data[pos] === 0x0d || data[pos] === 0x0a)) pos++;

  const sep = enc.encode("\r\n\r\n");
  const headerEnd = indexOf(data, sep, pos);
  if (headerEnd < 0) return null;

  const headerBytes = data.slice(pos, headerEnd);
  const headerStr = new TextDecoder().decode(headerBytes).toLowerCase();
  const ctMatch = headerStr.match(/content-type:\s*([^\r\n;]+)/);
  return { contentType: ctMatch ? ctMatch[1].trim() : null };
}
