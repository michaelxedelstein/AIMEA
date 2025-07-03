"""
Configuration and environment variables for AIMEA.
"""
import os

# Load environment variables from .env file, if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Deepgram API key for real-time transcription
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Azure OpenAI configuration for summarization
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
# Ensure endpoint has no trailing slash
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
# Regular OpenAI configuration for summarization and classification
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
# Default model for OpenAI API (e.g., "gpt-3.5-turbo")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
# Deepgram model and tier for improved accuracy
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL")      # e.g., "general"
DEEPGRAM_TIER = os.getenv("DEEPGRAM_TIER")        # e.g., "enhanced"
# Deepgram transcription languages (comma-separated), e.g. "en-US,es-ES"
DEEPGRAM_LANGUAGES = os.getenv("DEEPGRAM_LANGUAGES", "en-US,es-ES")
# Audio input device name for system audio capture (e.g., "BlackHole 2ch"); leave blank to use default mic
AIMEA_INPUT_DEVICE_NAME = os.getenv("AIMEA_INPUT_DEVICE_NAME") or None
# Google Calendar configuration
GOOGLE_CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")