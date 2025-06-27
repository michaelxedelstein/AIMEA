"""
Real-time audio capture and transcription using Deepgram's WebSocket API.
"""
import asyncio


import pyaudio
from deepgram import DeepgramClient, LiveTranscriptionEvents

from aimea.buffer import RollingBuffer
from aimea.config import (
    DEEPGRAM_API_KEY,
    AIMEA_INPUT_DEVICE_NAME,
    DEEPGRAM_MODEL,
    DEEPGRAM_TIER,
    DEEPGRAM_LANGUAGES,
)


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
        self.language = None
        self.dg_client = DeepgramClient(DEEPGRAM_API_KEY)
    def set_input_device(self, device_name: str) -> None:
        """Update the input device name to capture from."""
        self.input_device_name = device_name
        self.language = self.language  # retain language

    def set_language(self, language: str) -> None:
        """Update the transcription language (e.g. 'en-US', 'es-ES')."""
        self.language = language
    
    async def _analyze_buffer(self) -> None:
        """Run summarization on the full buffer via Azure OpenAI."""
        try:
            contents = self.buffer.get_contents()
            if not contents:
                return
            summary = await self.summarizer.summarize(contents)
            print(f"[Buffer Summary] {summary}")
        except Exception as e:
            print(f"[Analyzer] summarize error: {e}")

    async def _classify_line(self, text: str) -> None:
        """Classify a single transcript line into language, intent, and topics via Azure OpenAI."""
        from aimea.config import AZURE_OPENAI_DEPLOYMENT_NAME
        import json
        prompt = (
            "You are an AI assistant that extracts the language (en or es), intent, and topics from a meeting transcript text. "
            "Return a JSON object with the following keys:\n"
            "- language: one of \"en\" or \"es\"\n"
            "- intent: one of \"schedule_meeting\", \"send_message\", \"action_item\", or \"other\"\n"
            "- topics: an array of short topic strings (e.g., \"budget\", \"roadmap\").\n"
            f"Text: {text}"
        )
        try:
            response = await self.summarizer.client.chat.completions.create(
                model=AZURE_OPENAI_DEPLOYMENT_NAME,
                messages=[{'role': 'user', 'content': prompt}],
            )
            content = response.choices[0].message.content.strip()
            try:
                result = json.loads(content)
            except Exception:
                result = {'error': 'Failed to parse classification', 'raw': content}
            print(f"[Classification] {result}")
        except Exception as e:
            print(f"[Analyzer] classification error: {e}")

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
            # Ensure we have a valid input device index
            open_args = dict(
                format=pyaudio.paInt16,
                channels=self.channels,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.block_size,
            )
            if device_index is not None:
                open_args['input_device_index'] = device_index
            else:
                # Try default input device
                try:
                    default_info = audio_interface.get_default_input_device_info()
                    open_args['input_device_index'] = int(default_info['index'])
                except Exception:
                    # Fallback: first available input device
                    for i in range(audio_interface.get_device_count()):
                        info = audio_interface.get_device_info_by_index(i)
                        if info.get('maxInputChannels', 0) > 0:
                            open_args['input_device_index'] = i
                            break
            stream = audio_interface.open(**open_args)
        except OSError as e:
            if self.channels != 1:
                print(f"Warning: unable to open with {self.channels} channels ({e}), trying mono.")
                self.channels = 1
                open_args['channels'] = 1
                # retry open with same input_device_index
                stream = audio_interface.open(**open_args)
            else:
                raise
        # Initialize Deepgram WebSocket client for transcription only
        socket = self.dg_client.listen.asyncwebsocket.v("1")
        stop_event = asyncio.Event()
        # Connection handlers
        async def _on_open(_, open, **kwargs):
            print("Deepgram WebSocket connection opened.")
        async def _on_metadata(_, metadata, **kwargs):
            print(f"Deepgram metadata received: {metadata}")
        socket.on(LiveTranscriptionEvents.Open, _on_open)
        socket.on(LiveTranscriptionEvents.Metadata, _on_metadata)
        # Transcript handler
        async def _on_transcript(_, result, **kwargs):
            if not getattr(result, "is_final", False):
                return
            alt = result.channel.alternatives[0]
            transcript = alt.transcript.strip()
            speaker = None
            if hasattr(alt, "words") and alt.words:
                speaker = getattr(alt.words[0], "speaker", None)
            entry = f"Speaker {speaker}: {transcript}" if speaker is not None else transcript
            self.buffer.add(entry)
            print(entry)
            # Trigger text-based analysis
            if hasattr(self, "summarizer"):
                asyncio.create_task(self._classify_line(transcript))
                asyncio.create_task(self._analyze_buffer())
        socket.on(LiveTranscriptionEvents.Transcript, _on_transcript)
        # Close and error handlers
        async def _on_close(_, close, **kwargs):
            stop_event.set()
        async def _on_error(_, error, **kwargs):
            print(f"Deepgram error: {error}")
            stop_event.set()
        socket.on(LiveTranscriptionEvents.Close, _on_close)
        socket.on(LiveTranscriptionEvents.Error, _on_error)
        # Start transcription stream
        options = {
            "encoding": "linear16",
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "punctuate": True,
            "interim_results": True,
            "diarize": True,
        }
        if self.language:
            options["language"] = self.language
        print(f"[Deepgram] Starting WS with options: {options}")
        started = await socket.start(options)
        if not started:
            print("Failed to start Deepgram transcription stream.")
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()
            return
        # Send audio until the stream closes
        try:
            while not stop_event.is_set():
                data = stream.read(self.block_size, exception_on_overflow=False)
                sent = await socket.send(data)
                if not sent:
                    break
                await asyncio.sleep(0)
        except Exception as e:
            print(f"Error sending audio: {e}")
        finally:
            try:
                await socket.finish()
            except Exception:
                pass
            stream.stop_stream()
            stream.close()
            audio_interface.terminate()