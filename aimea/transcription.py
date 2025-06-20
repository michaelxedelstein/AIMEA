"""
Real-time audio capture and transcription using Deepgram's WebSocket API.
"""
import asyncio
import json

import pyaudio
from deepgram import Deepgram

from aimea.buffer import RollingBuffer
from aimea.config import DEEPGRAM_API_KEY


class Transcriber:
    """
    Captures audio from the default input device and streams it to Deepgram for transcription.
    Internally adds interim transcripts to the rolling buffer.
    """
    def __init__(self, buffer: RollingBuffer, sample_rate: int = 44100, channels: int = 2, block_size: int = 1024):
        self.buffer = buffer
        self.sample_rate = sample_rate
        self.channels = channels
        self.block_size = block_size
        self.dg_client = Deepgram(DEEPGRAM_API_KEY)

    async def stream_audio(self) -> None:
        """Start streaming audio to Deepgram and collecting interim transcripts."""
        audio_interface = pyaudio.PyAudio()
        stream = audio_interface.open(
            format=pyaudio.paInt16,
            channels=self.channels,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.block_size,
        )
        try:
            socket = await self.dg_client.transcription.live({
                "punctuate": True,
                "interim_results": True,
                "language": "en-US",
            })

            async def send_audio() -> None:
                while True:
                    data = stream.read(self.block_size, exception_on_overflow=False)
                    await socket.send(data)
                    await asyncio.sleep(0)

            async def receive_transcripts() -> None:
                async for message in socket:
                    result = json.loads(message)
                    channel = result.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "").strip()
                        if transcript:
                            self.buffer.add(transcript)

            await asyncio.gather(send_audio(), receive_transcripts())
        finally:
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()