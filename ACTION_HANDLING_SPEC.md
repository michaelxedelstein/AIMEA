# AIMEA Advanced Action Handling Specification

---

## ✅ Objective

Enable AIMEA to automatically detect and execute action items during meetings using Deepgram’s live transcription, summarization, and intent detection, while integrating directly with Google Calendar and iMessage (via AppleScript).

---

## ⚡️ Live Intent Detection Pipeline
* **Transcription Source:** Deepgram live transcription
* **Summarization:** Deepgram Audio Intelligence
* **Intent Analysis:** Deepgram Intent Detection (real-time stream)
* **Trigger Model:** When action intent is detected in transcript chunk
* **Debounce Logic:** Track recent action intents (timestamps + semantic comparison) to prevent duplicate triggers for the same item

---

## 🔹 Action 1: Schedule a Meeting

**Intent Detected:** `schedule_meeting`, `book_meeting`, `add_to_calendar`

**Action Flow:**
1. Parse relevant meeting context: participants, time, and topic.
2. Compare with previously handled scheduling intents to avoid duplicates.
3. Display a confirmation popup: _“Would you like AIMEA to schedule this meeting?”_
4. If confirmed:
   - Use Google Calendar API to:
     - Create the event
     - Invite users (using detected emails or contact names)
     - Set reminders if specified
5. Show a confirmation message in the UI.

**APIs Needed:**
- Google Calendar API (OAuth + calendar scopes)

---

## 🔹 Action 2: Send iMessage

**Intent Detected:** `send_message`, `text_person`, `remind_via_imessage`

**Action Flow:**
1. Parse transcript to extract recipient and message content.
2. Deduplicate against recently sent messages.
3. Display a confirmation popup: _“Send this message to [Name]?”_
4. If confirmed:
   - Generate or refine the message via Deepgram summary or OpenAI
   - Execute AppleScript:
     ```applescript
     tell application "Messages"
       send "{generated_message}" to buddy "{contact_name}" of (service 1 whose service type is iMessage)
     end tell
     ```
5. Log and display confirmation in the UI.

**Dependencies:**
- AppleScript support on macOS
- Contact lookup (Apple Contacts or manual import)

---

## 🤖 Vision for AIMEA as a Full Assistant
**Core Integrations Roadmap:**
- ✉️ Email (Gmail/Outlook APIs)
- 📅 Google Calendar
- 📱 iMessage via AppleScript
- 💬 Slack / Discord Webhooks
- 🔍 Google Search (Chrome Extension or Puppeteer)
- 📄 Google/Apple Contacts

**AI Models:**
- **Primary:** Deepgram for audio analysis & intent
- **Secondary:** Azure OpenAI for complex reasoning and fallback

**Goal:** Seamless voice- and transcript-based assistant that proactively manages scheduling, communications, reminders, search, and task delegation across platforms.
---