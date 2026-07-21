import { getValidToken, loadSession } from '../lib/auth.js';
import { streamChat, transcribe, synthesizeSpeech, UsageLimitError, AuthError } from '../lib/proxy-client.js';
import { ConversationHistory, parsePointTag, parseElementPointTag, stripPointTags } from '../lib/conversation.js';
import { SYSTEM_PROMPT, DEFAULT_SETTINGS } from '../lib/constants.js';

// ---- State ----
let state = 'idle'; // idle | recording | processing | speaking
let abortController = null;
const history = new ConversationHistory();
let capturedTab = null;
let scannedElements = null; // Element list from content script
let lastDomain = null; // Track domain to reset conversation on site change

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
  } catch {
    // Document already exists (e.g. service worker restarted)
  }
  offscreenCreated = true;
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
    return null;
  }

  const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

  let vp = { w: 1280, h: 720, dpr: 1 };
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }),
    });
    if (result) vp = result;
  } catch {}

  return {
    images: [{ label: `browser tab — ${vp.w}x${vp.h} pixels`, base64 }],
    contextPrefix: `[tab: ${tab.title || 'untitled'}, url: ${tab.url || ''}]`,
    vpW: vp.w, vpH: vp.h,
    tabId: tab.id,
    url: tab.url || '',
  };
}

// ---- State Management ----
function setState(newState) {
  state = newState;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'state-changed', state: newState }).catch(() => {});
    }
  });
  const colors = { idle: '#7c3aed', recording: '#ef4444', processing: '#f59e0b', speaking: '#10b981' };
  chrome.action.setBadgeBackgroundColor({ color: colors[newState] || '#7c3aed' });
  chrome.action.setBadgeText({ text: newState === 'idle' ? '' : newState[0].toUpperCase() });
}

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

/** Called when user presses the hotkey down — start recording immediately. */
async function onHotkeyDown(elements) {
  scannedElements = elements || null;
  if (state === 'speaking' || state === 'processing') {
    // Cancel current operation (like desktop)
    abortController?.abort();
    await sendToOffscreen({ type: 'stop-audio' });
    sendToBuddy({ type: 'return-to-cursor' });
    setState('idle');
  }

  if (state === 'recording') {
    // Stuck recording (keyup was lost — tab closed, focus lost, etc.) — cancel and restart
    console.warn('[Tico] Recovering from stuck recording state');
    await sendToOffscreen({ type: 'stop-recording' }).catch(() => {});
    setState('idle');
  }

  if (state !== 'idle') return;

  const token = await getValidToken();
  if (!token) {
    sendToBuddy({ type: 'show-message', text: 'please login first — click the Tico icon' });
    return;
  }

  await startRecording();
}

/** Called when user releases the hotkey — stop recording and process. */
async function onHotkeyUp() {
  if (state !== 'recording') return;
  await processRecording();
}

/** Legacy toggle for mic button click and chrome.commands fallback. */
async function toggleRecording() {
  if (state === 'recording') {
    await processRecording();
  } else if (state === 'idle') {
    const token = await getValidToken();
    if (!token) {
      sendToBuddy({ type: 'show-message', text: 'please login first — click the Tico icon' });
      return;
    }
    await startRecording();
  } else {
    abortController?.abort();
    await sendToOffscreen({ type: 'stop-audio' });
    sendToBuddy({ type: 'return-to-cursor' });
    setState('idle');
  }
}

async function startRecording() {
  // Capture tab screenshot + scan DOM elements in parallel
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const capturePromise = captureCurrentTab();

  // Request element scan from content script (keydown doesn't reach it because chrome.commands intercepts)
  let elementsFromTab = null;
  if (tab?.id) {
    try {
      elementsFromTab = await chrome.tabs.sendMessage(tab.id, { type: 'scan-elements' });
    } catch {}
  }
  scannedElements = elementsFromTab || null;

  capturedTab = await capturePromise;

  // Sync volume setting to offscreen
  const settings = await getSettings();
  const vol = (settings.ttsVolume ?? 100) / 100;
  sendToOffscreen({ type: 'set-volume', volume: vol }).catch(() => {});
  const result = await sendToOffscreen({ type: 'start-recording' });
  if (result?.error) {
    sendToBuddy({ type: 'show-message', text: 'microphone setup needed — opening...' });
    chrome.tabs.create({ url: chrome.runtime.getURL('permissions/permissions.html') });
    return;
  }
  setState('recording');
}

async function processRecording() {
  setState('processing');
  abortController = new AbortController();
  const signal = abortController.signal;

  try {
    const audioResult = await sendToOffscreen({ type: 'stop-recording' });
    if (!audioResult?.data) {
      console.warn('[Tico] No audio data received from offscreen');
      setState('idle');
      return;
    }

    const binary = atob(audioResult.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    console.log(`[Tico] Audio: ${bytes.length} bytes, type: ${audioResult.type || 'audio/webm'}`);

    // Minimum ~1KB — anything smaller is likely an empty/corrupt recording
    if (bytes.length < 1000) {
      console.warn('[Tico] Audio too short, skipping transcription');
      setState('idle');
      return;
    }

    const transcript = await transcribe(bytes.buffer, audioResult.type || 'audio/webm', signal);
    if (!transcript.trim()) {
      setState('idle');
      return;
    }

    // Reset conversation when user switches to a different site
    if (capturedTab?.url) {
      try {
        const currentHost = new URL(capturedTab.url).hostname;
        if (lastDomain && currentHost !== lastDomain) {
          history.clear();
          console.log(`[Tico] Site changed (${lastDomain} → ${currentHost}), conversation reset`);
        }
        lastDomain = currentHost;
      } catch {}
    }

    let context = transcript;
    let images = null;
    if (capturedTab) {
      const parts = [capturedTab.contextPrefix];

      let imgBase64 = capturedTab.images[0].base64;

      // Annotate screenshot: normalize DPR + draw SoM numbered markers
      try {
        imgBase64 = await annotateScreenshot(
          imgBase64, scannedElements || [], capturedTab.vpW, capturedTab.vpH
        );
      } catch (e) {
        console.warn('[Tico] Screenshot annotation failed, using raw:', e);
      }

      if (scannedElements?.length) {
        const elementLines = scannedElements.map(e => `[${e.id}] ${e.label}`);
        parts.push(`[UI Elements — numbered markers on screenshot]\n${elementLines.join('\n')}`);
      }

      parts.push(transcript);
      context = parts.join('\n\n');
      images = [{ label: `browser tab — ${capturedTab.vpW}x${capturedTab.vpH} pixels`, base64: imgBase64 }];
    }

    history.addUserMessage(context, images);
    const settings = await getSettings();

    const fullResponse = [];
    const sentenceBuffer = [];
    const ttsTasks = [];
    let firstSentenceSent = false;

    for await (const token of streamChat(
      SYSTEM_PROMPT, history.messagesForApi, settings.claudeModel, signal
    )) {
      fullResponse.push(token);
      sentenceBuffer.push(token);

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

    let remaining = sentenceBuffer.join('').trim();
    const pointMatch = remaining.match(/\[POINT:[^\]]+\]\s*$/);
    if (pointMatch) remaining = remaining.slice(0, pointMatch.index).trim();
    if (remaining.length > 0) {
      ttsTasks.push(synthesizeSpeech(remaining, settings.ttsVoice, signal));
    }

    const responseText = fullResponse.join('');
    history.addAssistantMessage(responseText);

    setState('speaking');

    chrome.runtime.sendMessage({
      type: 'chat-entry',
      question: transcript,
      response: stripPointTags(responseText),
    }).catch(() => {});

    const historyData = await chrome.storage.local.get('tico_chat_history');
    const entries = historyData.tico_chat_history || [];
    entries.push({ question: transcript, response: stripPointTags(responseText), timestamp: Date.now() });
    while (entries.length > 50) entries.shift();
    await chrome.storage.local.set({ tico_chat_history: entries });

    // Pointing — try element ID first (pixel-perfect), fall back to coordinates
    let pointed = false;
    if (scannedElements?.length) {
      const elemPoint = parseElementPointTag(responseText);
      if (elemPoint) {
        sendToBuddy({ type: 'point-at-element', id: elemPoint.id, label: elemPoint.label });
        pointed = true;
      }
    }
    if (!pointed) {
      const point = parsePointTag(responseText);
      if (point.x >= 0 && point.y >= 0) {
        sendToBuddy({ type: 'point-at', x: point.x, y: point.y, label: point.label });
        pointed = true;
      }
    }

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

    if (!signal.aborted) {
      await sleep(1000);
      if (!pointed) await sleep(5000);
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
  } catch {}

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

// ---- Set-of-Mark Screenshot Annotation ----

/**
 * Normalizes screenshot to CSS viewport dimensions (fixes DPR) and draws
 * numbered purple markers at each scanned element's center position.
 * This lets Claude visually identify elements by their marker number.
 */
async function annotateScreenshot(base64Jpeg, elements, vpW, vpH) {
  const binary = atob(base64Jpeg);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  const canvas = new OffscreenCanvas(vpW, vpH);
  const ctx = canvas.getContext('2d');

  // Draw screenshot scaled to CSS viewport dimensions (eliminates DPR mismatch)
  ctx.drawImage(bitmap, 0, 0, vpW, vpH);
  bitmap.close();

  // Draw SoM markers
  if (elements.length > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const el of elements) {
      const numStr = String(el.id);
      const r = numStr.length > 1 ? 12 : 10;

      // Dark shadow ring for contrast on any background
      ctx.beginPath();
      ctx.arc(el.cx, el.cy, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fill();

      // Purple circle
      ctx.beginPath();
      ctx.arc(el.cx, el.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(124, 58, 237, 0.92)';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // White number
      ctx.fillStyle = 'white';
      ctx.font = `bold ${numStr.length > 1 ? 9 : 11}px Arial, sans-serif`;
      ctx.fillText(numStr, el.cx, el.cy + 0.5);
    }
  }

  const resultBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return arrayBufferToBase64(await resultBlob.arrayBuffer());
}

// ---- Event Listeners ----
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-recording') toggleRecording();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'hotkey-down':
      onHotkeyDown(msg.elements);
      sendResponse({ ok: true });
      break;
    case 'hotkey-up':
      onHotkeyUp();
      sendResponse({ ok: true });
      break;
    case 'toggle-recording':
      toggleRecording();
      sendResponse({ ok: true });
      break;
    case 'auth-changed':
      sendResponse({ ok: true });
      break;
    case 'get-state':
      sendResponse({ state });
      break;
    case 'audio-power':
      sendToBuddy({ type: 'audio-power', level: msg.level });
      break;
    case 'audio-ended':
      break;
    case 'icon-style-changed':
      // Forward to all content scripts
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'set-icon-style', style: msg.style }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      break;
    case 'buddy-visibility-changed':
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'set-visibility', visible: msg.visible }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      break;
    case 'shortcut-changed':
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'set-shortcut', shortcut: msg.shortcut }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
      break;
    case 'chat-history-toggled':
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, { type: 'set-chat-visible', visible: msg.enabled }).catch(() => {});
        }
      });
      sendResponse({ ok: true });
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
    case 'volume-changed':
      sendToOffscreen({ type: 'set-volume', volume: msg.volume });
      sendResponse({ ok: true });
      break;
    case 'open-side-panel':
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.sidePanel.open({ tabId: tab.id });
          // Notify side panel to switch to settings tab
          setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'switch-tab', tab: msg.tab || 'settings' });
          }, 300);
        }
      });
      sendResponse({ ok: true });
      break;
  }
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

console.log('[Tico] Service worker ready');
