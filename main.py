"""
Entry point for running the AIMEA transcription and summarization.
"""
import asyncio

from aimea.buffer import RollingBuffer
from aimea.transcription import Transcriber
from aimea.summarizer import Summarizer


def main() -> None:
    """Start transcription and summarization tasks and run until interrupted."""
    buffer = RollingBuffer(window_seconds=120.0)
    transcriber = Transcriber(buffer)
    summarizer = Summarizer(buffer, interval=60.0)

    # Create a fresh event loop (avoids DeprecationWarning on get_event_loop)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.create_task(transcriber.stream_audio())
        loop.create_task(summarizer.run())
        loop.run_forever()
    except KeyboardInterrupt:
        print("Shutting down AIMEA...")
    finally:
        loop.stop()
        loop.close()


if __name__ == "__main__":
    main()