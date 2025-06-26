"""
Real-time audio capture and transcription using Deepgram's WebSocket API.
"""
import asyncio


import pyaudio
from deepgram import DeepgramClient, LiveTranscriptionEvents

from aimea.buffer import RollingBuffer
from aimea.config import DEEPGRAM_API_KEY, AIMEA_INPUT_DEVICE_NAME


class Transcriber:
    """
    Captures audio from the default input device and streams it to Deepgram for transcription.
    Internally adds interim transcripts to the rolling buffer.
    """
    def __init__(self, buffer: RollingBuffer, sample_rate: int = 44100, channels: int = 2, block_size: int = 1024, input_device_name: str = None):
        self.buffer = buffer
        self.sample_rate = sample_rate
        self.channels = channels
        self.block_size = block_size
        self.input_device_name = input_device_name
        self.dg_client = DeepgramClient(DEEPGRAM_API_KEY)
    def set_input_device(self, device_name: str) -> None:
        """Update the input device name to capture from."""
        self.input_device_name = device_name

    async def stream_audio(self) -> None:
        """Start streaming audio to Deepgram and collecting interim transcripts."""
        audio_interface = pyaudio.PyAudio()
        # Select audio device: system audio via virtual driver or default microphone
        device_index = None
        if self.input_device_name:
            count = audio_interface.get_device_count()
            for i in range(count):
                info = audio_interface.get_device_info_by_index(i)
                if self.input_device_name.lower() in info.get('name', '').lower():
                    device_index = i
                    break
            if device_index is None:
                print(f"Warning: input device '{self.input_device_name}' not found. Using default device.")
        # Attempt to open audio stream with desired channel count, fallback to mono if unavailable
        try:
            open_args = dict(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.block_size,
            )
            if device_index is not None:
                open_args['input_device_index'] = device_index
            stream = audio_interface.open(**open_args)
        except OSError as e:
            if self.channels != 1:
                print(f"Warning: unable to open input with {self.channels} channels ({e}), falling back to mono.")
                self.channels = 1
                stream = audio_interface.open(
                    format=pyaudio.paInt16,
                    channels=self.channels,
                    rate=self.sample_rate,
                    input=True,
                    frames_per_buffer=self.block_size,
                )
            else:
                raise
        # Initialize Deepgram WebSocket client
        socket = self.dg_client.listen.asyncwebsocket.v("1")
        stop_event = asyncio.Event()
        # Log connection events for debugging
        async def _on_open(_, open, **kwargs):
            print("Deepgram WebSocket connection opened.")
        async def _on_metadata(_, metadata, **kwargs):
            print(f"Deepgram metadata received: {metadata}")
        socket.on(LiveTranscriptionEvents.Open, _on_open)
        socket.on(LiveTranscriptionEvents.Metadata, _on_metadata)

        async def _on_transcript(_, result, **kwargs):
            # Only buffer and print finalized transcripts to avoid repetition
            if not getattr(result, "is_final", False):
                return
            alt = result.channel.alternatives[0]
            transcript = alt.transcript.strip()
            # Determine speaker index if diarization is enabled
            speaker = None
            if hasattr(alt, 'words') and alt.words:
                speaker = getattr(alt.words[0], 'speaker', None)
            # Tag transcript with speaker
            if speaker is not None:
                entry = f"Speaker {speaker}: {transcript}"
            else:
                entry = transcript
            self.buffer.add(entry)
            print(entry)

        async def _on_close(_, close, **kwargs):
            stop_event.set()

        async def _on_error(_, error, **kwargs):
            print(f"Deepgram error: {error}")
            stop_event.set()

        socket.on(LiveTranscriptionEvents.Transcript, _on_transcript)
        socket.on(LiveTranscriptionEvents.Close, _on_close)
        socket.on(LiveTranscriptionEvents.Error, _on_error)

        # Start the WebSocket connection with proper audio parameters
        options = {
            "encoding": "linear16",
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "punctuate": True,
            "interim_results": True,
            "language": "en-US",
            # Enable Deepgram speaker diarization
            "diarize": True,
        }
        started = await socket.start(options)
        if not started:
            print("Failed to start Deepgram transcription stream.")
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()
            return

        # Send audio until the connection closes or an error occurs
        try:
            while not stop_event.is_set():
                try:
                    data = stream.read(self.block_size, exception_on_overflow=False)
                    sent = await socket.send(data)
                    if not sent:
                        break
                except Exception as e:
                    print(f"Error sending audio: {e}")
                    break
                await asyncio.sleep(0)
        finally:
            try:
                await socket.finish()
            except Exception:
                pass
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()