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
  $('#user-tier').textContent = '...';
  $('#usage-text').textContent = '';
  $('#usage-remaining').textContent = '';
  $('#usage-bar').style.width = '0%';

  try {
    const token = await getValidToken();
    const res = await fetch(`${PROXY_BASE_URL}/usage`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const usage = await res.json();
      $('#user-tier').textContent = usage.tier.toUpperCase();
      $('#user-tier').className = `tier-badge tier-${usage.tier}`;

      if (usage.limit < 0) {
        $('#usage-text').textContent = 'unlimited';
        $('#usage-remaining').textContent = '';
        $('#usage-bar').style.width = '100%';
      } else {
        $('#usage-text').textContent = `${usage.used} of ${usage.limit} uses`;
        const pct = Math.min(100, (usage.used / usage.limit) * 100);
        $('#usage-bar').style.width = `${pct}%`;
        if (pct >= 80) $('#usage-bar').style.background = '#ef4444';
        const remaining = usage.limit - usage.used;
        $('#usage-remaining').textContent = `${remaining} ${usage.tier === 'free' ? 'remaining today' : 'remaining this month'}`;
      }
    }
  } catch {}
  await checkMicPermission();
}

async function checkMicPermission() {
  const micStatus = $('#mic-status');
  try {
    const result = await navigator.permissions.query({ name: 'microphone' });
    if (result.state === 'granted') {
      micStatus.textContent = '';
      return;
    }
  } catch {}
  micStatus.innerHTML = '<button id="mic-btn" class="btn-mic">enable microphone</button>';
  $('#mic-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('permissions/permissions.html') });
  });
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

$('#settings-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'open-side-panel', tab: 'settings' });
  window.close();
});

function formatShortcut(s) {
  const parts = [];
  if (s.ctrl) parts.push('Ctrl');
  if (s.alt) parts.push('Alt');
  if (s.shift) parts.push('Shift');
  if (s.meta) parts.push('Meta');
  let keyName = s.key;
  if (/^F\d+$/.test(keyName)) { /* already clean */ }
  else if (keyName.startsWith('Key')) keyName = keyName.slice(3);
  else if (keyName.startsWith('Digit')) keyName = keyName.slice(5);
  else if (keyName.startsWith('Arrow')) keyName = keyName.slice(5);
  else if (keyName === 'Space') keyName = 'Space';
  parts.push(keyName);
  return parts.join('+');
}

// Load saved shortcut into hotkey tip
chrome.storage.sync.get('tico_settings', (result) => {
  const s = result.tico_settings?.shortcut;
  if (s) $('#hotkey-display').textContent = formatShortcut(s);
});

init();
