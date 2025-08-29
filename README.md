# AIMEA

ARTIFICIAL INTELLIGENCE MEETING EXECUTIVE ASSISTANT, (AIMEA) is an AI-powered meeting assistant that transcribes meetings in real time, summarizes discussions every 30–60 seconds, detects intent, and can send messages or tasks via iMessage, Slack, Discord, or Google Calendar.

## Setup

1. Rename `.env.example` to `.env` and fill in your API keys:

```env
DEEPGRAM_API_KEY=<your_deepgram_key>
# (Optional) use an enhanced Deepgram model and tier for higher accuracy
DEEPGRAM_MODEL=general
DEEPGRAM_TIER=enhanced
# (Optional) comma-separated languages for Deepgram, e.g. en-US,es-ES
DEEPGRAM_LANGUAGES=en-US,es-ES

# Azure OpenAI configuration (used if OPENAI_API_KEY is not set)
AZURE_OPENAI_API_KEY=<your_azure_openai_key>
AZURE_OPENAI_ENDPOINT=https://<your-azure-resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=<your-deployment-name>
AZURE_OPENAI_API_VERSION=<azure-api-version>

# (Optional) Regular OpenAI configuration (overrides Azure when set)
OPENAI_API_KEY=<your_openai_api_key>
OPENAI_MODEL=gpt-3.5-turbo

# Google Calendar integration
# Path to your service account JSON key file
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-service-account.json
# Calendar ID (default: primary)
GOOGLE_CALENDAR_ID=primary
```


2. Install dependencies (into your Python virtual environment):

   On macOS you may first need to install PortAudio so that PyAudio can compile:

   ```bash
   brew install portaudio
   ```

   Create and activate a Python venv, then install:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate      # on Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. System Audio Capture (Phase 1):
   - Install a virtual audio device to merge mic + system audio.
     * macOS: `brew install blackhole-2ch`
     * Windows: install Virtual Audio Cable or similar.
   - Launch the app and in the **Input Device** dropdown, select the merged virtual device (e.g. “BlackHole 2ch” or your combined device), then click **Apply**.
     The app will switch to that device for capturing both microphone and system audio during the session.

4. Run the application:

```bash
python main.py
```

## Testing Summarization

You can verify your Azure OpenAI deployment directly with curl before waiting for the periodic summary:

```bash
curl -X POST \
  "${AZURE_OPENAI_ENDPOINT%/}/openai/deployments/${AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}" \
  -H "Content-Type: application/json" \
  -H "api-key: $AZURE_OPENAI_API_KEY" \
  -d '{
    "messages":[{"role":"user","content":"Test summary"}],
    "temperature":1
  }'
```

If you receive a 404, double check that your `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT_NAME`, and `AZURE_OPENAI_API_VERSION` exactly match your Azure resource settings.

## Developer Build (Phase 1)

For development/testing only (dev mode), you can skip packaging and run directly:
```bash
# Start the Python backend in one terminal (from project root):
source .venv/bin/activate      # activate your venv
python server.py               # starts server on port 8000
```
```bash
# In another terminal, launch the Electron UI (must be run inside electron folder):
cd electron
npm install                    # first time only
npm start                      # runs the UI against your dev server
```
To produce the self-contained desktop app (includes server + UI):

1. Create a Python virtual environment and install dependencies:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate      # Windows: .venv\\Scripts\\activate
   pip install -r requirements.txt
   ```

2. Install PyInstaller if not already present:
   ```bash
   pip install pyinstaller
   ```

3. Build the Python backend into a single executable:
   ```bash
   python3 -m PyInstaller --onefile --distpath electron/dist/server server.py
   ```

4. Prepare audio driver installers:
   - Create a folder `electron/resources/` and download the macOS or Windows installer:
     * macOS: BlackHole 2ch `.pkg` from https://github.com/ExistentialAudio/BlackHole/releases
       → Place it as `electron/resources/BlackHole2ch.pkg`
     * Windows: VB-Cable `.exe` from https://vb-audio.com/Cable/index.htm
       → Place it as `electron/resources/VB-Cable_Setup.exe`

4. Build the Electron app:
   ```bash
   cd electron
   npm install
   npm run build   # packages into dist/ (DMG on macOS, NSIS on Windows)
   ```

## Desktop UI (Electron)

We provide a cross-platform desktop app built with Electron to monitor live transcripts and get on-demand summaries.

Prerequisites:
 - Node.js (v16+)
 - Your Python server running (`python server.py`)

### Launching the Desktop App
After building, install and run the packaged AIMEA app without opening terminals:
- macOS: open the `.dmg` in `electron/dist`, drag **AIMEA** to `/Applications`, then double-click it.
- Windows: run the `AIMEA Setup.exe` installer in `electron\dist`, and launch **AIMEA** from the Start menu.

On first run:
- The OS will prompt for microphone permission—click **Allow**.
- In the **Input Device** dropdown, select your merged virtual device and click **Apply**.
- AIMEA will start live transcription and allow on-demand summaries.

The window will show:
 - **Live Transcript** area (auto-updating every second)
 - **Get Summary** button and **Summary** display

## Quick Start Guide (for New Users)

1. Clone this repository and enter its directory:
   ```bash
   git clone <your-repo-url>
   cd aime-n8n
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate      # Windows: .venv\\Scripts\\activate
   ```
3. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Rename `.env.example` to `.env` and populate your keys:
   - See the `.env` example above for all required variables.
   - To use regular OpenAI instead of Azure, set `OPENAI_API_KEY`.
5. (macOS only) Install PortAudio and BlackHole for audio capture:
   ```bash
   brew install portaudio
   brew install blackhole-2ch
   ```
6. Start the Python backend server:
   ```bash
   python server.py
   ```
7. In a new terminal, launch the Electron UI:
   ```bash
   cd electron
   npm install
   npm start
   ```
8. Verify functionality via API endpoints:
   - Summary: `curl -i http://localhost:8000/summary`
   - Classification:
     ```bash
     curl -i -X POST http://localhost:8000/classify \
          -H "Content-Type: application/json" \
          -d '{"text":"Schedule a meeting for next Tuesday."}'
     ```
9. When development is complete, follow the **Developer Build** and **Desktop UI** sections above to package and install the full app.

---

## Advanced Action Handling

For a detailed design and workflow of AIMEA’s automatic action item detection and execution (e.g., scheduling meetings, sending iMessages), see [ACTION_HANDLING_SPEC.md](./ACTION_HANDLING_SPEC.md).
