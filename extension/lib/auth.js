import { SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN_REFRESH_SKEW_SECONDS } from './constants.js';

const STORAGE_KEY = 'tico_session';

export async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error_description || err.msg || 'Login failed');
  }
  const data = await res.json();
  const session = parseSession(data);
  await saveSession(session);
  return session;
}

export async function refreshSession() {
  const session = await loadSession();
  if (!session) throw new Error('No session to refresh');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refreshToken }),
  });
  if (!res.ok) {
    await clearSession();
    throw new Error('Session expired — please login again');
  }
  const data = await res.json();
  const newSession = parseSession(data);
  await saveSession(newSession);
  return newSession;
}

export async function getValidToken() {
  const session = await loadSession();
  if (!session) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expiresAt > nowSec + TOKEN_REFRESH_SKEW_SECONDS) return session.accessToken;
  try {
    const refreshed = await refreshSession();
    return refreshed.accessToken;
  } catch { return null; }
}

export async function logout() {
  const session = await loadSession();
  if (session) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.accessToken}`, 'apikey': SUPABASE_ANON_KEY },
      });
    } catch {}
  }
  await clearSession();
}

export async function loadSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

async function saveSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

function parseSession(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
    userId: data.user?.id || '',
    email: data.user?.email || '',
  };
}
