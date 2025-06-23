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