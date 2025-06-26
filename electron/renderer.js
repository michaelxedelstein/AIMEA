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

/**
 * Classify a line for intent/topics and append to the UI
 */
async function classifyLine(line) {
  try {
    const res = await fetch('http://localhost:8000/classify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: line}),
    });
    const data = await res.json();
    // Append classification below the line
    const div = document.createElement('div');
    div.style.fontSize = '0.8rem';
    div.style.color = '#666';
    if (data.intent) {
      const lang = data.language ? `Lang: ${data.language}, ` : '';
      const topics = data.topics ? data.topics.join(', ') : '';
      div.textContent = `${lang}Intent: ${data.intent}` + (topics ? `, Topics: ${topics}` : '');
    } else if (data.error) {
      div.textContent = `Classification error: ${data.error}`;
    }
    transcriptDiv.appendChild(div);
  } catch (err) {
    console.error('Error classifying line:', err);
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
// Track lines already classified
const seen = new Set();
async function fetchBuffer() {
  try {
    const res = await fetch('http://localhost:8000/buffer');
    const data = await res.json();
    transcriptDiv.innerHTML = '';
    data.buffer.forEach(line => {
      // Render line
      const div = document.createElement('div');
      div.textContent = line;
      transcriptDiv.appendChild(div);
      // Classify new lines
      if (!seen.has(line)) {
        seen.add(line);
        classifyLine(line);
      }
    });
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