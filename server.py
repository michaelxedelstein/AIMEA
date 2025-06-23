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

def create_app() -> web.Application:
    app = web.Application()
    app.router.add_get('/buffer', handle_buffer)
    app.router.add_get('/summary', handle_summary)
    app.on_startup.append(start_transcription)
    app.on_cleanup.append(stop_transcription)
    return app

if __name__ == '__main__':
    web.run_app(create_app(), host='0.0.0.0', port=8000)