"""
Periodic summarization of transcript buffer using Azure OpenAI.
"""
import asyncio
import time

import openai

from aimea.config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_NAME,
)

# Configure OpenAI client for Azure OpenAI
openai.api_type = "azure"
openai.api_base = AZURE_OPENAI_ENDPOINT
openai.api_version = AZURE_OPENAI_API_VERSION
openai.api_key = AZURE_OPENAI_API_KEY


class Summarizer:
    """
    Periodically summarizes the content of a RollingBuffer using Azure OpenAI.
    """
    def __init__(self, buffer, interval: float = 60.0):
        self.buffer = buffer
        self.interval = interval

    async def run(self) -> None:
        """Run the periodic summarization loop."""
        while True:
            await asyncio.sleep(self.interval)
            contents = self.buffer.get_contents()
            if contents:
                summary = await self.summarize(contents)
                timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
                print(f"\n[Summary at {timestamp}]\n{summary}\n")

    async def summarize(self, text: str) -> str:
        """Generate a summary for the given text using Azure OpenAI GPT-4."""
        prompt = (
            "You are an AI assistant specialized in summarizing meeting transcripts. "
            "Provide a concise summary of the following transcript:\n\n"
            f"{text}"
        )
        response = await openai.ChatCompletion.acreate(
            engine=AZURE_OPENAI_DEPLOYMENT_NAME,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
        )
        return response.choices[0].message.content.strip()