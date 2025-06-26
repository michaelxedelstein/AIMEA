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
    contents = buffer.get_contents()
    return web.json_response({'buffer': contents})

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

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get('/buffer', handle_buffer)
    app.router.add_get('/summary', handle_summary)
    app.router.add_get('/devices', handle_devices)
    app.router.add_post('/device', handle_select_device)
    app.on_startup.append(start_transcription)
    app.on_cleanup.append(stop_transcription)
    return app

if __name__ == '__main__':
    web.run_app(create_app(), host='0.0.0.0', port=8000)