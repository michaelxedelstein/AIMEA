const deviceSelect = document.getElementById('deviceSelect');
const applyBtn = document.getElementById('applyDevice');
const languageSelect = document.getElementById('languageSelect');
const applyLangBtn = document.getElementById('applyLanguage');
const transcriptDiv = document.getElementById('transcript');
const summaryDiv = document.getElementById('summaryText');
const summaryBtn = document.getElementById('summaryBtn');

// Regex to guard schedule prompts: explicit time or specific future day (e.g., tomorrow, next Monday)
const scheduleRegex = /\b(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b|\b(?:tomorrow|next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
// Mapping for number words to digits
const numberWords = {one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
// Parse natural date/time phrases into JS Date, or null if unable
function parseDateTime(text) {
  if (!text) return null;
  const now = new Date();
  let hour = null, minute = 0;
  // Time extraction: e.g. "at 3 pm" or "at three pm"
  const timeMatch = text.match(/at\s+((?:\d{1,2}|[a-z]+)(?::\d{2})?)\s*(am|pm)/i);
  if (timeMatch) {
    const tp = timeMatch[1].toLowerCase();
    const ampm = timeMatch[2].toLowerCase();
    let parts = tp.split(':');
    let h = parts[0];
    let m = parts[1] || '0';
    hour = isNaN(h) ? numberWords[h] || 0 : parseInt(h, 10);
    minute = isNaN(m) ? 0 : parseInt(m, 10);
    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;
  }
  // Day extraction: "next Monday" or "Monday"
  const dayMatch = text.match(/(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  let targetDate = new Date(now);
  if (dayMatch) {
    const isNext = Boolean(dayMatch[1]);
    const dayName = dayMatch[2].toLowerCase();
    const dayMap = {sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
    const dow = dayMap[dayName];
    let daysAhead = (dow - now.getDay() + 7) % 7;
    if (isNext) daysAhead = daysAhead === 0 ? 7 : daysAhead;
    targetDate.setDate(now.getDate() + daysAhead);
    if (hour !== null) targetDate.setHours(hour, minute, 0, 0);
    return targetDate;
  }
  // Fallback: only time --> today
  if (hour !== null) {
    targetDate.setHours(hour, minute, 0, 0);
    return targetDate;
  }
  return null;
}
// Prompt user to schedule a meeting with extracted context
async function schedulePrompt(triggerLine) {
  try {
    console.log('[schedulePrompt] triggered for:', triggerLine);
    const bufRes = await fetch('http://localhost:8000/buffer');
    const bufData = await bufRes.json();
    console.log('[schedulePrompt] buffer fetched', bufData.buffer.length, 'lines');
    // Extract phrase after "schedule ... meeting" for summary and parsing
    const phraseMatch = triggerLine.match(/schedule.*meeting(?: for| on)?\s+(.+)/i);
    let detailsPhrase = phraseMatch && phraseMatch[1] ? phraseMatch[1] : '';
    // Trim trailing punctuation
    detailsPhrase = detailsPhrase.replace(/[\.\!\?]$/, '').trim();
    // Build default summary
    const defaultSummary = detailsPhrase ? `Meeting: ${detailsPhrase}` : 'Follow-up meeting';
    // Parse start datetime from phrase, fallback to now
    const parsedStart = parseDateTime(detailsPhrase) || new Date();
    const start = parsedStart.toISOString();
    const end = new Date(parsedStart.getTime() + 30*60000).toISOString();
    const confirmMsg = `Schedule meeting with these details?\n` +
      `Title: ${defaultSummary}\n` +
      `Start: ${start}\n` +
      `End: ${end}\n`;
    const confirmOk = window.confirm(confirmMsg);
    if (!confirmOk) {
      console.log('[schedulePrompt] user cancelled scheduling');
      return;
    }
    const summary = defaultSummary;
    const attendees = [];
    console.log('[schedulePrompt] sending schedule request', { summary, description: triggerLine, start, end, attendees });
    const res2 = await fetch('http://localhost:8000/schedule', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({summary, description: triggerLine, start, end, attendees}),
    });
    const result2 = await res2.json();
    if (res2.ok) {
      console.log('[schedulePrompt] meeting scheduled, ID=', result2.event.id);
    } else {
      console.error('[schedulePrompt] error scheduling meeting:', result2.error);
    }
  } catch (err) {
    console.error('Error in schedulePrompt:', err);
  }
}
// Fetch available audio input devices
async function fetchDevices() {
  try {
    console.log('[fetchDevices] fetching devices');
    const res = await fetch('http://localhost:8000/devices');
    const data = await res.json();
    console.log('[fetchDevices] devices:', data.devices.map(d => d.name));
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
    console.log('[classifyLine] processing line:', line);
    const res = await fetch('http://localhost:8000/classify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({text: line}),
    });
    const data = await res.json();
    console.log('[classifyLine] received classification:', data);
    // Filter out false-positive send_message intents without explicit send/text keywords
    if (data.intent === 'send_message' && !/\b(send|message|text)\b/i.test(line)) {
      console.log('[classifyLine] filtered false-positive send_message for line:', line);
      data.intent = null;
    }
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
    // If scheduling intent detected, schedule delayed popup with context
    // Only trigger scheduling if we see 'schedule ... meeting' plus a valid time/day
    if (
      data.intent === 'schedule_meeting' &&
      /schedule.*meeting/i.test(line) &&
      scheduleRegex.test(line) &&
      !scheduledLines.has(line)
    ) {
      console.log('[classifyLine] schedule intent detected for line:', line);
      scheduledLines.add(line);
      setTimeout(() => schedulePrompt(line), 5000);
    }
  } catch (err) {
    console.error('Error classifying line:', err);
  }
}

// Track which lines have triggered a scheduling popup
const scheduledLines = new Set();
// Populate device list; poll until server is ready
fetchDevices();
// Populate devices until available
const devicePoll = setInterval(async () => {
  await fetchDevices();
  if (deviceSelect.options.length > 0) {
    clearInterval(devicePoll);
  }
}, 1000);
// Fetch languages
async function fetchLanguages() {
  try {
    console.log('[fetchLanguages] fetching languages');
    const res = await fetch('http://localhost:8000/languages');
    const data = await res.json();
    console.log('[fetchLanguages] languages:', data.languages.map(l => l.value));
    languageSelect.innerHTML = '';
    data.languages.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.value;
      opt.textContent = l.label;
      languageSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error fetching languages:', err);
  }
}
// Populate language selector
fetchLanguages();
// Handle language apply
applyLangBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('http://localhost:8000/language', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({language: languageSelect.value}),
    });
    const data = await res.json();
    console.log('Language set:', data.language);
  } catch (err) {
    console.error('Error selecting language:', err);
  }
});
applyBtn.addEventListener('click', applyDevice);

// Live buffer polling
// Track lines already classified
const seen = new Set();
async function fetchBuffer() {
  try {
    console.log('[fetchBuffer] fetching buffer');
    const res = await fetch('http://localhost:8000/buffer');
    const data = await res.json();
    console.log('[fetchBuffer] buffer received', data.buffer.length, 'lines');
    transcriptDiv.innerHTML = '';
    data.buffer.forEach(async line => {
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