# TicoAI Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension version of Tico that lets users talk to an AI assistant while browsing, capturing the current tab as visual context, with the same buddy overlay, voice pipeline, and backend as the desktop app.

**Architecture:** Manifest V3 extension with a background service worker (orchestrator), offscreen document (audio capture + TTS playback), content script (buddy overlay with spring physics + pointing), popup (login), and side panel (chat history + settings). All API calls go through the existing Cloudflare Worker proxy (`api.ticoai.app`) — no new backend needed. Auth via raw Supabase HTTP (same flow as desktop app).

**Tech Stack:** Manifest V3, vanilla JS (ES modules), Chrome APIs (commands, tabs, offscreen, sidePanel, storage), Shadow DOM for content script isolation

---

## File Structure

```
extension/
├── manifest.json                  # Extension manifest (Manifest V3)
├── background/
│   └── service-worker.js          # Main orchestrator — pipeline, state, message routing
├── offscreen/
│   ├── offscreen.html             # Minimal HTML shell for offscreen document
│   └── offscreen.js               # Audio capture (getUserMedia) + TTS playback (Audio)
├── content/
│   └── buddy.js                   # Buddy overlay — shadow DOM, spring physics, animations, pointing
├── popup/
│   ├── popup.html                 # Login form / logged-in status
│   ├── popup.js                   # Auth flow (login, logout, status check)
│   └── popup.css                  # Popup styles
├── sidepanel/
│   ├── sidepanel.html             # Chat history list + settings
│   ├── sidepanel.js               # Renders history, handles settings changes
│   └── sidepanel.css              # Side panel styles
├── lib/
│   ├── constants.js               # URLs, keys, default settings
│   ├── auth.js                    # Supabase auth (login, refresh, logout, token management)
│   ├── proxy-client.js            # API wrapper (chat SSE, transcribe, tts, usage)
│   └── conversation.js            # Rolling message buffer (max 10, image stripping)
└── icons/
    ├── tico-16.png                # Toolbar icon
    ├── tico-32.png                # Toolbar icon 2x
    ├── tico-48.png                # Extension management page
    └── tico-128.png               # Chrome Web Store / install dialog
```

**Backend changes (existing files):**
- Modify: `proxy/worker.js` — add extension origin to CORS, make `/transcribe` format-agnostic

---

### Task 1: Project Scaffold

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/background/service-worker.js` (stub)
- Create: `extension/offscreen/offscreen.html`
- Create: `extension/offscreen/offscreen.js` (stub)
- Create: `extension/content/buddy.js` (stub)
- Create: `extension/popup/popup.html`
- Create: `extension/popup/popup.js` (stub)
- Create: `extension/popup/popup.css`
- Create: `extension/sidepanel/sidepanel.html`
- Create: `extension/sidepanel/sidepanel.js` (stub)
- Create: `extension/sidepanel/sidepanel.css`
- Create: `extension/icons/` (placeholder PNGs)

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "TicoAI",
  "version": "1.0.0",
  "description": "Your AI browsing companion. Talk to Tico while browsing — it sees your tab, answers by voice, and points at what matters.",
  "icons": {
    "16": "icons/tico-16.png",
    "32": "icons/tico-32.png",
    "48": "icons/tico-48.png",
    "128": "icons/tico-128.png"
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/buddy.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/tico-16.png",
      "32": "icons/tico-32.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "commands": {
    "toggle-recording": {
      "suggested_key": {
        "default": "Alt+T",
        "mac": "Alt+T"
      },
      "description": "Start or stop voice recording"
    }
  },
  "permissions": [
    "activeTab",
    "storage",
    "offscreen",
    "sidePanel",
    "tabs"
  ],
  "host_permissions": [
    "https://api.ticoai.app/*",
    "https://tzpwebrpnqqygzpqxznb.supabase.co/*"
  ]
}
```

- [ ] **Step 2: Create stub files**

`extension/background/service-worker.js`:
```javascript
// TicoAI Chrome Extension — Service Worker
// Orchestrates the voice pipeline: hotkey → capture → transcribe → Claude → TTS → buddy
console.log('[Tico] Service worker loaded');
```

`extension/offscreen/offscreen.html`:
```html
<!DOCTYPE html>
<script type="module" src="offscreen.js"></script>
```

`extension/offscreen/offscreen.js`:
```javascript
// Handles audio capture (getUserMedia) and TTS playback (Audio element)
console.log('[Tico] Offscreen document loaded');
```

`extension/content/buddy.js`:
```javascript
// Buddy overlay — injected into every page via content script
console.log('[Tico] Buddy content script loaded');
```

`extension/popup/popup.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

`extension/popup/popup.js`:
```javascript
console.log('[Tico] Popup loaded');
```

`extension/popup/popup.css`:
```css
body { width: 320px; min-height: 200px; margin: 0; font-family: system-ui, sans-serif; }
```

`extension/sidepanel/sidepanel.html`:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="sidepanel.js"></script>
</body>
</html>
```

`extension/sidepanel/sidepanel.js`:
```javascript
console.log('[Tico] Side panel loaded');
```

`extension/sidepanel/sidepanel.css`:
```css
body { margin: 0; font-family: system-ui, sans-serif; background: #0f0a1a; color: #e2e0e7; }
```

- [ ] **Step 3: Create placeholder icons**

Generate simple purple circle icons at 16, 32, 48, and 128px. For now, create 1x1 purple PNGs as placeholders (replace with real icons later).

```bash
cd extension/icons
# Use any method to create placeholder PNGs — these will be replaced with real icons
# For now, the extension will load without icons (Chrome shows a default)
```

- [ ] **Step 4: Verify extension loads in Chrome**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select `extension/` folder
4. Expected: Extension appears in toolbar, no errors in service worker console

- [ ] **Step 5: Commit**

```bash
git add extension/
git commit -m "feat(extension): scaffold Chrome extension with Manifest V3"
```

---

### Task 2: Constants & Configuration

**Files:**
- Create: `extension/lib/constants.js`

- [ ] **Step 1: Create constants module**

```javascript
// extension/lib/constants.js
export const PROXY_BASE_URL = 'https://api.ticoai.app';
export const SUPABASE_URL = 'https://tzpwebrpnqqygzpqxznb.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6cHdlYnJwbnFxeWd6cHF4em5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MDgyMDUsImV4cCI6MjA5MTI4NDIwNX0.R4g4NTGy-B22V6cl1D8853uL06GD_fXNRGjEekXqgL0';
export const WEB_BASE_URL = 'https://ticoai.app';

export const DEFAULT_SETTINGS = {
  ttsVoice: 'nova',
  claudeModel: 'claude-sonnet-4-6',
  chatHistoryEnabled: true,
  iconStyle: 'default',
};

export const MAX_CONVERSATION_MESSAGES = 10;
export const MAX_CHAT_HISTORY_ENTRIES = 50;
export const MAX_RECORDING_SECONDS = 60;
export const TOKEN_REFRESH_SKEW_SECONDS = 30;

export const SYSTEM_PROMPT = `you are tico, a friendly companion that lives in the user's browser.
the user just spoke to you via push-to-talk and you can see their current browser tab.
your response will be spoken aloud via text-to-speech, so write the way you would speak.
this is an ongoing conversation — you remember everything they said before.

CRITICAL language rule: detect the language of the user's message and ALWAYS respond in that same language. if they speak portuguese, respond in portuguese. if they speak english, respond in english. if they speak spanish, respond in spanish. match their language exactly. your personality stays the same in every language.

web search: you have access to web search. use it automatically when the user asks about current events, weather, news, prices, live data, or anything that requires up-to-date information. don't say you can't access the internet — you can. just search and answer naturally.

IMPORTANT: also use web search when you need to identify something on screen and you're not fully confident — a website, a product, a logo, anything visual. describe what you see and search for it. never guess repeatedly — if you're not sure, search immediately. one confident verified answer is always better than multiple guesses.

rules:
- by default, one or two sentences. be direct and dense. BUT if the user asks you to explain more, elaborate, or go deeper, go deep — give a complete and detailed explanation with no size limit.
- all lowercase, casual, friendly. no emojis.
- write for the ear, not the eye. short sentences. no lists, bullet points, markdown, or formatting — just natural speech.
- don't use abbreviations or symbols that sound weird read aloud. write "for example" not "e.g.", spell out small numbers.
- if the user's question relates to what's on the tab, reference specific things you see.
- if the screenshot doesn't seem relevant to the question, just answer the question directly.
- you can help with anything — code, writing, general knowledge, brainstorming.
- never say "simply" or "just".
- don't read code literally. describe what the code does or what needs to change conversationally.
- focus on giving a useful and complete explanation. don't end with simple yes/no questions like "want me to explain more?" — those are dead ends.
- instead, when it makes sense, end by planting a seed — mention something bigger or more ambitious they could try, a related concept that goes deeper, or a next-level technique.
- never chain multiple guesses in a single response. if you don't know something, search for it. if you can't search, say you're not sure.

element pointing:
you have a small companion cursor that can fly to and point at things on the page.
always point to where the user should click or look while you explain. if you're telling them to click something, open a menu, press a button, or navigate anywhere in the interface — point to it.

the default is to point. only use [POINT:none] when the conversation has absolutely nothing to do with the screen.

the screenshot shows the visible portion of the browser tab. its pixel dimensions are included as a label.
coordinates are in screenshot pixel space: origin (0,0) is the top-left corner of the visible area.
x increases to the right, y increases downward.

pointing format:
- [POINT:x,y:label] where x,y are pixels in the screenshot space and label is a short description.
- [POINT:none] if pointing wouldn't help.

place the coordinate tag at the end of the response, AFTER the spoken text.

examples:
- user asks where the search bar is: "the search bar is right up there in the header. [POINT:640,52:search bar]"
- user asks what html is: "html is hypertext markup language, basically the skeleton of every web page. [POINT:none]"`;
```

- [ ] **Step 2: Commit**

```bash
git add extension/lib/constants.js
git commit -m "feat(extension): add constants and configuration module"
```

---

### Task 3: Auth Module

**Files:**
- Create: `extension/lib/auth.js`

This module handles Supabase authentication via raw HTTP calls (same pattern as the desktop app's `AuthService.cs` + `SessionManager.cs`). Tokens are stored in `chrome.storage.local`.

- [ ] **Step 1: Create auth module**

```javascript
// extension/lib/auth.js
import { SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN_REFRESH_SKEW_SECONDS } from './constants.js';

const STORAGE_KEY = 'tico_session';

/**
 * @typedef {{ accessToken: string, refreshToken: string, expiresAt: number, userId: string, email: string }} Session
 */

/** Login with email + password. Returns Session or throws. */
export async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err.error_description || err.msg || 'Login failed';
    throw new Error(msg);
  }

  const data = await res.json();
  const session = parseSession(data);
  await saveSession(session);
  return session;
}

/** Refresh the access token using the stored refresh token. */
export async function refreshSession() {
  const session = await loadSession();
  if (!session) throw new Error('No session to refresh');

  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
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

/** Get a valid access token, refreshing if needed. Returns null if no session. */
export async function getValidToken() {
  const session = await loadSession();
  if (!session) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (session.expiresAt > nowSec + TOKEN_REFRESH_SKEW_SECONDS) {
    return session.accessToken;
  }

  try {
    const refreshed = await refreshSession();
    return refreshed.accessToken;
  } catch {
    return null;
  }
}

/** Logout — invalidate on server + clear local. */
export async function logout() {
  const session = await loadSession();
  if (session) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'apikey': SUPABASE_ANON_KEY,
        },
      });
    } catch { /* ignore server errors on logout */ }
  }
  await clearSession();
}

/** Load session from chrome.storage.local. */
export async function loadSession() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || null;
}

/** Save session to chrome.storage.local. */
async function saveSession(session) {
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

/** Clear stored session. */
export async function clearSession() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

/** Parse Supabase auth response into our Session shape. */
function parseSession(data) {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at || (Math.floor(Date.now() / 1000) + (data.expires_in || 3600)),
    userId: data.user?.id || '',
    email: data.user?.email || '',
  };
}
```

- [ ] **Step 2: Verify module imports correctly**

Add a temporary import in `service-worker.js`:

```javascript
import { loadSession } from '../lib/auth.js';
loadSession().then(s => console.log('[Tico] Session:', s ? 'found' : 'none'));
```

Reload extension → check service worker console. Expected: `[Tico] Session: none`

- [ ] **Step 3: Commit**

```bash
git add extension/lib/auth.js
git commit -m "feat(extension): add Supabase auth module (login, refresh, token management)"
```

---

### Task 4: Popup UI (Login / Status)

**Files:**
- Modify: `extension/popup/popup.html`
- Modify: `extension/popup/popup.js`
- Modify: `extension/popup/popup.css`

- [ ] **Step 1: Build popup HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <!-- Login form (shown when logged out) -->
    <div id="login-view" style="display: none;">
      <div class="logo">tico</div>
      <form id="login-form">
        <input type="email" id="email" placeholder="email" required autocomplete="email">
        <input type="password" id="password" placeholder="password" required autocomplete="current-password">
        <button type="submit" id="login-btn">entrar</button>
        <div id="error" class="error"></div>
      </form>
      <a id="register-link" class="link" target="_blank">criar conta</a>
    </div>

    <!-- Status (shown when logged in) -->
    <div id="status-view" style="display: none;">
      <div class="logo">tico</div>
      <div class="user-info">
        <span id="user-email"></span>
        <span id="user-tier" class="tier-badge"></span>
      </div>
      <div class="usage-info">
        <span id="usage-text"></span>
      </div>
      <div class="shortcut-info">
        press <kbd>Alt+T</kbd> to talk
      </div>
      <button id="logout-btn" class="btn-secondary">sair</button>
    </div>

    <!-- Loading -->
    <div id="loading-view">
      <div class="logo">tico</div>
      <div class="spinner"></div>
    </div>
  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Build popup JS**

```javascript
// extension/popup/popup.js
import { login, logout, loadSession, getValidToken } from '../lib/auth.js';
import { WEB_BASE_URL, PROXY_BASE_URL } from '../lib/constants.js';

const $ = (sel) => document.querySelector(sel);

async function init() {
  $('#register-link').href = `${WEB_BASE_URL}/register`;

  const session = await loadSession();
  if (session && await getValidToken()) {
    await showStatus(session);
  } else {
    showLogin();
  }
}

function showLogin() {
  $('#loading-view').style.display = 'none';
  $('#status-view').style.display = 'none';
  $('#login-view').style.display = 'flex';
}

async function showStatus(session) {
  $('#loading-view').style.display = 'none';
  $('#login-view').style.display = 'none';
  $('#status-view').style.display = 'flex';

  $('#user-email').textContent = session.email;
  $('#user-tier').textContent = session.userId ? 'loading...' : '';

  // Fetch usage
  try {
    const token = await getValidToken();
    const res = await fetch(`${PROXY_BASE_URL}/usage`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const usage = await res.json();
      $('#user-tier').textContent = usage.tier;
      $('#user-tier').className = `tier-badge tier-${usage.tier}`;
      if (usage.tier === 'unlimited') {
        $('#usage-text').textContent = 'unlimited uses';
      } else {
        $('#usage-text').textContent = `${usage.used}/${usage.limit} uses`;
      }
    }
  } catch { /* ignore usage fetch errors */ }
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#login-btn');
  const error = $('#error');
  error.textContent = '';
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const session = await login($('#email').value, $('#password').value);
    // Notify service worker that we logged in
    chrome.runtime.sendMessage({ type: 'auth-changed' });
    await showStatus(session);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'entrar';
  }
});

$('#logout-btn').addEventListener('click', async () => {
  await logout();
  chrome.runtime.sendMessage({ type: 'auth-changed' });
  showLogin();
});

init();
```

- [ ] **Step 3: Build popup CSS**

```css
/* extension/popup/popup.css */
body {
  width: 300px;
  min-height: 180px;
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f0a1a;
  color: #e2e0e7;
}

#app {
  padding: 20px;
}

#login-view, #status-view, #loading-view {
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.logo {
  font-size: 28px;
  font-weight: 700;
  color: #a855f7;
  letter-spacing: -1px;
}

input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #2d2640;
  border-radius: 8px;
  background: #1a1428;
  color: #e2e0e7;
  font-size: 14px;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: #7c3aed;
}

button {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #7c3aed;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

button:hover { background: #6d28d9; }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: transparent;
  border: 1px solid #2d2640;
  color: #9f8fc0;
}

.btn-secondary:hover { border-color: #7c3aed; color: #a855f7; }

.error { color: #ef4444; font-size: 12px; text-align: center; min-height: 16px; }

.link {
  color: #9f8fc0;
  font-size: 12px;
  text-decoration: none;
}

.link:hover { color: #a855f7; }

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.tier-badge {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.tier-free { background: #1e1b2e; color: #9f8fc0; }
.tier-pro { background: #2d1a4e; color: #a855f7; }
.tier-unlimited { background: #1a2e1e; color: #10b981; }

.usage-info { font-size: 12px; color: #9f8fc0; }

.shortcut-info {
  font-size: 12px;
  color: #6b5f80;
  padding: 8px 12px;
  background: #1a1428;
  border-radius: 6px;
}

kbd {
  background: #2d2640;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
  color: #a855f7;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #2d2640;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
```

- [ ] **Step 4: Verify popup**

Reload extension → click extension icon. Expected: login form appears with purple "tico" header, email/password fields, and "entrar" button.

- [ ] **Step 5: Commit**

```bash
git add extension/popup/
git commit -m "feat(extension): add login popup with Supabase auth"
```

---

### Task 5: Proxy Client

**Files:**
- Create: `extension/lib/proxy-client.js`

Wraps all proxy API calls. Mirrors the desktop `ProxyClient.cs` — auth injection, 401 retry, SSE stream parsing, usage limit detection.

- [ ] **Step 1: Create proxy client**

```javascript
// extension/lib/proxy-client.js
import { PROXY_BASE_URL } from './constants.js';
import { getValidToken, refreshSession } from './auth.js';

/**
 * Send a request with Bearer auth. On 401, refresh once and retry.
 */
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

/**
 * Stream chat response from Claude via proxy. Yields text tokens.
 * @param {string} systemPrompt
 * @param {Array} messages - [{role, content}] in Anthropic format
 * @param {string} model
 * @param {AbortSignal} [signal]
 */
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
        if (parsed.type === 'content_block_delta' &&
            parsed.delta?.type === 'text_delta' &&
            parsed.delta.text) {
          yield parsed.delta.text;
        }
      } catch { /* skip malformed SSE */ }
    }
  }
}

/**
 * Transcribe audio to text via Whisper.
 * @param {Blob|ArrayBuffer} audioData
 * @param {string} contentType - e.g. 'audio/webm' or 'audio/wav'
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
export async function transcribe(audioData, contentType = 'audio/webm', signal) {
  const formData = new FormData();
  const blob = audioData instanceof Blob ? audioData : new Blob([audioData], { type: contentType });
  const ext = contentType.includes('webm') ? 'webm' : 'wav';
  formData.append('file', blob, `audio.${ext}`);

  const res = await fetchWithAuth(`${PROXY_BASE_URL}/transcribe`, {
    method: 'POST',
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

/**
 * Synthesize text to speech. Returns MP3 as ArrayBuffer.
 * @param {string} text
 * @param {string} voice
 * @param {AbortSignal} [signal]
 * @returns {Promise<ArrayBuffer>}
 */
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

/**
 * Check usage for current user.
 * @returns {Promise<{tier: string, used: number, limit: number, remaining: number, allowed: boolean}>}
 */
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
```

- [ ] **Step 2: Commit**

```bash
git add extension/lib/proxy-client.js
git commit -m "feat(extension): add proxy client with auth, streaming, and usage limit handling"
```

---

### Task 6: Conversation History

**Files:**
- Create: `extension/lib/conversation.js`

Rolling buffer of messages (max 10). Strips images from older messages before sending to API — same behavior as the desktop `ConversationHistory.cs`.

- [ ] **Step 1: Create conversation module**

```javascript
// extension/lib/conversation.js
import { MAX_CONVERSATION_MESSAGES } from './constants.js';

export class ConversationHistory {
  constructor() {
    /** @type {Array<{role: string, textContent: string, images?: Array<{label: string, base64: string}>}>} */
    this._messages = [];
  }

  get messages() { return this._messages; }

  addUserMessage(text, images = null) {
    this._messages.push({ role: 'user', textContent: text, images: images || undefined });
    this._trim();
  }

  addAssistantMessage(text) {
    this._messages.push({ role: 'assistant', textContent: text });
    this._trim();
  }

  /** Return messages formatted for the proxy API. Only last user message keeps images. */
  get messagesForApi() {
    return this._messages.map((m, i) => {
      if (m.role === 'user' && m.images?.length) {
        // Only keep images in the last user message
        const isLastUser = !this._messages.slice(i + 1).some(
          msg => msg.role === 'user' && msg.images?.length
        );

        if (isLastUser) {
          const content = [];
          for (const img of m.images) {
            content.push({ type: 'text', text: img.label });
            content.push({
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: img.base64 },
            });
          }
          content.push({ type: 'text', text: m.textContent || '' });
          return { role: m.role, content };
        }
      }
      return { role: m.role, content: m.textContent || '' };
    });
  }

  clear() { this._messages = []; }

  _trim() {
    while (this._messages.length > MAX_CONVERSATION_MESSAGES) {
      this._messages.shift();
    }
  }
}

/**
 * Parse [POINT:x,y:label] or [POINT:none] from end of Claude's response.
 * Returns { text, x, y, label } where x/y are -1 for no pointing.
 */
export function parsePointTag(response) {
  const match = response.match(/\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]]+))?)\]\s*$/);
  if (!match) return { text: response.trim(), x: -1, y: -1, label: null };

  const text = response.slice(0, match.index).trim();
  if (!match[1]) return { text, x: -1, y: -1, label: null }; // [POINT:none]

  return {
    text,
    x: parseInt(match[1]),
    y: parseInt(match[2]),
    label: match[3]?.trim() || null,
  };
}

/** Strip [POINT:...] tags from response for clean display. */
export function stripPointTags(response) {
  return response.replace(/\[POINT:[^\]]*\]/g, '').trim();
}
```

- [ ] **Step 2: Commit**

```bash
git add extension/lib/conversation.js
git commit -m "feat(extension): add conversation history with image stripping and point tag parsing"
```

---

### Task 7: Offscreen Document (Audio Capture + TTS Playback)

**Files:**
- Modify: `extension/offscreen/offscreen.html`
- Modify: `extension/offscreen/offscreen.js`

The offscreen document handles `getUserMedia` (microphone) and `Audio` (TTS playback) since service workers have no DOM.

- [ ] **Step 1: Update offscreen.html**

Already created in Task 1. No changes needed — it just loads offscreen.js.

- [ ] **Step 2: Implement offscreen.js**

```javascript
// extension/offscreen/offscreen.js

let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let analyser = null;
let audioContext = null;
let powerInterval = null;
let audioElement = null;

const MAX_RECORDING_MS = 60_000;
let recordingTimeout = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'start-recording':
      startRecording().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'stop-recording':
      stopRecording().then(data => sendResponse(data)).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'play-audio':
      playAudio(msg.data).then(() => sendResponse({ ok: true })).catch(e => sendResponse({ error: e.message }));
      return true;

    case 'stop-audio':
      stopAudio();
      sendResponse({ ok: true });
      break;

    case 'pause-audio':
      if (audioElement && !audioElement.paused) audioElement.pause();
      sendResponse({ ok: true });
      break;

    case 'resume-audio':
      if (audioElement?.paused) audioElement.play();
      sendResponse({ ok: true });
      break;
  }
});

async function startRecording() {
  audioChunks = [];

  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  // Set up audio power analysis for waveform
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(audioStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

  // Send audio power levels to service worker
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  powerInterval = setInterval(() => {
    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    chrome.runtime.sendMessage({ type: 'audio-power', level: rms });
  }, 50);

  mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm;codecs=opus' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.start(100); // Collect data every 100ms

  // Auto-stop after max duration
  recordingTimeout = setTimeout(() => {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.stop();
    }
  }, MAX_RECORDING_MS);
}

async function stopRecording() {
  clearTimeout(recordingTimeout);
  clearInterval(powerInterval);

  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
      cleanup();
      resolve({ data: null });
      return;
    }

    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const buffer = await blob.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      cleanup();
      resolve({ data: base64, type: 'audio/webm' });
    };

    mediaRecorder.stop();
  });
}

function cleanup() {
  audioStream?.getTracks().forEach(t => t.stop());
  audioContext?.close().catch(() => {});
  mediaRecorder = null;
  audioStream = null;
  analyser = null;
  audioContext = null;
  audioChunks = [];
}

async function playAudio(base64Data) {
  stopAudio();

  return new Promise((resolve, reject) => {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);

    audioElement = new Audio(url);
    audioElement.volume = 1.0;
    audioElement.onended = () => {
      URL.revokeObjectURL(url);
      chrome.runtime.sendMessage({ type: 'audio-ended' });
      resolve();
    };
    audioElement.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Audio playback failed'));
    };
    audioElement.play().catch(reject);
  });
}

function stopAudio() {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
    audioElement = null;
  }
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
```

- [ ] **Step 3: Commit**

```bash
git add extension/offscreen/
git commit -m "feat(extension): add offscreen document for audio capture and TTS playback"
```

---

### Task 8: Tab Capture & Context Building

This is handled directly in the service worker since `chrome.tabs.captureVisibleTab()` is a Chrome API only available there. No separate file needed — the logic will be part of the service worker pipeline (Task 9).

Key function to implement in service-worker.js:

```javascript
/**
 * Capture the current tab and build context for Claude.
 * Returns { images: [{label, base64}], contextPrefix: string }
 */
async function captureTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { images: null, contextPrefix: '' };

  const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 90 });
  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  // Get viewport dimensions from the tab
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }),
  });

  const vp = result || { w: 1280, h: 720, dpr: 1 };
  const ssW = Math.round(vp.w * vp.dpr);
  const ssH = Math.round(vp.h * vp.dpr);

  const label = `browser tab — ${ssW}x${ssH} pixels`;
  const contextPrefix = `[tab: ${tab.title || 'untitled'}, url: ${tab.url || ''}]`;

  return {
    images: [{ label, base64 }],
    contextPrefix,
    screenshotWidth: ssW,
    screenshotHeight: ssH,
    viewportWidth: vp.w,
    viewportHeight: vp.h,
    devicePixelRatio: vp.dpr,
    tabId: tab.id,
  };
}
```

This will be integrated directly into Task 9. No separate commit needed.

---

### Task 9: Service Worker Pipeline

**Files:**
- Modify: `extension/background/service-worker.js`

The service worker is the brain — it orchestrates the entire pipeline: hotkey handling, offscreen management, tab capture, API calls, and message routing to the buddy content script.

- [ ] **Step 1: Implement the complete service worker**

```javascript
// extension/background/service-worker.js
import { getValidToken, loadSession } from '../lib/auth.js';
import { streamChat, transcribe, synthesizeSpeech, UsageLimitError, AuthError } from '../lib/proxy-client.js';
import { ConversationHistory, parsePointTag, stripPointTags } from '../lib/conversation.js';
import { SYSTEM_PROMPT, DEFAULT_SETTINGS } from '../lib/constants.js';

// ---- State ----
let state = 'idle'; // idle | recording | processing | speaking
let abortController = null;
const history = new ConversationHistory();
let capturedTab = null; // Stored during recording

// ---- Offscreen Document Management ----

let offscreenCreated = false;

async function ensureOffscreen() {
  if (offscreenCreated) return;
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['USER_MEDIA', 'AUDIO_PLAYBACK'],
      justification: 'Audio capture for voice input and TTS playback',
    });
    offscreenCreated = true;
  } catch (e) {
    // Already exists (e.g. after service worker restart)
    if (e.message?.includes('already exists')) offscreenCreated = true;
    else throw e;
  }
}

async function sendToOffscreen(msg) {
  await ensureOffscreen();
  return chrome.runtime.sendMessage(msg);
}

// ---- Tab Capture ----

async function captureCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  let dataUrl;
  try {
    dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 90 });
  } catch {
    return null; // Can't capture (e.g. chrome:// pages)
  }

  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  let vp = { w: 1280, h: 720, dpr: 1 };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }),
    });
    if (result) vp = result;
  } catch { /* use defaults */ }

  const ssW = Math.round(vp.w * vp.dpr);
  const ssH = Math.round(vp.h * vp.dpr);

  return {
    images: [{ label: `browser tab — ${ssW}x${ssH} pixels`, base64 }],
    contextPrefix: `[tab: ${tab.title || 'untitled'}, url: ${tab.url || ''}]`,
    ssW, ssH,
    vpW: vp.w, vpH: vp.h,
    dpr: vp.dpr,
    tabId: tab.id,
  };
}

// ---- State Management ----

function setState(newState) {
  state = newState;
  // Notify all content scripts
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'state-changed', state: newState }).catch(() => {});
    }
  });

  // Update extension icon color
  const colors = { idle: '#7c3aed', recording: '#ef4444', processing: '#f59e0b', speaking: '#10b981' };
  chrome.action.setBadgeBackgroundColor({ color: colors[newState] || '#7c3aed' });
  chrome.action.setBadgeText({ text: newState === 'idle' ? '' : newState[0].toUpperCase() });
}

// ---- Send message to active tab's content script ----

async function sendToBuddy(msg) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
  }
}

// ---- Settings ----

async function getSettings() {
  const result = await chrome.storage.sync.get('tico_settings');
  return { ...DEFAULT_SETTINGS, ...result.tico_settings };
}

// ---- Pipeline ----

async function toggleRecording() {
  const token = await getValidToken();
  if (!token) {
    sendToBuddy({ type: 'show-message', text: 'please login first — click the Tico icon' });
    return;
  }

  if (state === 'recording') {
    // Stop recording → process
    await processRecording();
  } else if (state === 'idle') {
    // Start recording
    await startRecording();
  } else if (state === 'speaking' || state === 'processing') {
    // Cancel current operation
    abortController?.abort();
    await sendToOffscreen({ type: 'stop-audio' });
    sendToBuddy({ type: 'return-to-cursor' });
    setState('idle');
  }
}

async function startRecording() {
  // Capture tab screenshot immediately
  capturedTab = await captureCurrentTab();

  // Start audio recording
  const result = await sendToOffscreen({ type: 'start-recording' });
  if (result?.error) {
    sendToBuddy({ type: 'show-message', text: 'could not access microphone' });
    return;
  }

  setState('recording');
}

async function processRecording() {
  setState('processing');
  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    // Stop recording and get audio
    const audioResult = await sendToOffscreen({ type: 'stop-recording' });
    if (!audioResult?.data) {
      setState('idle');
      return;
    }

    // Decode base64 to ArrayBuffer
    const binary = atob(audioResult.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // Transcribe
    const transcript = await transcribe(bytes.buffer, audioResult.type || 'audio/webm', signal);
    if (!transcript.trim()) {
      setState('idle');
      return;
    }

    // Build context
    let context = transcript;
    let images = null;
    if (capturedTab) {
      context = `${capturedTab.contextPrefix}\n\n${transcript}`;
      images = capturedTab.images;
    }

    history.addUserMessage(context, images);

    const settings = await getSettings();

    // Stream Claude response
    const fullResponse = [];
    const sentenceBuffer = [];
    const ttsTasks = [];
    let firstSentenceSent = false;

    for await (const token of streamChat(
      SYSTEM_PROMPT, history.messagesForApi, settings.claudeModel, signal
    )) {
      fullResponse.push(token);
      sentenceBuffer.push(token);

      // Detect sentence boundary
      const buf = sentenceBuffer.join('');
      const splitIdx = findSentenceEnd(buf);
      if (splitIdx >= 0) {
        const sentence = buf.slice(0, splitIdx + 1).trim();
        sentenceBuffer.length = 0;
        sentenceBuffer.push(buf.slice(splitIdx + 1));

        if (sentence.length > 0) {
          ttsTasks.push(synthesizeSpeech(sentence, settings.ttsVoice, signal));
          if (!firstSentenceSent) {
            firstSentenceSent = true;
            setState('speaking');
          }
        }
      }
    }

    // Flush remaining buffer
    let remaining = sentenceBuffer.join('').trim();
    const pointMatch = remaining.match(/\[POINT:[^\]]+\]\s*$/);
    if (pointMatch) remaining = remaining.slice(0, pointMatch.index).trim();
    if (remaining.length > 0) {
      ttsTasks.push(synthesizeSpeech(remaining, settings.ttsVoice, signal));
    }

    const responseText = fullResponse.join('');
    history.addAssistantMessage(responseText);

    // Parse pointing
    const point = parsePointTag(responseText);

    setState('speaking');

    // Emit chat entry for history
    chrome.runtime.sendMessage({
      type: 'chat-entry',
      question: transcript,
      response: stripPointTags(responseText),
    }).catch(() => {});

    // Save to chat history storage
    const historyData = await chrome.storage.local.get('tico_chat_history');
    const entries = historyData.tico_chat_history || [];
    entries.push({ question: transcript, response: stripPointTags(responseText), timestamp: Date.now() });
    while (entries.length > 50) entries.shift();
    await chrome.storage.local.set({ tico_chat_history: entries });

    // Handle pointing
    if (point.x >= 0 && point.y >= 0 && capturedTab) {
      const screenX = point.x / capturedTab.dpr;
      const screenY = point.y / capturedTab.dpr;
      sendToBuddy({ type: 'point-at', x: screenX, y: screenY, label: point.label });
    }

    // Play audio chunks sequentially
    for (const ttsTask of ttsTasks) {
      if (signal.aborted) break;
      try {
        const audioBuffer = await ttsTask;
        if (audioBuffer.byteLength > 0) {
          const b64 = arrayBufferToBase64(audioBuffer);
          await sendToOffscreen({ type: 'play-audio', data: b64 });
        }
      } catch (e) {
        if (e.name === 'AbortError') break;
        console.warn('[Tico] TTS chunk failed:', e.message);
      }
    }

    // Wait, then return to cursor
    if (!signal.aborted) {
      await sleep(1000);
      if (point.x < 0 || point.y < 0) await sleep(5000);
      sendToBuddy({ type: 'return-to-cursor' });
    }

    setState('idle');

  } catch (e) {
    if (e.name === 'AbortError') return;

    if (e instanceof UsageLimitError) {
      await handleUsageLimit(e);
      return;
    }

    if (e instanceof AuthError) {
      sendToBuddy({ type: 'show-message', text: 'session expired — click Tico icon to login' });
      setState('idle');
      return;
    }

    console.error('[Tico] Pipeline error:', e);
    setState('idle');
  }
}

async function handleUsageLimit(err) {
  const message = err.tier === 'free'
    ? 'you used your ten daily uses. upgrade to pro to keep going.'
    : err.tier === 'pro'
    ? 'you used your five hundred monthly uses. upgrade to unlimited.'
    : `${err.tier} plan limit reached.`;

  setState('speaking');
  sendToBuddy({ type: 'show-message', text: message });

  try {
    const settings = await getSettings();
    const audioBuffer = await synthesizeSpeech(message, settings.ttsVoice);
    const b64 = arrayBufferToBase64(audioBuffer);
    await sendToOffscreen({ type: 'play-audio', data: b64 });
  } catch { /* ignore TTS errors for limit message */ }

  await sleep(3500);
  setState('idle');
}

// ---- Helpers ----

function findSentenceEnd(text) {
  for (let i = 1; i < text.length; i++) {
    if (text[i] === ' ' && (text[i-1] === '.' || text[i-1] === '?' || text[i-1] === '!')) {
      if (text[i-1] === '.' && i >= 2 && /\d/.test(text[i-2])) continue;
      return i;
    }
  }
  return -1;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ---- Event Listeners ----

// Hotkey
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-recording') toggleRecording();
});

// Messages from content script, popup, side panel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'toggle-recording':
      toggleRecording();
      sendResponse({ ok: true });
      break;

    case 'auth-changed':
      // User logged in or out — nothing to do (next API call will use new token)
      sendResponse({ ok: true });
      break;

    case 'get-state':
      sendResponse({ state });
      break;

    case 'audio-power':
      // Forward from offscreen to content script
      sendToBuddy({ type: 'audio-power', level: msg.level });
      break;

    case 'audio-ended':
      // TTS chunk finished — nothing to do (handled in pipeline)
      break;

    case 'get-chat-history':
      chrome.storage.local.get('tico_chat_history').then(data => {
        sendResponse({ entries: data.tico_chat_history || [] });
      });
      return true;

    case 'clear-chat-history':
      history.clear();
      chrome.storage.local.set({ tico_chat_history: [] });
      sendResponse({ ok: true });
      break;
  }
});

// Enable side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// Initialize
console.log('[Tico] Service worker ready');
```

- [ ] **Step 2: Verify the service worker loads without errors**

Reload extension → inspect service worker console. Expected: `[Tico] Service worker ready` with no errors.

- [ ] **Step 3: Commit**

```bash
git add extension/background/service-worker.js
git commit -m "feat(extension): add service worker pipeline (hotkey, capture, transcribe, Claude, TTS)"
```

---

### Task 10: Content Script Buddy (Core + Animations)

**Files:**
- Modify: `extension/content/buddy.js`

The buddy is the visual companion overlay injected into every page. Uses Shadow DOM for style isolation. Implements spring physics (cursor following), Bezier arc flight (pointing), waveform (recording), spinner (processing), and speech bubble.

- [ ] **Step 1: Implement the complete buddy content script**

```javascript
// extension/content/buddy.js
// Tico buddy overlay — injected via content_scripts into every page.
// Uses Shadow DOM to isolate styles from the host page.
// Communicates with service worker via chrome.runtime.sendMessage/onMessage.

(function() {
  'use strict';
  if (window.__ticoLoaded) return;
  window.__ticoLoaded = true;

  // ---- Constants ----
  const SPRING_STIFFNESS = 250;
  const SPRING_DAMPING = 18;
  const OFFSET_X = 30;
  const OFFSET_Y = 22;
  const BUDDY_SIZE = 32;

  // ---- State ----
  let buddyX = 0, buddyY = 0;
  let velX = 0, velY = 0;
  let targetX = 0, targetY = 0;
  let mouseX = 0, mouseY = 0;
  let followCursor = true;
  let currentState = 'idle';
  let lastFrame = performance.now();

  // Flight
  let isFlying = false;
  let flightProgress = 0, flightDuration = 0.8;
  let flightStartX = 0, flightStartY = 0;
  let flightEndX = 0, flightEndY = 0;
  let flightCtrlX = 0, flightCtrlY = 0;

  // Return flight
  let isReturning = false;
  let returnStartMouseX = 0, returnStartMouseY = 0;

  // Audio power for waveform
  let audioPower = 0;
  let idlePulsePhase = 0;

  // Spinner angle
  let spinnerAngle = 0;

  // ---- Create Shadow DOM ----
  const host = document.createElement('div');
  host.id = '__tico-buddy-host';
  host.style.cssText = 'all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647; pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }

    .buddy-container {
      position: fixed;
      pointer-events: none;
      z-index: 2147483647;
    }

    .buddy-body {
      width: ${BUDDY_SIZE}px;
      height: ${BUDDY_SIZE}px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      position: absolute;
      transform-origin: center center;
      filter: drop-shadow(0 0 12px rgba(124,58,237,0.5));
      transition: background 0.3s;
    }

    .eye {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: white;
      position: absolute;
    }

    .glow {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%);
      position: absolute;
      pointer-events: none;
    }

    .waveform {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 2px;
      height: 20px;
    }

    .waveform .bar {
      width: 2px;
      background: #ef4444;
      border-radius: 1px;
      transition: background 0.3s;
    }

    .spinner {
      position: absolute;
      width: 18px;
      height: 18px;
    }

    .spinner-arc {
      fill: none;
      stroke: #f59e0b;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 28;
      stroke-dashoffset: 14;
    }

    .speech-bubble {
      position: absolute;
      background: #1a1428;
      color: #e2e0e7;
      padding: 8px 12px;
      border-radius: 10px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      max-width: 220px;
      white-space: pre-wrap;
      pointer-events: auto;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      border: 1px solid #2d2640;
      display: none;
      transform-origin: top left;
      animation: bubble-pop 0.35s ease-out;
    }

    @keyframes bubble-pop {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .mic-btn {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #1a1428;
      border: 2px solid #2d2640;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.2s;
    }

    .mic-btn:hover { border-color: #7c3aed; }

    .mic-btn svg {
      width: 14px;
      height: 14px;
      fill: #9f8fc0;
    }

    .mic-btn.recording { border-color: #ef4444; }
    .mic-btn.recording svg { fill: #ef4444; }

    .point-glow {
      position: fixed;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%);
      pointer-events: none;
      display: none;
      animation: point-pulse 1.5s ease-in-out infinite;
    }

    @keyframes point-pulse {
      0%, 100% { transform: scale(1); opacity: 0.8; }
      50% { transform: scale(1.5); opacity: 0.4; }
    }
  `;
  shadow.appendChild(style);

  // ---- Build DOM ----
  const container = document.createElement('div');
  container.className = 'buddy-container';

  // Glow
  const glow = document.createElement('div');
  glow.className = 'glow';
  container.appendChild(glow);

  // Body
  const body = document.createElement('div');
  body.className = 'buddy-body';
  container.appendChild(body);

  // Eyes
  const leftEye = document.createElement('div');
  leftEye.className = 'eye';
  const rightEye = document.createElement('div');
  rightEye.className = 'eye';
  container.appendChild(leftEye);
  container.appendChild(rightEye);

  // Waveform (5 bars)
  const waveform = document.createElement('div');
  waveform.className = 'waveform';
  waveform.style.display = 'none';
  const bars = [];
  const waveProfile = [0.4, 0.7, 1.0, 0.7, 0.4];
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = '3px';
    waveform.appendChild(bar);
    bars.push(bar);
  }
  container.appendChild(waveform);

  // Spinner
  const spinnerWrap = document.createElement('div');
  spinnerWrap.className = 'spinner';
  spinnerWrap.style.display = 'none';
  spinnerWrap.innerHTML = `<svg viewBox="0 0 18 18"><circle class="spinner-arc" cx="9" cy="9" r="7"/></svg>`;
  container.appendChild(spinnerWrap);

  // Speech bubble
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  container.appendChild(bubble);

  // Mic button
  const micBtn = document.createElement('div');
  micBtn.className = 'mic-btn';
  micBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
  micBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'toggle-recording' });
  });
  container.appendChild(micBtn);

  // Point glow
  const pointGlow = document.createElement('div');
  pointGlow.className = 'point-glow';
  shadow.appendChild(pointGlow);

  shadow.appendChild(container);
  document.documentElement.appendChild(host);

  // ---- Mouse Tracking ----
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  // Initial position
  buddyX = window.innerWidth - 60;
  buddyY = window.innerHeight - 60;
  targetX = buddyX;
  targetY = buddyY;

  // ---- Render Loop ----
  function render(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (isFlying) {
      updateFlight(dt);
    } else if (followCursor) {
      targetX = mouseX + OFFSET_X;
      targetY = mouseY + OFFSET_Y;
      updateSpring(dt);
    }

    updatePosition();
    updateEyes();

    if (currentState === 'recording') updateWaveform(dt);
    if (currentState === 'processing') updateSpinner(dt);

    requestAnimationFrame(render);
  }

  function updateSpring(dt) {
    const dx = targetX - buddyX;
    const dy = targetY - buddyY;
    const fx = SPRING_STIFFNESS * dx - SPRING_DAMPING * velX;
    const fy = SPRING_STIFFNESS * dy - SPRING_DAMPING * velY;
    velX += fx * dt;
    velY += fy * dt;
    buddyX += velX * dt;
    buddyY += velY * dt;
  }

  function updateFlight(dt) {
    if (isReturning) {
      const cdx = mouseX - returnStartMouseX;
      const cdy = mouseY - returnStartMouseY;
      if (Math.sqrt(cdx*cdx + cdy*cdy) > 100) {
        returnToCursor();
        return;
      }
    }

    flightProgress += dt / flightDuration;
    if (flightProgress >= 1) {
      flightProgress = 1;
      isFlying = false;
      buddyX = flightEndX;
      buddyY = flightEndY;
      velX = 0; velY = 0;

      if (isReturning) {
        returnToCursor();
      } else {
        showBubble(pendingBubbleText);
      }
      return;
    }

    const t = flightProgress;
    const s = t * t * (3 - 2 * t); // smoothstep
    const omt = 1 - s;
    buddyX = omt*omt * flightStartX + 2*omt*s * flightCtrlX + s*s * flightEndX;
    buddyY = omt*omt * flightStartY + 2*omt*s * flightCtrlY + s*s * flightEndY;

    // Scale pulse
    const scale = 1 + 0.3 * Math.sin(flightProgress * Math.PI);
    body.style.transform = `scale(${scale})`;
  }

  function updatePosition() {
    const half = BUDDY_SIZE / 2;
    body.style.left = `${buddyX - half}px`;
    body.style.top = `${buddyY - half}px`;

    glow.style.left = `${buddyX - 25}px`;
    glow.style.top = `${buddyY - 25}px`;

    waveform.style.left = `${buddyX + half + 4}px`;
    waveform.style.top = `${buddyY - 10}px`;

    spinnerWrap.style.left = `${buddyX - 9}px`;
    spinnerWrap.style.top = `${buddyY - 9}px`;

    bubble.style.left = `${buddyX + 10}px`;
    bubble.style.top = `${buddyY + half + 6}px`;

    micBtn.style.left = `${buddyX - half - 32}px`;
    micBtn.style.top = `${buddyY - 14}px`;
  }

  function updateEyes() {
    const half = BUDDY_SIZE / 2;
    let eyeOffX = Math.max(-3, Math.min(3, velX * 0.02));
    let eyeOffY = Math.max(-3, Math.min(3, velY * 0.02));

    if (isFlying) {
      const dx = flightEndX - buddyX;
      const dy = flightEndY - buddyY;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 1) { eyeOffX = (dx/d)*3; eyeOffY = (dy/d)*3; }
    }

    leftEye.style.left = `${buddyX - 7 + eyeOffX}px`;
    leftEye.style.top = `${buddyY - 2 + eyeOffY}px`;
    rightEye.style.left = `${buddyX + 3 + eyeOffX}px`;
    rightEye.style.top = `${buddyY - 2 + eyeOffY}px`;
  }

  function updateWaveform(dt) {
    idlePulsePhase += dt * 3;
    const pulse = (Math.sin(idlePulsePhase) + 1) / 2 * 1.5;
    for (let i = 0; i < 5; i++) {
      const h = 3 + (audioPower * 10 * waveProfile[i]) + pulse;
      bars[i].style.height = `${h}px`;
    }
  }

  function updateSpinner(dt) {
    spinnerAngle += dt * 450;
    if (spinnerAngle >= 360) spinnerAngle -= 360;
    const arc = spinnerWrap.querySelector('.spinner-arc');
    if (arc) arc.style.transform = `rotate(${spinnerAngle}deg)`;
    spinnerWrap.querySelector('svg').style.transform = `rotate(${spinnerAngle}deg)`;
  }

  // ---- State ----
  const stateColors = {
    idle:       { bg: ['#7c3aed','#a855f7'], glow: 'rgba(124,58,237,0.25)', bar: '#7c3aed' },
    recording:  { bg: ['#ef4444','#f87171'], glow: 'rgba(239,68,68,0.25)', bar: '#ef4444' },
    processing: { bg: ['#f59e0b','#fbbf24'], glow: 'rgba(245,158,11,0.25)', bar: '#f59e0b' },
    speaking:   { bg: ['#10b981','#34d399'], glow: 'rgba(16,185,129,0.25)', bar: '#10b981' },
  };

  function setVisualState(s) {
    currentState = s;
    const c = stateColors[s] || stateColors.idle;
    body.style.background = `linear-gradient(135deg, ${c.bg[0]}, ${c.bg[1]})`;
    body.style.filter = `drop-shadow(0 0 12px ${c.bg[0]}80)`;
    glow.style.background = `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`;
    for (const bar of bars) bar.style.background = c.bar;

    waveform.style.display = s === 'recording' ? 'flex' : 'none';
    spinnerWrap.style.display = s === 'processing' ? 'block' : 'none';
    micBtn.classList.toggle('recording', s === 'recording');
  }

  // ---- Flight ----
  let pendingBubbleText = '';

  function flyTo(x, y, label) {
    followCursor = false;
    isFlying = true;
    isReturning = false;
    flightProgress = 0;
    flightStartX = buddyX; flightStartY = buddyY;
    flightEndX = x; flightEndY = y;

    const dx = flightEndX - flightStartX;
    const dy = flightEndY - flightStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    flightDuration = Math.max(0.6, Math.min(1.4, dist / 800));
    const arc = Math.min(dist * 0.2, 80);
    flightCtrlX = (flightStartX + flightEndX) / 2;
    flightCtrlY = Math.min(flightStartY, flightEndY) - arc;

    const phrases = ['right here!', 'this one!', 'look here!', 'click here!', 'found it!'];
    pendingBubbleText = label || phrases[Math.floor(Math.random() * phrases.length)];
  }

  function startReturnFlight() {
    returnStartMouseX = mouseX;
    returnStartMouseY = mouseY;

    flightStartX = buddyX; flightStartY = buddyY;
    flightEndX = mouseX + OFFSET_X;
    flightEndY = mouseY + OFFSET_Y;

    const dx = flightEndX - flightStartX;
    const dy = flightEndY - flightStartY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 8) { returnToCursor(); return; }

    flightDuration = Math.max(0.6, Math.min(1.4, dist / 800));
    const arc = Math.min(dist * 0.2, 80);
    flightCtrlX = (flightStartX + flightEndX) / 2;
    flightCtrlY = Math.min(flightStartY, flightEndY) - arc;

    flightProgress = 0;
    isFlying = true;
    isReturning = true;
    followCursor = false;
  }

  function returnToCursor() {
    followCursor = true;
    isFlying = false;
    isReturning = false;
    body.style.transform = 'scale(1)';
    hideBubble();
    hidePointGlow();
  }

  // ---- Speech Bubble ----
  let bubbleTimer = null;
  let bubbleHoldTimer = null;

  function showBubble(text) {
    bubble.textContent = '';
    bubble.style.display = 'block';
    bubble.style.animation = 'none';
    void bubble.offsetHeight; // trigger reflow
    bubble.style.animation = 'bubble-pop 0.35s ease-out';

    let i = 0;
    clearInterval(bubbleTimer);
    clearTimeout(bubbleHoldTimer);
    bubbleTimer = setInterval(() => {
      if (i < text.length) {
        bubble.textContent += text[i++];
      } else {
        clearInterval(bubbleTimer);
        bubbleHoldTimer = setTimeout(() => {
          hideBubble();
          startReturnFlight();
        }, 3000);
      }
    }, 40);
  }

  function hideBubble() {
    clearInterval(bubbleTimer);
    clearTimeout(bubbleHoldTimer);
    bubble.style.display = 'none';
    bubble.textContent = '';
  }

  // ---- Point Glow ----
  function showPointGlow(x, y) {
    pointGlow.style.left = `${x - 20}px`;
    pointGlow.style.top = `${y - 20}px`;
    pointGlow.style.display = 'block';
  }

  function hidePointGlow() {
    pointGlow.style.display = 'none';
  }

  // ---- Message Handling ----
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'state-changed':
        setVisualState(msg.state);
        break;
      case 'point-at':
        showPointGlow(msg.x, msg.y);
        flyTo(msg.x, msg.y, msg.label);
        break;
      case 'return-to-cursor':
        returnToCursor();
        break;
      case 'show-message':
        showBubble(msg.text);
        setTimeout(() => { hideBubble(); }, 5000);
        break;
      case 'audio-power':
        audioPower = Math.min(1, Math.pow(msg.level, 0.76) * 2.85);
        break;
    }
  });

  // ---- Start ----
  requestAnimationFrame(render);

  // Get initial state
  chrome.runtime.sendMessage({ type: 'get-state' }, (res) => {
    if (res?.state) setVisualState(res.state);
  });
})();
```

- [ ] **Step 2: Verify buddy appears on a page**

Reload extension → open any web page. Expected: purple circle with eyes follows cursor, mic button visible to its left.

- [ ] **Step 3: Commit**

```bash
git add extension/content/buddy.js
git commit -m "feat(extension): add buddy content script with spring physics, flight, and pointing"
```

---

### Task 11: Side Panel (Chat History + Settings)

**Files:**
- Modify: `extension/sidepanel/sidepanel.html`
- Modify: `extension/sidepanel/sidepanel.js`
- Modify: `extension/sidepanel/sidepanel.css`

- [ ] **Step 1: Build side panel HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <div id="app">
    <header>
      <span class="logo">tico</span>
      <div class="tabs">
        <button class="tab active" data-tab="history">history</button>
        <button class="tab" data-tab="settings">settings</button>
      </div>
    </header>

    <div id="history-tab" class="tab-content active">
      <div id="entries"></div>
      <div id="empty-state" class="empty">no conversations yet. press Alt+T to talk!</div>
      <button id="clear-btn" class="btn-clear" style="display:none">clear history</button>
    </div>

    <div id="settings-tab" class="tab-content">
      <div class="setting">
        <label>voice</label>
        <select id="voice-select">
          <option value="nova">Nova (default)</option>
          <option value="alloy">Alloy</option>
          <option value="echo">Echo</option>
          <option value="fable">Fable</option>
          <option value="onyx">Onyx</option>
          <option value="shimmer">Shimmer</option>
        </select>
      </div>
      <div class="setting">
        <label>model</label>
        <select id="model-select">
          <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
          <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
        </select>
      </div>
      <div class="setting">
        <label>shortcut</label>
        <span class="shortcut-display">Alt+T</span>
        <a href="chrome://extensions/shortcuts" target="_blank" class="change-link">change</a>
      </div>
    </div>
  </div>
  <script type="module" src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Build side panel JS**

```javascript
// extension/sidepanel/sidepanel.js
import { DEFAULT_SETTINGS } from '../lib/constants.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Tabs ----
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(`#${tab.dataset.tab}-tab`).classList.add('active');
  });
});

// ---- Chat History ----
async function loadHistory() {
  const res = await chrome.runtime.sendMessage({ type: 'get-chat-history' });
  const entries = res?.entries || [];
  const container = $('#entries');
  const emptyState = $('#empty-state');
  const clearBtn = $('#clear-btn');

  container.innerHTML = '';

  if (entries.length === 0) {
    emptyState.style.display = 'block';
    clearBtn.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  clearBtn.style.display = 'block';

  // Show newest first
  for (const entry of [...entries].reverse()) {
    const el = document.createElement('div');
    el.className = 'entry';

    const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <div class="entry-question"><span class="entry-role">you</span> ${escapeHtml(entry.question)}</div>
      <div class="entry-response"><span class="entry-role">tico</span> ${escapeHtml(entry.response)}</div>
      <div class="entry-time">${time}</div>
    `;
    container.appendChild(el);
  }
}

$('#clear-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'clear-chat-history' });
  loadHistory();
});

// Listen for new entries
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'chat-entry') loadHistory();
});

// ---- Settings ----
async function loadSettings() {
  const result = await chrome.storage.sync.get('tico_settings');
  const settings = { ...DEFAULT_SETTINGS, ...result.tico_settings };

  $('#voice-select').value = settings.ttsVoice;
  $('#model-select').value = settings.claudeModel;
}

async function saveSettings() {
  const settings = {
    ttsVoice: $('#voice-select').value,
    claudeModel: $('#model-select').value,
    chatHistoryEnabled: true,
    iconStyle: 'default',
  };
  await chrome.storage.sync.set({ tico_settings: settings });
}

$('#voice-select').addEventListener('change', saveSettings);
$('#model-select').addEventListener('change', saveSettings);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- Init ----
loadHistory();
loadSettings();
```

- [ ] **Step 3: Build side panel CSS**

```css
/* extension/sidepanel/sidepanel.css */
body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0f0a1a;
  color: #e2e0e7;
  font-size: 13px;
}

#app { display: flex; flex-direction: column; height: 100vh; }

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #1e1b2e;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  color: #a855f7;
  letter-spacing: -1px;
}

.tabs { display: flex; gap: 4px; }

.tab {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #6b5f80;
  font-size: 12px;
  cursor: pointer;
}

.tab.active { background: #1a1428; color: #a855f7; }
.tab:hover { color: #a855f7; }

.tab-content { display: none; flex: 1; overflow-y: auto; padding: 12px 16px; }
.tab-content.active { display: block; }

.entry {
  padding: 12px 0;
  border-bottom: 1px solid #1e1b2e;
}

.entry-question { color: #9f8fc0; margin-bottom: 6px; }
.entry-response { color: #e2e0e7; }
.entry-role {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: #7c3aed;
  margin-right: 4px;
}

.entry-time { font-size: 11px; color: #4a4260; margin-top: 4px; }

.empty {
  text-align: center;
  color: #4a4260;
  padding: 40px 20px;
  font-size: 13px;
}

.btn-clear {
  width: calc(100% - 32px);
  margin: 12px 16px;
  padding: 8px;
  border: 1px solid #2d2640;
  border-radius: 6px;
  background: transparent;
  color: #6b5f80;
  font-size: 12px;
  cursor: pointer;
}

.btn-clear:hover { border-color: #ef4444; color: #ef4444; }

.setting {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #1e1b2e;
}

.setting label { color: #9f8fc0; font-size: 13px; }

.setting select {
  background: #1a1428;
  color: #e2e0e7;
  border: 1px solid #2d2640;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
}

.shortcut-display {
  background: #1a1428;
  padding: 4px 8px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  color: #a855f7;
}

.change-link {
  color: #6b5f80;
  font-size: 11px;
  text-decoration: none;
  margin-left: 8px;
}

.change-link:hover { color: #a855f7; }
```

- [ ] **Step 4: Verify side panel**

Reload extension → right-click extension icon → "Open side panel". Expected: Side panel shows with history (empty state) and settings tabs.

- [ ] **Step 5: Commit**

```bash
git add extension/sidepanel/
git commit -m "feat(extension): add side panel with chat history and settings"
```

---

### Task 12: Backend Updates (CORS + Transcribe Format)

**Files:**
- Modify: `proxy/worker.js:28-31` — add extension origin to CORS
- Modify: `proxy/worker.js:286-297` — make transcribe content-type dynamic

- [ ] **Step 1: Update CORS origins**

In `proxy/worker.js`, update the `ALLOWED_ORIGINS` set:

```javascript
const ALLOWED_ORIGINS = new Set([
  "https://ticoai.app",
  "https://www.ticoai.app",
  // Chrome extension origins are "chrome-extension://<id>"
  // During development the ID changes, so we allow all extension origins
]);
```

Also update `corsHeaders()` to accept Chrome extension origins:

```javascript
function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  };
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.startsWith("chrome-extension://"))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
```

- [ ] **Step 2: Make transcribe format-agnostic**

The current `/transcribe` handler hardcodes `audio/wav`. Update it to detect the incoming content-type and forward it. Replace the file part assembly (around line 286-297) in `handleTranscribe`:

```javascript
  // Detect original content type from the multipart part headers
  const partHeaders = extractPartHeaders(audioBytes, boundary);
  const detectedType = partHeaders?.contentType || 'audio/wav';
  const ext = detectedType.includes('webm') ? 'webm' : detectedType.includes('mp4') ? 'mp4' : 'wav';

  // Assemble a clean multipart body that OpenAI will accept
  const enc = new TextEncoder();
  const filePart = [
    `--${freshBoundary}\r\n`,
    `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n`,
    `Content-Type: ${detectedType}\r\n\r\n`,
  ].join("");
```

Add the `extractPartHeaders` helper at the bottom of the file:

```javascript
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
```

- [ ] **Step 3: Test with existing desktop app**

The desktop app still sends `audio/wav`. Verify it still works after the change:
```bash
cd proxy && npx wrangler dev
```
Then test from the desktop app — transcription should work as before.

- [ ] **Step 4: Commit**

```bash
git add proxy/worker.js
git commit -m "feat(proxy): add Chrome extension CORS support and format-agnostic transcription"
```

---

### Task 13: Extension Icons

**Files:**
- Create: `extension/icons/tico-16.png`
- Create: `extension/icons/tico-32.png`
- Create: `extension/icons/tico-48.png`
- Create: `extension/icons/tico-128.png`

- [ ] **Step 1: Generate icons**

Create purple circle icons with "T" letter at each size. Options:
1. Export from the existing Tico branding/logo
2. Use a simple SVG-to-PNG pipeline
3. Create manually in any image editor

The icons should be a purple circle (#7c3aed) with a white "T" or the Tico character face (two dots for eyes) — matching the desktop app's tray icon aesthetic.

- [ ] **Step 2: Verify icons appear**

Reload extension. Expected: Purple icon appears in Chrome toolbar and on `chrome://extensions/` page.

- [ ] **Step 3: Commit**

```bash
git add extension/icons/
git commit -m "feat(extension): add extension icons"
```

---

### Task 14: Integration Testing & Polish

- [ ] **Step 1: End-to-end login test**

1. Load unpacked extension
2. Click extension icon → popup appears with login form
3. Enter valid Tico credentials → click "entrar"
4. Expected: popup shows email, tier badge, and usage count
5. Close popup, re-open → should show logged-in status (persisted)

- [ ] **Step 2: End-to-end voice pipeline test**

1. Open any web page (e.g., wikipedia.org)
2. Press Alt+T → buddy turns red (recording), waveform animates
3. Speak a question about the page
4. Press Alt+T again → buddy turns yellow (processing), spinner shows
5. Wait for response → buddy turns green (speaking), audio plays
6. If pointing: buddy flies to target coordinates, glow appears, speech bubble shows
7. After audio finishes: buddy returns to cursor, turns purple (idle)

- [ ] **Step 3: Side panel test**

1. Right-click extension icon → "Open side panel"
2. History tab should show the conversation from step 2
3. Settings tab: change voice to "echo", change model to "Haiku"
4. Do another voice query → should use new voice and model

- [ ] **Step 4: Usage limit test**

1. Use a free-tier account
2. Exhaust all 10 uses
3. Try another query → buddy should show limit message and speak it

- [ ] **Step 5: Auth edge cases**

1. Logout via popup → buddy should stop responding to hotkey (shows "please login" message)
2. Let token expire (wait or manually clear storage) → should auto-refresh on next use
3. Use invalid credentials → error message appears in popup

- [ ] **Step 6: Content script isolation test**

1. Open a page with aggressive CSS (e.g., a page with `* { display: none !important; }`)
2. Buddy should still be visible (Shadow DOM isolation)
3. Open a page with strict CSP headers
4. Buddy should still work (no inline scripts, CSS in shadow DOM)

- [ ] **Step 7: Polish — update extension description**

In `manifest.json`, verify:
- Name: "TicoAI"
- Version: "1.0.0"
- Description is clear and under 132 characters for Chrome Web Store

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(extension): complete integration testing and polish"
```

---

## Summary

| # | Task | Key Files | Effort |
|---|------|-----------|--------|
| 1 | Project scaffold | manifest.json, stubs | ~30min |
| 2 | Constants & config | lib/constants.js | ~15min |
| 3 | Auth module | lib/auth.js | ~45min |
| 4 | Popup UI | popup/* | ~1hr |
| 5 | Proxy client | lib/proxy-client.js | ~1hr |
| 6 | Conversation history | lib/conversation.js | ~30min |
| 7 | Offscreen document | offscreen/* | ~1hr |
| 8 | Tab capture | (in service-worker.js) | ~20min |
| 9 | Service worker pipeline | background/service-worker.js | ~2hr |
| 10 | Buddy content script | content/buddy.js | ~3hr |
| 11 | Side panel | sidepanel/* | ~1.5hr |
| 12 | Backend updates | proxy/worker.js | ~30min |
| 13 | Icons | icons/* | ~30min |
| 14 | Integration testing | manual testing | ~2hr |

**Total estimated effort: ~14-16 hours of focused development**

## Chrome Web Store Checklist (post-development)

- [ ] Register as Chrome Web Store developer ($5 one-time fee)
- [ ] Prepare store listing: title, description, screenshots (1280x800), promo images
- [ ] Set privacy policy URL (https://ticoai.app/privacy already exists)
- [ ] Fill in "Permissions justification" for each permission in the developer dashboard
- [ ] Submit for review (typically 1-3 business days)
- [ ] Once approved, update https://ticoai.app landing page with Chrome Web Store link
