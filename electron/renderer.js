const deviceSelect = document.getElementById('deviceSelect');
const applyBtn = document.getElementById('applyDevice');
const transcriptDiv = document.getElementById('transcript');
const summaryDiv = document.getElementById('summaryText');
const summaryBtn = document.getElementById('summaryBtn');

// Fetch available audio input devices
async function fetchDevices() {
  try {
    const res = await fetch('http://localhost:8000/devices');
    const data = await res.json();
    deviceSelect.innerHTML = '';
    data.devices.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.name;
      opt.textContent = d.name;
      deviceSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching devices:', err);
  }
}

// Apply selected device
async function applyDevice() {
  const name = deviceSelect.value;
  try {
    await fetch('http://localhost:8000/device', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({device: name}),
    });
    console.log(`Selected device: ${name}`);
  } catch (err) {
    console.error('Error selecting device:', err);
  }
}

// Populate device list; poll until server is ready
fetchDevices();
const devicePoll = setInterval(async () => {
  await fetchDevices();
  if (deviceSelect.options.length > 0) {
    clearInterval(devicePoll);
  }
}, 1000);
applyBtn.addEventListener('click', applyDevice);

// Live buffer polling
async function fetchBuffer() {
  try {
    const res = await fetch('http://localhost:8000/buffer');
    const data = await res.json();
    transcriptDiv.textContent = data.buffer || '';
    transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
  } catch (err) {
    console.error('Error fetching buffer:', err);
  }
}

async function fetchSummary() {
  try {
    const res = await fetch('http://localhost:8000/summary');
    const data = await res.json();
    summaryDiv.textContent = data.summary || data.error || '';
  } catch (err) {
    console.error('Error fetching summary:', err);
  }
}

// Poll every second for live transcript
setInterval(fetchBuffer, 1000);
// Fetch summary when button clicked
summaryBtn.addEventListener('click', fetchSummary);