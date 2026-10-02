from abc import ABC, abstractmethod
from typing import List, Optional

class BaseAIProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Generic generation method.
        Implementations should return generated text based on the prompt.
        """
        pass

    @abstractmethod
    async def summarize(self, content: str, title: Optional[str] = None) -> str:
        pass

    @abstractmethod
    async def extract_concepts(self, content: str) -> List[str]:
        pass

    @abstractmethod
    async def suggest_tags(self, content: str, title: str) -> List[str]:
        pass

    @abstractmethod
    async def chat(self, query: str, context: Optional[str] = None) -> str:
        pass
