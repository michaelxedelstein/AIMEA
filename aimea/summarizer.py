"""
Periodic summarization of transcript buffer using Azure OpenAI.
"""
import asyncio
import time
from openai import AsyncAzureOpenAI, AsyncClient, NotFoundError

from aimea.config import (
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_API_VERSION,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_NAME,
    OPENAI_API_KEY,
    OPENAI_MODEL,
)

 # (Using AsyncAzureOpenAI client directly)


class Summarizer:
    """
    Periodically summarizes the content of a RollingBuffer using Azure OpenAI.
    """
    def __init__(self, buffer, interval: float = 60.0):
        self.buffer = buffer
        self.interval = interval
        # Initialize client: AsyncClient for OpenAI or AsyncAzureOpenAI for Azure
        if OPENAI_API_KEY:
            self.mode = "openai"
            self.client = AsyncClient(api_key=OPENAI_API_KEY)
            self.model = OPENAI_MODEL
        else:
            self.mode = "azure"
            self.client = AsyncAzureOpenAI(
                azure_endpoint=AZURE_OPENAI_ENDPOINT,
                azure_deployment=AZURE_OPENAI_DEPLOYMENT_NAME,
                api_version=AZURE_OPENAI_API_VERSION,
                api_key=AZURE_OPENAI_API_KEY,
            )
            self.model = AZURE_OPENAI_DEPLOYMENT_NAME
        print(f"[Config] Summarizer mode: {self.mode}, model: {self.model}")

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
        """Generate a summary for the given text using configured OpenAI client."""
        prompt = (
            "You are an AI assistant specialized in summarizing meeting transcripts. "
            "Provide a concise summary of the following transcript:\n\n"
            f"{text}"
        )
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content.strip()