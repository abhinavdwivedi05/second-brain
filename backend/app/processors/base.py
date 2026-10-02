from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseDocumentProcessor(ABC):
    @abstractmethod
    async def process(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        """
        Parses document file payload and returns normalized content dictionary:
        {
            "extracted_text": str,
            "summary": str,
            "key_concepts": List[str],
            "metadata": Dict[str, Any]
        }
        """
        pass
