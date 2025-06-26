#!/usr/bin/env python3
"""
Simple HTTP server exposing AIMEA transcription buffer and on-demand summarization endpoints.
"""
import asyncio
import contextlib
from aiohttp import web

from aimea.buffer import RollingBuffer
from aimea.transcription import Transcriber
from aimea.summarizer import Summarizer
from aimea.config import (
    AZURE_OPENAI_DEPLOYMENT_NAME,
    DEEPGRAM_API_KEY,
    DEEPGRAM_MODEL,
    DEEPGRAM_TIER,
    DEEPGRAM_LANGUAGES,
)
print(f"[Config] Azure deployment name: '{AZURE_OPENAI_DEPLOYMENT_NAME}'")
print(f"[Config] Deepgram API key set? {'yes' if DEEPGRAM_API_KEY else 'no'}, model={DEEPGRAM_MODEL}, tier={DEEPGRAM_TIER}, languages={DEEPGRAM_LANGUAGES}")
import pyaudio

# Shared buffer and services
buffer = RollingBuffer(window_seconds=120.0)
transcriber = Transcriber(buffer)
# Disable periodic summarization by setting a large interval
summarizer = Summarizer(buffer, interval=3600.0)

async def start_transcription(app: web.Application) -> None:
    """Start the transcription stream in the background on server startup."""
    app['transcription_task'] = asyncio.create_task(transcriber.stream_audio())

async def stop_transcription(app: web.Application) -> None:
    """Cancel the transcription task on server shutdown."""
    task = app.get('transcription_task')
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task

async def handle_buffer(request: web.Request) -> web.Response:
    """Return the current contents of the rolling buffer."""
    # Return list of buffered transcript entries (with speaker tags)
    # Access internal deque: list of (timestamp, text)
    entries = [text for (_, text) in buffer._buffer]
    return web.json_response({'buffer': entries})

async def handle_summary(request: web.Request) -> web.Response:
    """Generate and return a summary of the current buffer contents."""
    contents = buffer.get_contents()
    try:
        if not contents:
            summary = ''
        else:
            summary = await summarizer.summarize(contents)
        return web.json_response({'summary': summary})
    except Exception as e:
        # Log exception and return error message
        print(f"Exception in /summary: {e}")
        import traceback; traceback.print_exc()
        return web.json_response({'error': str(e)}, status=500)
    
async def handle_devices(request: web.Request) -> web.Response:
    """List available input devices."""
    audio = pyaudio.PyAudio()
    devices = []
    for i in range(audio.get_device_count()):
        info = audio.get_device_info_by_index(i)
        if info.get('maxInputChannels', 0) > 0:
            devices.append({'name': info.get('name'), 'index': i})
    audio.terminate()
    return web.json_response({'devices': devices})

async def handle_select_device(request: web.Request) -> web.Response:
    """Select a new input device and restart transcription."""
    data = await request.json()
    device = data.get('device')
    transcriber.set_input_device(device)
    # Restart transcription task
    task = request.app.get('transcription_task')
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    request.app['transcription_task'] = asyncio.create_task(transcriber.stream_audio())
    return web.json_response({'status': 'ok', 'device': device})
    
async def handle_languages(request: web.Request) -> web.Response:
    """List supported transcription languages."""
    langs = []
    for tag in DEEPGRAM_LANGUAGES.split(','):
        code = tag.split('-')[0]  # Deepgram streaming expects simple codes like 'en' or 'es'
        label = 'English' if code == 'en' else 'Español' if code == 'es' else tag
        langs.append({'value': code, 'label': label})
    return web.json_response({'languages': langs})

async def handle_select_language(request: web.Request) -> web.Response:
    """Select transcription language and restart transcription."""
    data = await request.json()
    lang = data.get('language')
    transcriber.set_language(lang)
    # Restart transcription task
    task = request.app.get('transcription_task')
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task
    request.app['transcription_task'] = asyncio.create_task(transcriber.stream_audio())
    return web.json_response({'status': 'ok', 'language': lang})
    
async def handle_classify(request: web.Request) -> web.Response:
    """Classify a transcript line into intent and topics using Azure OpenAI."""
    data = await request.json()
    text = data.get('text', '')
    if not text:
        return web.json_response({'error': 'No text provided'}, status=400)
    try:
        # Prompt for language, intent, and topic classification
        prompt = (
            "You are an AI assistant that extracts the language (en or es), intent, and topics from a meeting transcript text. "
            "Return a JSON object with the following keys:\n"
            "- language: one of \"en\" or \"es\"\n"
            "- intent: one of \"schedule_meeting\", \"send_message\", \"action_item\", or \"other\"\n"
            "- topics: an array of short topic strings (e.g., \"budget\", \"roadmap\").\n"
            f"Text: {text}"
        )
        response = await summarizer.client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[{'role': 'user', 'content': prompt}],
        )
        content = response.choices[0].message.content.strip()
        import json
        try:
            result = json.loads(content)
        except Exception:
            result = {'error': 'Failed to parse classification', 'raw': content}
        return web.json_response(result)
    except Exception as e:
        return web.json_response({'error': str(e)}, status=500)

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get('/buffer', handle_buffer)
    app.router.add_get('/summary', handle_summary)
    app.router.add_get('/devices', handle_devices)
    app.router.add_post('/device', handle_select_device)
    app.router.add_get('/languages', handle_languages)
    app.router.add_post('/language', handle_select_language)
    # Start transcription only after user selects an input device via /device endpoint
    # app.on_startup.append(start_transcription)
    app.on_cleanup.append(stop_transcription)
    app.router.add_post('/classify', handle_classify)
    return app

if __name__ == '__main__':
    web.run_app(create_app(), host='0.0.0.0', port=8000)