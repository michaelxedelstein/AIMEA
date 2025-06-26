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

2. Install dependencies (into your Python environment):

   On macOS you may first need to install PortAudio so that PyAudio can compile:

   ```bash
   brew install portaudio
   ```

```bash
pip install -r requirements.txt
```

3. Run the application:

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

## Desktop UI (Electron)

We provide a cross-platform desktop app built with Electron to monitor live transcripts and get on-demand summaries.

Prerequisites:
 - Node.js (v16+)
 - Your Python server running (`python server.py`)

To launch the UI:
```bash
# In one terminal, start the Python server:
python server.py

# In another terminal, package and launch the Electron app:
cd electron
npm install
npm run build   # produces AIMEA.dmg on macOS (in dist/)
npm start       # or open the built DMG and launch the app
```

The window will show:
 - **Live Transcript** area (auto-updating every second)
 - **Get Summary** button and **Summary** display