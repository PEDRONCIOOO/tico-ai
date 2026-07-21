let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;
let analyser = null;
let audioContext = null;
let powerInterval = null;
let audioElement = null;
let recordingTimeout = null;
let playbackVolume = 1.0;

const MAX_RECORDING_MS = 60000;

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
    case 'set-volume':
      playbackVolume = Math.max(0, Math.min(1, msg.volume));
      if (audioElement) audioElement.volume = playbackVolume;
      sendResponse({ ok: true });
      break;
  }
});

async function startRecording() {
  audioChunks = [];
  audioStream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(audioStream);
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);

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
  mediaRecorder.start(100);

  recordingTimeout = setTimeout(() => {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
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
    audioElement.volume = playbackVolume;
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
