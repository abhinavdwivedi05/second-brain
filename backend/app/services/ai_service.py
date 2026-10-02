import asyncio
from typing import Any

from app.ai.provider_factory import get_ai_provider
from app.ai.base import BaseAIProvider

class AIService:
    """High-level service that delegates generation to the configured AI provider.

    The service isolates the FastAPI layer from provider specifics and centralises
    error handling. Future features (summarisation, tags, etc.) will build on top
    of this service.
    """

    def __init__(self) -> None:
        self._provider: BaseAIProvider = get_ai_provider()

    async def generate(self, prompt: str, system_prompt: str | None = None) -> str:
        """Generate text via the underlying provider.

        Args:
            prompt: The user supplied prompt.
            system_prompt: Optional system‑level instruction.
        Returns:
            Generated text.
        Raises:
            RuntimeError: If the provider raises an unexpected exception.
        """
        try:
            # Most providers expose a generic generate method; mock provider implements it.
            return await self._provider.generate(prompt, system_prompt)
        except Exception as exc:
            # Normalise any provider‑specific exception to a generic RuntimeError.
            raise RuntimeError("AI generation failed") from exc
