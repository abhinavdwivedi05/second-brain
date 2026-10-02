import importlib
from typing import Optional

from app.core.config import settings
from app.ai.base import BaseAIProvider

# Registry of provider name to class path
_PROVIDER_REGISTRY = {
    "mock": "app.ai.mock_provider.MockAIProvider",
    # Add other providers here, e.g., "openai": "app.ai.openai_provider.OpenAIProvider"
}


def get_ai_provider() -> BaseAIProvider:
    """Return an instance of the configured AI provider.

    Raises:
        ValueError: If provider is not configured or unknown.
    """
    provider_name = getattr(settings, "AI_PROVIDER", "").lower()
    if not provider_name:
        raise ValueError("AI provider is not configured (AI_PROVIDER env var missing).")
    class_path = _PROVIDER_REGISTRY.get(provider_name)
    if not class_path:
        raise ValueError(f"Unsupported AI provider: {provider_name}")
    module_path, class_name = class_path.rsplit(".", 1)
    module = importlib.import_module(module_path)
    provider_cls = getattr(module, class_name)
    if not issubclass(provider_cls, BaseAIProvider):
        raise TypeError(f"{provider_name} does not implement BaseAIProvider.")
    return provider_cls()
