document.getElementById('grant-btn').addEventListener('click', async () => {
  const status = document.getElementById('status');
  const btn = document.getElementById('grant-btn');
  btn.disabled = true;
  btn.textContent = 'Requesting...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => t.stop());
    status.textContent = 'Microphone enabled! You can close this tab.';
    status.className = 'status granted';
    btn.textContent = 'Done';
    btn.style.background = '#10b981';
    setTimeout(() => window.close(), 2000);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      status.innerHTML = 'Permission denied. Click the <strong>lock icon</strong> in the address bar above, find Microphone, and set it to <strong>Allow</strong>. Then click the button again.';
    } else {
      status.textContent = 'Error: ' + err.message;
    }
    status.className = 'status denied';
    btn.textContent = 'Try Again';
    btn.disabled = false;
  }
});
