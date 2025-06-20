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