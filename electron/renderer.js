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
  const timeMatch = text.match(/(?:at\s+)?((?:\d{1,2}|[a-z]+)(?::\d{2})?)\s*(am|pm)/i);
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
    // Fetch a concise meeting summary for details
    const sumRes = await fetch('http://localhost:8000/summary');
    const sumData = await sumRes.json();
    const summaryText = sumData.summary || '';
    console.log('[schedulePrompt] summary fetched:', summaryText);
    // Use simple static meeting title
    const title = 'Team Meeting';
    // Extract date/time phrase to compute start
    const phraseMatch = triggerLine.match(/schedule.*meeting(?: for| on)?\s+(.+)/i);
    const phrase = phraseMatch && phraseMatch[1] ? phraseMatch[1].replace(/[\.\!\?]$/, '').trim() : '';
    const parsedStart = parseDateTime(phrase) || new Date();
    // Prepare start/end times
    const start = parsedStart.toISOString();
    const end = new Date(parsedStart.getTime() + 30*60000).toISOString();
    const displayStart = parsedStart.toLocaleString();
    const displayEnd = new Date(parsedStart.getTime() + 30*60000).toLocaleString();
    // Build and show confirmation modal
    const attendees = [];
    const modal = document.createElement('div');
    Object.assign(modal.style, {
      position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
    });
    const box = document.createElement('div');
    Object.assign(box.style, {backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', width: '400px', maxWidth: '90%'});
    box.innerHTML = `
      <h3>Schedule Meeting</h3>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Start:</strong> ${displayStart}</p>
      <p><strong>End:</strong> ${displayEnd}</p>
      <details style="margin-bottom:1rem;"><summary>More Info</summary><p>${summaryText}</p></details>
    `;
    const btnConfirm = document.createElement('button');
    btnConfirm.textContent = 'Confirm';
    Object.assign(btnConfirm.style, {marginRight: '0.5rem'});
    const btnCancel = document.createElement('button');
    btnCancel.textContent = 'Cancel';
    box.appendChild(btnConfirm);
    box.appendChild(btnCancel);
    modal.appendChild(box);
    document.body.appendChild(modal);
    btnCancel.addEventListener('click', () => {
      console.log('[schedulePrompt] user cancelled scheduling');
      document.body.removeChild(modal);
    });
    btnConfirm.addEventListener('click', async () => {
      console.log('[schedulePrompt] sending schedule request', {title, description: summaryText, start, end, attendees});
      try {
        const res2 = await fetch('http://localhost:8000/schedule', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({summary: title, description: summaryText, start, end, attendees}),
        });
        const result2 = await res2.json();
        if (res2.ok) console.log('[schedulePrompt] meeting scheduled, ID=', result2.event.id);
        else console.error('[schedulePrompt] error scheduling meeting:', result2.error);
      } catch (err) {
        console.error('[schedulePrompt] error:', err);
      }
      document.body.removeChild(modal);
    });
  } catch (err) {
    console.error('Error in schedulePrompt:', err);
  }
}
// Track which lines have triggered a send_message popup
const messageLines = new Set();
/**
 * Prompt user to send an iMessage
 */
async function sendMessagePrompt(triggerLine) {
  try {
    console.log('[sendMessagePrompt] triggered for:', triggerLine);
    // Basic parsing: recipient and body
    // Extract recipient and body from trigger; fallback to user prompt
    let recipient = '';
    let body = '';
    const m = triggerLine.match(/send (?:a )?message to ([^,:]+?)[,:-]?\s*(.*)/i);
    if (m && m[1]) {
      recipient = m[1].trim();
      body = m[2]?.trim() || '';
    } else {
      recipient = window.prompt('Enter contact name:');
      if (!recipient) return;
    }
    console.log('[sendMessagePrompt] parsed recipient:', recipient);
    console.log('[sendMessagePrompt] parsed body:', body);
    if (!body) {
      body = window.prompt(`Enter message for ${recipient}:`);
      if (!body) return;
    }
    // Fetch contacts for disambiguation
    const cRes = await fetch('http://localhost:8000/contacts');
    const cData = await cRes.json();
    const recipientLower = recipient.toLowerCase();
    let matches = (cData.contacts || [])
      .filter(name => {
        const lower = name.toLowerCase();
        return lower.split(/\s+/).some(tok => tok.startsWith(recipientLower));
      })
      .sort((a, b) => {
        const aL = a.toLowerCase(), bL = b.toLowerCase();
        const aStart = aL.startsWith(recipientLower);
        const bStart = bL.startsWith(recipientLower);
        if (aStart && !bStart) return -1;
        if (bStart && !aStart) return 1;
        return aL.localeCompare(bL);
      });
    let chosen;
    if (matches.length === 0) {
      console.log(`[sendMessagePrompt] no contact match for '${recipient}'`);
      messageLines.delete(triggerLine);
      window.alert(`No contact found for '${recipient}'`);
      return;
    } else if (matches.length === 1) {
      chosen = matches[0];
    } else {
      // Disambiguation modal
      try {
        chosen = await new Promise((resolve, reject) => {
          const modal = document.createElement('div');
          Object.assign(modal.style, {position:'fixed',top:0,left:0,width:'100%',height:'100%',backgroundColor:'rgba(0,0,0,0.5)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000});
          const box = document.createElement('div');
          Object.assign(box.style, {backgroundColor:'#fff',padding:'1rem',borderRadius:'8px',width:'300px'});
          box.innerHTML = `<h3>Select contact for '${recipient}'</h3>`;
          const sel = document.createElement('select'); sel.id = 'contactSelect'; sel.style.width = '100%';
          matches.forEach(n => { const opt = document.createElement('option'); opt.textContent = n; sel.appendChild(opt); });
          box.appendChild(sel);
          const ok = document.createElement('button'); ok.textContent='OK'; ok.style.margin='0.5rem';
          const cancel = document.createElement('button'); cancel.textContent='Cancel';
          box.appendChild(ok); box.appendChild(cancel);
          modal.appendChild(box); document.body.appendChild(modal);
          ok.onclick = () => { const selVal = sel.value; document.body.removeChild(modal); resolve(selVal); };
          cancel.onclick = () => { document.body.removeChild(modal); reject(); };
        });
      } catch {
        console.log('[sendMessagePrompt] contact selection cancelled');
        // Allow retry on same line
        messageLines.delete(triggerLine);
        seen.delete(triggerLine);
        return;
      }
    }
    // Prepare message modal
    const msgModal = document.createElement('div');
    Object.assign(msgModal.style, {position:'fixed',top:0,left:0,width:'100%',height:'100%',backgroundColor:'rgba(0,0,0,0.5)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000});
    const msgBox = document.createElement('div');
    Object.assign(msgBox.style, {backgroundColor:'#fff',padding:'1rem',borderRadius:'8px',width:'400px',maxWidth:'90%'});
    msgBox.innerHTML = `<h3>Send iMessage to ${chosen}</h3><textarea id='msgBody' rows='4' style='width:100%'>${body}</textarea>`;
    const sendBtn = document.createElement('button'); sendBtn.textContent='Send'; sendBtn.style.margin='0.5rem';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancel';
    msgBox.appendChild(sendBtn); msgBox.appendChild(cancelBtn); msgModal.appendChild(msgBox); document.body.appendChild(msgModal);
    cancelBtn.onclick = () => {
      console.log('[sendMessagePrompt] message cancelled by user');
      messageLines.delete(triggerLine);
      seen.delete(triggerLine);
      document.body.removeChild(msgModal);
    };
    sendBtn.onclick = async () => {
      const msgBody = msgBox.querySelector('#msgBody').value;
      console.log('[sendMessagePrompt] sending message', {recipient: chosen, body: msgBody});
      try {
        const res = await fetch('http://localhost:8000/message', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient: chosen, body: msgBody})});
        const data = await res.json();
        if (res.ok) console.log('[sendMessagePrompt] message sent'); else console.error('[sendMessagePrompt] error:', data.error);
      } catch (err) {
        console.error('[sendMessagePrompt] error:', err);
      }
      document.body.removeChild(msgModal);
    };
  } catch (e) {
    console.error('[sendMessagePrompt] error:', e);
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
    // Handle send_message intent
    if (data.intent === 'send_message' && !messageLines.has(line)) {
      console.log('[classifyLine] send_message intent detected for line:', line);
      messageLines.add(line);
      // Delay prompt to gather additional context
      setTimeout(() => sendMessagePrompt(line), 5000);
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
      // Normalize spoken times: convert 'two pm' to '2 PM'
      let displayLine = line.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(am|pm)\b/gi, (_, w, ap) => {
        const num = numberWords[w.toLowerCase()] || w;
        return `${num} ${ap.toUpperCase()}`;
      });
      const div = document.createElement('div');
      div.textContent = displayLine;
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