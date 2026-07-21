import { DEFAULT_SETTINGS } from '../lib/constants.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ---- Tabs ----
function switchToTab(name) {
  $$('.tab').forEach(t => t.classList.remove('active'));
  $$('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = $(`.tab[data-tab="${name}"]`);
  if (btn) btn.classList.add('active');
  const content = $(`#${name}-tab`);
  if (content) content.classList.add('active');
}

$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchToTab(tab.dataset.tab));
});

// Listen for tab switch requests from service worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'switch-tab' && msg.tab) switchToTab(msg.tab);
});

// ---- Settings ----
async function loadSettings() {
  const result = await chrome.storage.sync.get('tico_settings');
  const s = { ...DEFAULT_SETTINGS, ...result.tico_settings };

  $('#voice-select').value = s.ttsVoice;
  const vol = s.ttsVolume ?? 100;
  $('#volume-slider').value = vol;
  $('#volume-value').textContent = `${vol}%`;
  $('#show-buddy-toggle').checked = s.showBuddy !== false;
  $('#chat-history-toggle').checked = s.chatHistoryEnabled !== false;

  // Model buttons
  $$('[data-model]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.model === s.claudeModel);
  });

  // Style buttons
  $$('[data-style]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.style === (s.iconStyle || 'default'));
  });

  // Shortcut display
  if (s.shortcut) {
    $('#shortcut-btn').textContent = formatShortcut(s.shortcut);
  }
}

async function saveSettings(extra = {}) {
  const result = await chrome.storage.sync.get('tico_settings');
  const current = { ...DEFAULT_SETTINGS, ...result.tico_settings };
  const settings = { ...current, ...extra };
  await chrome.storage.sync.set({ tico_settings: settings });
}

// Model segmented buttons
$$('[data-model]').forEach(btn => {
  btn.addEventListener('click', async () => {
    $$('[data-model]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await saveSettings({ claudeModel: btn.dataset.model });
  });
});

// Style segmented buttons
$$('[data-style]').forEach(btn => {
  btn.addEventListener('click', async () => {
    $$('[data-style]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    await saveSettings({ iconStyle: btn.dataset.style });
    // Notify all tabs to change buddy style
    chrome.runtime.sendMessage({ type: 'icon-style-changed', style: btn.dataset.style });
  });
});

// Voice
$('#voice-select').addEventListener('change', () => {
  saveSettings({ ttsVoice: $('#voice-select').value });
});

// Volume
$('#volume-slider').addEventListener('input', () => {
  const vol = parseInt($('#volume-slider').value);
  $('#volume-value').textContent = `${vol}%`;
  saveSettings({ ttsVolume: vol });
  chrome.runtime.sendMessage({ type: 'volume-changed', volume: vol / 100 });
});

// Toggles
$('#show-buddy-toggle').addEventListener('change', () => {
  const visible = $('#show-buddy-toggle').checked;
  saveSettings({ showBuddy: visible });
  chrome.runtime.sendMessage({ type: 'buddy-visibility-changed', visible });
});

$('#chat-history-toggle').addEventListener('change', () => {
  const enabled = $('#chat-history-toggle').checked;
  saveSettings({ chatHistoryEnabled: enabled });
  chrome.runtime.sendMessage({ type: 'chat-history-toggled', enabled });
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'chat-entry') loadHistory();
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- Shortcut Recording ----
let recordingShortcut = false;

function formatShortcut(s) {
  const parts = [];
  if (s.ctrl) parts.push('Ctrl');
  if (s.alt) parts.push('Alt');
  if (s.shift) parts.push('Shift');
  if (s.meta) parts.push('Meta');
  let keyName = s.key;
  // Function keys: F1-F12
  if (/^F\d+$/.test(keyName)) { /* already clean */ }
  else if (keyName.startsWith('Key')) keyName = keyName.slice(3);
  else if (keyName.startsWith('Digit')) keyName = keyName.slice(5);
  else if (keyName.startsWith('Arrow')) keyName = keyName.slice(5);
  else if (keyName === 'Space') keyName = 'Space';
  else if (keyName === 'Backquote') keyName = '`';
  else if (keyName === 'Minus') keyName = '-';
  else if (keyName === 'Equal') keyName = '=';
  else if (keyName === 'BracketLeft') keyName = '[';
  else if (keyName === 'BracketRight') keyName = ']';
  else if (keyName === 'Backslash') keyName = '\\';
  else if (keyName === 'Semicolon') keyName = ';';
  else if (keyName === 'Quote') keyName = "'";
  else if (keyName === 'Comma') keyName = ',';
  else if (keyName === 'Period') keyName = '.';
  else if (keyName === 'Slash') keyName = '/';
  parts.push(keyName);
  return parts.join('+');
}

$('#shortcut-btn').addEventListener('click', () => {
  recordingShortcut = true;
  $('#shortcut-btn').classList.add('recording');
  $('#shortcut-btn').textContent = '...';
  $('#shortcut-hint').style.display = 'block';
  // Blur button so it doesn't swallow key events
  $('#shortcut-btn').blur();
  console.log('[Tico] Shortcut recording started');
});

window.addEventListener('keydown', (e) => {
  if (!recordingShortcut) return;

  console.log('[Tico] Keydown during recording:', {
    key: e.key, code: e.code,
    alt: e.altKey, ctrl: e.ctrlKey, shift: e.shiftKey, meta: e.metaKey,
  });

  e.preventDefault();
  e.stopPropagation();

  // Skip bare modifier keys — wait for the actual key
  if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) {
    console.log('[Tico] Bare modifier, waiting for key...');
    return;
  }

  const shortcut = {
    key: e.code,
    alt: e.altKey,
    ctrl: e.ctrlKey,
    shift: e.shiftKey,
    meta: e.metaKey,
  };

  console.log('[Tico] Shortcut captured:', shortcut, '→', formatShortcut(shortcut));

  recordingShortcut = false;
  $('#shortcut-btn').classList.remove('recording');
  $('#shortcut-btn').textContent = formatShortcut(shortcut);
  $('#shortcut-hint').style.display = 'none';

  saveSettings({ shortcut });
  chrome.runtime.sendMessage({ type: 'shortcut-changed', shortcut });
}, true); // useCapture to get events before Chrome swallows them

// Cancel recording on Escape
window.addEventListener('keyup', (e) => {
  if (recordingShortcut && e.key === 'Escape') {
    console.log('[Tico] Shortcut recording cancelled');
    recordingShortcut = false;
    $('#shortcut-btn').classList.remove('recording');
    $('#shortcut-hint').style.display = 'none';
    chrome.storage.sync.get('tico_settings', (result) => {
      const s = result.tico_settings?.shortcut || { key: 'KeyT', alt: true, ctrl: false, shift: false, meta: false };
      $('#shortcut-btn').textContent = formatShortcut(s);
    });
  }
}, true);

loadHistory();
loadSettings();
