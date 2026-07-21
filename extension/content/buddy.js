(function() {
  'use strict';
  if (window.__ticoLoaded) return;
  window.__ticoLoaded = true;

  const SPRING_STIFFNESS = 250;
  const SPRING_DAMPING = 18;
  const OFFSET_X = 28;
  const OFFSET_Y = 20;
  const BUDDY_SIZE = 26;

  let buddyX = 0, buddyY = 0;
  let velX = 0, velY = 0;
  let targetX = 0, targetY = 0;
  let mouseX = 0, mouseY = 0;
  let followCursor = true;
  let currentState = 'idle';
  let lastFrame = performance.now();

  let isFlying = false;
  let flightProgress = 0, flightDuration = 0.8;
  let flightStartX = 0, flightStartY = 0;
  let flightEndX = 0, flightEndY = 0;
  let flightCtrlX = 0, flightCtrlY = 0;

  let isReturning = false;
  let returnStartMouseX = 0, returnStartMouseY = 0;

  let audioPower = 0;
  let idlePulsePhase = 0;
  let spinnerAngle = 0;
  let pendingBubbleText = '';
  let isCursorStyle = false;

  // ---- Shadow DOM ----
  const host = document.createElement('div');
  host.id = '__tico-buddy-host';
  host.style.cssText = 'all:initial; position:fixed; top:0; left:0; width:0; height:0; z-index:2147483647; pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .buddy-container { position: fixed; pointer-events: none; z-index: 2147483647; }
    .buddy-body {
      width: ${BUDDY_SIZE}px; height: ${BUDDY_SIZE}px; border-radius: 50%;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      position: absolute; transform-origin: center center;
      filter: drop-shadow(0 0 12px rgba(124,58,237,0.5));
      transition: background 0.3s;
    }
    .cursor-pointer {
      position: absolute;
      display: none;
    }
    .cursor-pointer svg {
      width: 16px; height: 18px;
      filter: drop-shadow(0 0 8px rgba(124,58,237,0.5));
    }
    .eye { width: 4px; height: 4px; border-radius: 50%; background: white; position: absolute; }
    .glow {
      width: 42px; height: 42px; border-radius: 50%;
      background: radial-gradient(circle, rgba(124,58,237,0.25) 0%, transparent 70%);
      position: absolute; pointer-events: none;
    }
    .waveform { position: absolute; display: flex; align-items: center; gap: 2px; height: 20px; }
    .waveform .bar { width: 2px; background: #ef4444; border-radius: 1px; transition: background 0.3s; }
    .spinner { position: absolute; width: 18px; height: 18px; }
    .spinner-arc { fill: none; stroke: #f59e0b; stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 28; stroke-dashoffset: 14; }
    .speech-bubble {
      position: absolute; background: #7c3aed; color: white;
      padding: 4px 8px; border-radius: 6px;
      font-family: system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 500; line-height: 1.4;
      max-width: 220px; white-space: pre-wrap; pointer-events: auto;
      box-shadow: 0 0 6px rgba(124,58,237,0.3);
      display: none; transform-origin: top left; animation: bubble-pop 0.35s ease-out;
    }
    @keyframes bubble-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .point-glow {
      position: fixed; width: 40px; height: 40px; border-radius: 50%;
      background: radial-gradient(circle, rgba(124,58,237,0.5) 0%, transparent 70%);
      pointer-events: none; display: none; animation: point-pulse 1.5s ease-in-out infinite;
    }
    @keyframes point-pulse { 0%, 100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.5); opacity: 0.4; } }

    /* ---- Topbar ---- */
    .tico-topbar {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 2px;
      padding: 3px;
      background: rgba(20, 20, 20, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 10px;
      border: 1px solid rgba(124, 58, 237, 0.15);
      pointer-events: auto;
    }
    .topbar-btn {
      width: 30px; height: 30px;
      border-radius: 8px;
      background: transparent;
      border: none;
      color: #8a7aa8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: all 0.15s;
    }
    .topbar-btn:hover { background: rgba(124, 58, 237, 0.15); color: #a855f7; }
    .topbar-btn svg { width: 16px; height: 16px; fill: currentColor; }
    .chat-badge {
      position: absolute;
      top: 1px; right: 1px;
      min-width: 14px; height: 14px;
      border-radius: 7px;
      background: #7c3aed;
      color: white;
      font-size: 8px;
      font-weight: 700;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
    }

    /* ---- Chat Panel ---- */
    .tico-chat-panel {
      position: fixed;
      top: 50px;
      left: 50%;
      transform: translateX(-50%);
      width: 400px;
      max-height: 420px;
      background: rgba(12, 8, 22, 0.82);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 14px;
      border: 1px solid rgba(124, 58, 237, 0.15);
      pointer-events: auto;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .tico-chat-panel.open {
      display: flex;
      animation: panel-slide 0.2s ease-out;
    }
    @keyframes panel-slide {
      from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .chat-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .chat-panel-title {
      font-size: 13px;
      font-weight: 700;
      color: #a855f7;
    }
    .chat-panel-close {
      width: 22px; height: 22px;
      border-radius: 50%;
      background: rgba(255,255,255,0.06);
      border: none;
      color: #6b6b6b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.15s;
    }
    .chat-panel-close:hover { background: rgba(255,255,255,0.1); color: #e8e8e8; }
    .chat-panel-body {
      overflow-y: auto;
      flex: 1;
      padding: 6px 14px;
      max-height: 360px;
    }
    .chat-panel-body::-webkit-scrollbar { width: 4px; }
    .chat-panel-body::-webkit-scrollbar-track { background: transparent; }
    .chat-panel-body::-webkit-scrollbar-thumb { background: rgba(124,58,237,0.3); border-radius: 2px; }
    .chat-entry {
      padding: 10px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .chat-entry:last-child { border-bottom: none; }
    .chat-q { color: rgba(160, 143, 192, 0.9); font-size: 12px; margin-bottom: 4px; line-height: 1.4; }
    .chat-r { color: rgba(240, 240, 240, 0.95); font-size: 12px; line-height: 1.4; }
    .chat-role {
      font-size: 9px; font-weight: 700; text-transform: uppercase;
      color: #7c3aed; margin-right: 5px; letter-spacing: 0.3px;
    }
    .chat-time { font-size: 9px; color: rgba(106, 106, 106, 0.6); margin-top: 4px; }
    .chat-empty {
      text-align: center;
      color: rgba(106, 106, 106, 0.5);
      padding: 40px 20px;
      font-size: 12px;
      line-height: 1.5;
    }
  `;
  shadow.appendChild(style);

  // ---- Build DOM ----
  const container = document.createElement('div');
  container.className = 'buddy-container';

  const glow = document.createElement('div');
  glow.className = 'glow';
  container.appendChild(glow);

  const body = document.createElement('div');
  body.className = 'buddy-body';
  container.appendChild(body);

  const leftEye = document.createElement('div');
  leftEye.className = 'eye';
  const rightEye = document.createElement('div');
  rightEye.className = 'eye';
  container.appendChild(leftEye);
  container.appendChild(rightEye);

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

  const spinnerWrap = document.createElement('div');
  spinnerWrap.className = 'spinner';
  spinnerWrap.style.display = 'none';
  spinnerWrap.innerHTML = '<svg viewBox="0 0 18 18"><circle class="spinner-arc" cx="9" cy="9" r="7"/></svg>';
  container.appendChild(spinnerWrap);

  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  container.appendChild(bubble);

  const cursorPointer = document.createElement('div');
  cursorPointer.className = 'cursor-pointer';
  cursorPointer.innerHTML = `<svg viewBox="0 0 16 18"><defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0.5"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs><path d="M0,0 L16,9 L0,18 Z" fill="url(#cg)"/></svg>`;
  container.appendChild(cursorPointer);

  const pointGlow = document.createElement('div');
  pointGlow.className = 'point-glow';
  shadow.appendChild(pointGlow);

  shadow.appendChild(container);

  // ---- Topbar ----
  const topbar = document.createElement('div');
  topbar.className = 'tico-topbar';

  const chatBtn = document.createElement('button');
  chatBtn.className = 'topbar-btn';
  chatBtn.title = 'Chat history';
  chatBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>';
  const chatBadge = document.createElement('span');
  chatBadge.className = 'chat-badge';
  chatBadge.textContent = '0';
  chatBtn.appendChild(chatBadge);
  topbar.appendChild(chatBtn);

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'topbar-btn';
  settingsBtn.title = 'Settings';
  settingsBtn.innerHTML = '<svg viewBox="0 0 20 20"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/></svg>';
  topbar.appendChild(settingsBtn);

  shadow.appendChild(topbar);

  // ---- Chat Panel ----
  const chatPanel = document.createElement('div');
  chatPanel.className = 'tico-chat-panel';
  chatPanel.innerHTML = `
    <div class="chat-panel-header">
      <span class="chat-panel-title">tico</span>
      <button class="chat-panel-close">✕</button>
    </div>
    <div class="chat-panel-body">
      <div class="chat-empty">no conversations yet.<br>hold Alt+T to talk!</div>
    </div>
  `;
  shadow.appendChild(chatPanel);

  // Topbar events
  let chatOpen = false;
  let chatCount = 0;

  chatBtn.addEventListener('click', () => {
    chatOpen = !chatOpen;
    if (chatOpen) {
      chatPanel.classList.add('open');
      loadChatHistory();
    } else {
      chatPanel.classList.remove('open');
    }
  });

  chatPanel.querySelector('.chat-panel-close').addEventListener('click', () => {
    chatOpen = false;
    chatPanel.classList.remove('open');
  });

  settingsBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'open-side-panel' });
  });

  function loadChatHistory() {
    chrome.runtime.sendMessage({ type: 'get-chat-history' }, (res) => {
      const entries = res?.entries || [];
      const body = chatPanel.querySelector('.chat-panel-body');
      if (entries.length === 0) {
        body.innerHTML = '<div class="chat-empty">no conversations yet.<br>hold Alt+T to talk!</div>';
        return;
      }
      body.innerHTML = '';
      for (const entry of [...entries].reverse()) {
        const div = document.createElement('div');
        div.className = 'chat-entry';
        const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const q = entry.question.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const r = entry.response.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        div.innerHTML = `<div class="chat-q"><span class="chat-role">you</span>${q}</div><div class="chat-r"><span class="chat-role">tico</span>${r}</div><div class="chat-time">${time}</div>`;
        body.appendChild(div);
      }
    });
  }

  function incrementChatBadge() {
    chatCount++;
    chatBadge.textContent = chatCount > 99 ? '99+' : String(chatCount);
    chatBadge.style.display = 'flex';
    // If chat panel is open, auto-refresh
    if (chatOpen) loadChatHistory();
  }

  document.documentElement.appendChild(host);

  // ---- Mouse Tracking ----
  document.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });

  buddyX = window.innerWidth - 60;
  buddyY = window.innerHeight - 60;
  targetX = buddyX;
  targetY = buddyY;

  // ---- Render Loop ----
  function render(now) {
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    if (isFlying) updateFlight(dt);
    else if (followCursor) {
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
      if (Math.sqrt(cdx*cdx + cdy*cdy) > 100) { returnToCursor(); return; }
    }

    flightProgress += dt / flightDuration;
    if (flightProgress >= 1) {
      flightProgress = 1;
      isFlying = false;
      buddyX = flightEndX;
      buddyY = flightEndY;
      velX = 0; velY = 0;
      if (isReturning) { returnToCursor(); return; }
      showBubble(pendingBubbleText);
      return;
    }

    const t = flightProgress;
    const s = t * t * (3 - 2 * t);
    const omt = 1 - s;
    buddyX = omt*omt * flightStartX + 2*omt*s * flightCtrlX + s*s * flightEndX;
    buddyY = omt*omt * flightStartY + 2*omt*s * flightCtrlY + s*s * flightEndY;

    const scale = 1 + 0.3 * Math.sin(flightProgress * Math.PI);
    body.style.transform = `scale(${scale})`;
  }

  function updatePosition() {
    const half = BUDDY_SIZE / 2;
    if (isCursorStyle) {
      // Cursor pointer: positioned at buddy point, spinner/waveform to the right
      cursorPointer.style.left = `${buddyX - 8}px`;
      cursorPointer.style.top = `${buddyY - 9}px`;
      waveform.style.left = `${buddyX + 14}px`;
      waveform.style.top = `${buddyY - 10}px`;
      spinnerWrap.style.left = `${buddyX + 14}px`;
      spinnerWrap.style.top = `${buddyY - 9}px`;
    } else {
      // Default body style
      body.style.left = `${buddyX - half}px`;
      body.style.top = `${buddyY - half}px`;
      glow.style.left = `${buddyX - 21}px`;
      glow.style.top = `${buddyY - 21}px`;
      waveform.style.left = `${buddyX + half + 4}px`;
      waveform.style.top = `${buddyY - 10}px`;
      spinnerWrap.style.left = `${buddyX - 9}px`;
      spinnerWrap.style.top = `${buddyY - 9}px`;
    }
    bubble.style.left = `${buddyX + 10}px`;
    bubble.style.top = `${buddyY + half + 6}px`;
  }

  function updateEyes() {
    if (isCursorStyle) return;
    const half = BUDDY_SIZE / 2;
    let eyeOffX = Math.max(-3, Math.min(3, velX * 0.02));
    let eyeOffY = Math.max(-3, Math.min(3, velY * 0.02));

    if (isFlying) {
      const dx = flightEndX - buddyX;
      const dy = flightEndY - buddyY;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 1) { eyeOffX = (dx/d)*3; eyeOffY = (dy/d)*3; }
    }

    leftEye.style.left = `${buddyX - 5 + eyeOffX}px`;
    leftEye.style.top = `${buddyY - 2 + eyeOffY}px`;
    rightEye.style.left = `${buddyX + 2 + eyeOffX}px`;
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
    spinnerWrap.querySelector('svg').style.transform = `rotate(${spinnerAngle}deg)`;
  }

  // ---- State Colors ----
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
    // Update cursor pointer SVG gradient
    const stops = cursorPointer.querySelectorAll('stop');
    if (stops.length >= 2) {
      stops[0].setAttribute('stop-color', c.bg[0]);
      stops[1].setAttribute('stop-color', c.bg[1]);
    }
    const svg = cursorPointer.querySelector('svg');
    if (svg) svg.style.filter = `drop-shadow(0 0 8px ${c.bg[0]}80)`;
  }

  // ---- Flight ----
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

  // ---- Icon Style ----
  function setIconStyle(style) {
    isCursorStyle = style === 'cursor';
    body.style.display = isCursorStyle ? 'none' : 'block';
    leftEye.style.display = isCursorStyle ? 'none' : 'block';
    rightEye.style.display = isCursorStyle ? 'none' : 'block';
    glow.style.display = isCursorStyle ? 'none' : 'block';
    cursorPointer.style.display = isCursorStyle ? 'block' : 'none';
  }

  // ---- Speech Bubble ----
  let bubbleTimer = null;
  let bubbleHoldTimer = null;

  function showBubble(text) {
    bubble.textContent = '';
    bubble.style.display = 'block';
    bubble.style.animation = 'none';
    void bubble.offsetHeight;
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
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
      case 'state-changed': setVisualState(msg.state); break;
      case 'point-at': showPointGlow(msg.x, msg.y); flyTo(msg.x, msg.y, msg.label); break;
      case 'point-at-element': {
        const center = getElementCenter(msg.id, msg.label);
        if (center) {
          showPointGlow(center.x, center.y);
          flyTo(center.x, center.y, msg.label);
        }
        break;
      }
      case 'return-to-cursor': returnToCursor(); break;
      case 'show-message':
        showBubble(msg.text);
        setTimeout(() => { hideBubble(); }, 5000);
        break;
      case 'audio-power':
        audioPower = Math.min(1, Math.pow(msg.level, 0.76) * 2.85);
        break;
      case 'chat-entry':
        incrementChatBadge();
        break;
      case 'set-icon-style': setIconStyle(msg.style); break;
      case 'scan-elements':
        sendResponse(scanInteractiveElements());
        return true;
      case 'set-visibility':
        host.style.display = msg.visible ? '' : 'none';
        break;
      case 'set-shortcut':
        currentShortcut = msg.shortcut;
        break;
      case 'set-chat-visible':
        chatBtn.style.display = msg.visible ? '' : 'none';
        if (!msg.visible) { chatOpen = false; chatPanel.classList.remove('open'); }
        break;
    }
  });

  // ---- DOM Element Scanning (pixel-perfect pointing) ----
  let scannedElements = [];

  function scanInteractiveElements() {
    scannedElements = [];
    // Broad selectors to catch elements on modern React/SPA sites (Twitter, Facebook, etc.)
    const selectors = [
      'a[href]', 'button', 'input', 'select', 'textarea', 'summary',
      '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]',
      '[role="menuitemcheckbox"]', '[role="menuitemradio"]',
      '[role="checkbox"]', '[role="switch"]', '[role="option"]',
      '[role="treeitem"]', '[role="gridcell"]', '[role="searchbox"]',
      '[tabindex="0"]', '[tabindex="-1"]',
      '[data-testid]',
      '[onclick]', '[aria-label]',
      'nav a', 'nav div[role]',
    ].join(', ');

    const seen = new Set();
    const list = [];
    let id = 1;

    for (const el of document.querySelectorAll(selectors)) {
      if (id > 60) break;
      const rect = el.getBoundingClientRect();
      // Skip invisible or tiny
      if (rect.width < 4 || rect.height < 4) continue;
      if (rect.width === 0 || rect.height === 0) continue;
      // Skip off-screen
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;

      // Skip our own buddy elements
      if (el.closest('#__tico-buddy-host')) continue;

      // Deduplicate by position (within 10px grid)
      const cx = Math.round(rect.left + rect.width / 2);
      const cy = Math.round(rect.top + rect.height / 2);
      const posKey = `${Math.round(cx/20)*20},${Math.round(cy/20)*20}`;
      if (seen.has(posKey)) continue;
      seen.add(posKey);

      // Get best label
      const label = getElementLabel(el);
      if (!label || label.length < 1) continue;

      scannedElements.push({ id, el, label, cx, cy });
      list.push({ id, label, cx, cy });
      id++;
    }

    return list;
  }

  function getElementLabel(el) {
    // Priority: aria-label > title > alt > data-testid > text content > tag
    const aria = el.getAttribute('aria-label');
    if (aria?.trim()) return aria.trim().slice(0, 50);

    const title = el.getAttribute('title');
    if (title?.trim()) return title.trim().slice(0, 50);

    const alt = el.getAttribute('alt');
    if (alt?.trim()) return alt.trim().slice(0, 50);

    const testId = el.getAttribute('data-testid');
    if (testId?.trim()) return testId.replace(/[-_]/g, ' ').trim().slice(0, 50);

    // Get visible text, skip hidden children
    const text = el.textContent?.trim();
    if (text && text.length > 0 && text.length < 60) {
      return text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50);
    }

    return null;
  }

  function getElementCenter(id, label) {
    // Try exact ID match
    let entry = scannedElements.find(e => e.id === id);
    // Fallback: fuzzy label match (case-insensitive contains)
    if (!entry && label) {
      const lower = label.toLowerCase();
      entry = scannedElements.find(e =>
        e.label.toLowerCase().includes(lower) || lower.includes(e.label.toLowerCase())
      );
    }
    if (!entry?.el) return null;
    // Get FRESH bounding box (element may have moved since scan)
    const rect = entry.el.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  }

  // ---- Push-to-Talk (Configurable Shortcut) ----
  let isHolding = false;
  let currentShortcut = { key: 'KeyT', alt: true, ctrl: false, shift: false, meta: false };

  function matchesShortcut(e, s) {
    return e.code === s.key && e.altKey === s.alt && e.ctrlKey === s.ctrl && e.shiftKey === s.shift && e.metaKey === s.meta;
  }

  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in inputs
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;

    if (matchesShortcut(e, currentShortcut) && !e.repeat) {
      e.preventDefault();
      if (!isHolding) {
        isHolding = true;
        const elements = scanInteractiveElements();
        chrome.runtime.sendMessage({ type: 'hotkey-down', elements });
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!isHolding) return;
    const hasModifiers = currentShortcut.alt || currentShortcut.ctrl || currentShortcut.shift || currentShortcut.meta;
    if (hasModifiers) {
      // Release on modifier OR main key release
      const isShortcutKey = e.code === currentShortcut.key;
      const isRequiredModifier =
        (currentShortcut.alt && (e.code === 'AltLeft' || e.code === 'AltRight')) ||
        (currentShortcut.ctrl && (e.code === 'ControlLeft' || e.code === 'ControlRight')) ||
        (currentShortcut.shift && (e.code === 'ShiftLeft' || e.code === 'ShiftRight')) ||
        (currentShortcut.meta && (e.code === 'MetaLeft' || e.code === 'MetaRight'));
      if (isShortcutKey || isRequiredModifier) {
        isHolding = false;
        chrome.runtime.sendMessage({ type: 'hotkey-up' });
      }
    } else {
      // Single key shortcut (e.g. F8) — release on that key
      if (e.code === currentShortcut.key) {
        isHolding = false;
        chrome.runtime.sendMessage({ type: 'hotkey-up' });
      }
    }
  });

  // ---- Start ----
  requestAnimationFrame(render);
  chrome.runtime.sendMessage({ type: 'get-state' }, (res) => {
    if (res?.state) setVisualState(res.state);
  });
  chrome.storage.sync.get('tico_settings', (result) => {
    const s = result.tico_settings || {};
    if (s.iconStyle === 'cursor') setIconStyle('cursor');
    if (s.shortcut) currentShortcut = s.shortcut;
    if (s.chatHistoryEnabled === false) chatBtn.style.display = 'none';
  });
})();
