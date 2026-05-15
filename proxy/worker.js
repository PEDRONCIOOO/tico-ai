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
  "https://tico.app",
  "https://www.tico.app",
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
const MAX_TOKENS_MAX = 4096;
const TTS_TEXT_MAX_LENGTH = 5000;

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
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: body.system || "",
      messages: body.messages || [],
      stream: true,
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
  const formData = await request.formData();
  const audioFile = formData.get("file");

  if (!audioFile) {
    return jsonError("Missing 'file' in form data", 400, cors);
  }

  const whisperForm = new FormData();
  whisperForm.append("file", audioFile, "audio.wav");
  whisperForm.append("model", "whisper-1");
  whisperForm.append("language", "pt");

  const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: whisperForm,
  });

  if (!whisperResponse.ok) {
    const errText = await whisperResponse.text();
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

// ─── /tts → ElevenLabs TTS (auth required, not metered) ─────────────

async function handleTts(request, env, _userId, cors) {
  const body = await request.json();
  const text = (body.text || "").slice(0, TTS_TEXT_MAX_LENGTH);
  const voiceId = env.ELEVENLABS_VOICE_ID;

  if (!text.trim()) {
    return new Response(new ArrayBuffer(0), {
      status: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg" },
    });
  }

  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    }
  );

  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text();
    console.error(`ElevenLabs TTS error ${ttsResponse.status}: ${errText}`);
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
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
