import { PROXY_BASE_URL } from './constants.js';
import { getValidToken, refreshSession } from './auth.js';

async function fetchWithAuth(url, options = {}) {
  const token = await getValidToken();
  if (!token) throw new AuthError('No valid session');
  const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
  let res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    await refreshSession();
    const freshToken = await getValidToken();
    if (!freshToken) throw new AuthError('Session expired');
    headers['Authorization'] = `Bearer ${freshToken}`;
    res = await fetch(url, { ...options, headers });
  }
  return res;
}

export async function* streamChat(systemPrompt, messages, model, signal) {
  const body = JSON.stringify({ system: systemPrompt, messages, model });
  const res = await fetchWithAuth(`${PROXY_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  });
  if (res.status === 429) {
    const data = await res.json();
    throw new UsageLimitError(data.tier, data.used, data.limit, data.error);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat failed: ${res.status} ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta' && parsed.delta.text) {
          yield parsed.delta.text;
        }
      } catch {}
    }
  }
}

export async function transcribe(audioData, contentType = 'audio/webm', signal) {
  const formData = new FormData();
  const blob = audioData instanceof Blob ? audioData : new Blob([audioData], { type: contentType });
  const ext = contentType.includes('webm') ? 'webm' : 'wav';
  formData.append('file', blob, `audio.${ext}`);
  const res = await fetchWithAuth(`${PROXY_BASE_URL}/transcribe`, {
    method: 'POST',
    headers: { 'X-Audio-Content-Type': contentType },
    body: formData,
    signal,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Transcribe failed: ${res.status} ${text}`);
  }
  const json = await res.json();
  return json.text || '';
}

export async function synthesizeSpeech(text, voice, signal) {
  const res = await fetchWithAuth(`${PROXY_BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
    signal,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TTS failed: ${res.status} ${errText}`);
  }
  return await res.arrayBuffer();
}

export async function getUsage() {
  const res = await fetchWithAuth(`${PROXY_BASE_URL}/usage`, { method: 'POST' });
  if (!res.ok) throw new Error(`Usage check failed: ${res.status}`);
  return await res.json();
}

export class AuthError extends Error {
  constructor(message) { super(message); this.name = 'AuthError'; }
}

export class UsageLimitError extends Error {
  constructor(tier, used, limit, message) {
    super(message || `Limite do plano ${tier} atingido`);
    this.name = 'UsageLimitError';
    this.tier = tier;
    this.used = used;
    this.limit = limit;
  }
}
