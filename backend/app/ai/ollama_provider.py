import json
import logging
from typing import List, Optional
import httpx
from app.ai.base import BaseAIProvider
from app.core.config import settings

logger = logging.getLogger(__name__)

class OllamaProvider(BaseAIProvider):
    """Local LLM answer generation provider using Ollama REST API.
    
    Guarantees:
    - 100% local CPU/GPU execution without paid API dependencies or API keys.
    - Grounded answer generation using retrieved context.
    - Strict, transparent error reporting when Ollama is offline or uninstalled.
    - Never silently falls back to external paid APIs.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0,
    ) -> None:
        self.base_url = (
            base_url
            or getattr(settings, "OLLAMA_BASE_URL", "http://127.0.0.1:11434")
        ).rstrip("/")
        self.model = (
            model
            or getattr(settings, "OLLAMA_MODEL", "llama3.2:1b")
        ).strip()
        self.timeout = timeout

    async def _post_generate(self, payload: dict) -> str:
        """Execute a POST request to Ollama /api/generate endpoint with error handling."""
        endpoint = f"{self.base_url}/api/generate"
        try:
            async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
                response = await client.post(endpoint, json=payload)

            if response.status_code == 200:
                data = response.json()
                return data.get("response", "").strip()

            elif response.status_code == 404:
                raise RuntimeError(
                    f"Ollama model '{self.model}' is not installed. "
                    f"Please run 'ollama pull {self.model}' in your terminal to download it."
                )
            else:
                raise RuntimeError(
                    f"Ollama returned HTTP error {response.status_code}: {response.text[:200]}"
                )

        except httpx.ConnectError:
            raise RuntimeError(
                f"Local AI service (Ollama) is not running or unreachable at {self.base_url}. "
                f"Please ensure Ollama is installed and running on your system ('ollama serve' or start the Ollama desktop app). "
                f"For offline development without Ollama, you can set AI_PROVIDER=mock in backend/.env."
            )
        except httpx.TimeoutException:
            raise RuntimeError(
                f"Ollama model '{self.model}' took longer than {self.timeout}s to respond. "
                f"For faster CPU inference, try a smaller model like 'llama3.2:1b' or 'qwen2.5:1.5b'."
            )
        except httpx.RequestError as req_err:
            raise RuntimeError(f"Network error communicating with Ollama: {str(req_err)}")

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Call Ollama /api/generate to generate text."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 1024,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        return await self._post_generate(payload)

    async def chat(self, query: str, context: Optional[str] = None) -> str:
        """Answer a user question grounded in retrieved knowledge context."""
        clean_query = (query or "").strip()
        if not clean_query:
            return "Please provide a question."

        system_prompt = (
            "You are the AI Knowledge Assistant for Second Brain, a personal knowledge operating system.\n"
            "Your objective is to answer the user's question based strictly on the retrieved knowledge notes provided.\n"
            "Rules to follow:\n"
            "1. Ground your response ONLY in the provided retrieved excerpts.\n"
            "2. If the excerpts do not contain enough information to answer the question, clearly state: "
            "\"I searched your Second Brain notes, but could not find enough information to answer this question.\"\n"
            "3. Do NOT hallucinate or assume facts that are not explicitly present in the provided notes.\n"
            "4. Cite the relevant document titles when referencing information.\n"
            "5. Be concise, direct, professional, and conversational."
        )

        if not context or not context.strip():
            user_prompt = (
                f"User Question: {clean_query}\n\n"
                f"[Notice: No relevant documents were found in the knowledge base matching this question.]"
            )
        else:
            user_prompt = (
                f"{context}\n\n"
                f"Based strictly on the excerpts above, answer the following question:\n"
                f"Question: {clean_query}"
            )

        return await self.generate(prompt=user_prompt, system_prompt=system_prompt)

    async def summarize(self, content: str, title: Optional[str] = None) -> str:
        """Generate a structured summary of a knowledge item."""
        clean_content = (content or "").strip()
        if not clean_content:
            return "No content provided to summarize."

        doc_title = title or "Knowledge Document"
        system_prompt = (
            "You are an expert technical summarizer. Provide a concise, highly readable summary "
            "with key takeaways and bullet points. Focus on architectural concepts, actionable insights, "
            "and core definitions."
        )
        prompt = (
            f"Document Title: {doc_title}\n\n"
            f"Content to summarize:\n{clean_content[:8000]}\n\n"
            f"Provide a structured summary:"
        )
        return await self.generate(prompt=prompt, system_prompt=system_prompt)

    async def extract_concepts(self, content: str) -> List[str]:
        """Extract key technical concepts and architectural topics from content."""
        clean_content = (content or "").strip()
        if not clean_content:
            return []

        system_prompt = (
            "Extract the 3 to 7 most important technical concepts, frameworks, architectures, or tools "
            "from the text. Output ONLY a comma-separated list of concepts (e.g. 'PostgreSQL, MVCC, Indexing'). "
            "Do not include bullet points, numbering, or introductory phrases."
        )
        prompt = f"Text to analyze:\n{clean_content[:4000]}\n\nComma-separated technical concepts:"
        raw = await self.generate(prompt=prompt, system_prompt=system_prompt)

        # Parse comma-separated concepts
        concepts = [c.strip().strip("-*• ") for c in raw.split(",") if c.strip()]
        return [c for c in concepts if len(c) > 1 and len(c) < 50][:7]

    async def suggest_tags(self, content: str, title: str) -> List[str]:
        """Suggest concise lowercase taxonomy tags."""
        clean_content = (content or "").strip()
        system_prompt = (
            "Suggest 3 to 5 concise lowercase taxonomy tags for organizing this document. "
            "Output ONLY a comma-separated list of tags, without hashes or symbols (e.g. 'database, postgresql, performance')."
        )
        prompt = f"Title: {title}\nContent:\n{clean_content[:3000]}\n\nTags:"
        raw = await self.generate(prompt=prompt, system_prompt=system_prompt)

        tags = [t.strip().lower().replace("#", "") for t in raw.split(",") if t.strip()]
        return [t for t in tags if len(t) > 1 and len(t) < 30][:5]
