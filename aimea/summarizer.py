"""
Periodic summarization of transcript buffer using Azure OpenAI.
"""
import asyncio
import time
from openai import AsyncAzureOpenAI, NotFoundError

from aimea.config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_NAME,
)

 # (Using AsyncAzureOpenAI client directly)


class Summarizer:
    """
    Periodically summarizes the content of a RollingBuffer using Azure OpenAI.
    """
    def __init__(self, buffer, interval: float = 60.0):
        self.buffer = buffer
        self.interval = interval
        # Initialize Azure OpenAI client
        self.client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
            azure_deployment=AZURE_OPENAI_DEPLOYMENT_NAME,
            api_version=AZURE_OPENAI_API_VERSION,
            api_key=AZURE_OPENAI_API_KEY,
        )

    async def run(self) -> None:
        """Run the periodic summarization loop."""
        while True:
            await asyncio.sleep(self.interval)
            contents = self.buffer.get_contents()
            if not contents:
                continue
            try:
                summary = await self.summarize(contents)
            except NotFoundError as e:
                print(f"Error: Azure deployment '{AZURE_OPENAI_DEPLOYMENT_NAME}' not found. Please verify your AZURE_OPENAI_DEPLOYMENT_NAME and Azure resource settings.")
                continue
            except Exception as e:
                print(f"Error during summarization: {e}")
                continue
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
            print(f"\n[Summary at {timestamp}]\n{summary}\n")

    async def summarize(self, text: str) -> str:
        """Generate a summary for the given text using Azure OpenAI GPT-4."""
        prompt = (
            "You are an AI assistant specialized in summarizing meeting transcripts. "
            "Provide a concise summary of the following transcript:\n\n"
            f"{text}"
        )
        # Call Azure OpenAI via AsyncAzureOpenAI client
        # Azure deployments often only support the default temperature (1.0)
        # Omit the temperature parameter to use the service default.
        response = await self.client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[{"role": "user", "content": prompt}],
        )
        # Extract and return the assistant's reply
        return response.choices[0].message.content.strip()