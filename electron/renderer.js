const transcriptDiv = document.getElementById('transcript');
const summaryDiv = document.getElementById('summaryText');
const summaryBtn = document.getElementById('summaryBtn');

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