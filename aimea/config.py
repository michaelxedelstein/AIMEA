"""
Configuration and environment variables for AIMEA.
"""
import os

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Deepgram API key for real-time transcription
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

# Azure OpenAI configuration for summarization
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
# Ensure endpoint has no trailing slash
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "").rstrip("/")
AZURE_OPENAI_DEPLOYMENT_NAME = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
# Deepgram model and tier for improved accuracy
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL")      # e.g., "general"
DEEPGRAM_TIER = os.getenv("DEEPGRAM_TIER")        # e.g., "enhanced"
# Audio input device name for system audio capture (e.g., "BlackHole 2ch"); leave blank to use default mic
AIMEA_INPUT_DEVICE_NAME = os.getenv("AIMEA_INPUT_DEVICE_NAME") or None