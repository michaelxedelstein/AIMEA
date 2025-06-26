# AIMEA

AIMEA is an AI-powered meeting assistant that transcribes meetings in real time, summarizes discussions every 30–60 seconds, detects intent, and can send messages or tasks via iMessage, Slack, Discord, or Google Calendar.

## Setup

1. Rename `.env.example` to `.env` and fill in your API keys:

```env
DEEPGRAM_API_KEY=<your_deepgram_key>
AZURE_OPENAI_API_KEY=<your_azure_openai_key>
AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_API_VERSION=2024-02-15-preview
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