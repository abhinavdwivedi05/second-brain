from typing import List, Optional
from app.ai.provider_factory import get_ai_provider
from app.ai.base import BaseAIProvider

class AIService:
    """High-level service coordinating AI operations.
    
    Delegates to the configured AI provider (Gemini or Mock) and normalizes errors.
    """

    @property
    def provider(self) -> BaseAIProvider:
        return get_ai_provider()

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        return await self.provider.generate(prompt, system_prompt)

    async def summarize(self, content: str, title: Optional[str] = None) -> str:
        return await self.provider.summarize(content, title)

    async def extract_concepts(self, content: str) -> List[str]:
        return await self.provider.extract_concepts(content)

    async def suggest_tags(self, content: str, title: str) -> List[str]:
        return await self.provider.suggest_tags(content, title)

    async def chat(self, query: str, context: Optional[str] = None) -> str:
        return await self.provider.chat(query, context)

ai_service = AIService()
