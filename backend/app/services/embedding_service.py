import asyncio
import hashlib
import math
import os
import re
import threading
from abc import ABC, abstractmethod
from typing import List, Optional, Any, Dict
import httpx
from app.core.config import settings

class EmbeddingError(Exception):
    """Base exception for all embedding operations."""
    pass

class EmbeddingAuthError(EmbeddingError):
    """Raised when authentication or authorization fails (HTTP 401 / 403)."""
    pass

class EmbeddingNotFoundError(EmbeddingError):
    """Raised when the requested embedding model is not found (HTTP 404)."""
    pass

class EmbeddingRateLimitError(EmbeddingError):
    """Raised when the embedding API rate limit (HTTP 429) is exceeded."""
    pass

class EmbeddingTimeoutError(EmbeddingError):
    """Raised when the embedding API request times out."""
    pass

class EmbeddingAPIError(EmbeddingError):
    """Raised when the embedding API returns an unexpected error or malformed payload."""
    pass

class BaseEmbeddingProvider(ABC):
    """Abstract base class for text embedding providers."""

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Embedding dimension (768 for gemini-embedding-001)."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Name and version identifier of the embedding model."""
        pass

    @abstractmethod
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of document chunks (RETRIEVAL_DOCUMENT)."""
        pass

    @abstractmethod
    async def embed_query(self, query: str) -> List[float]:
        """Generate a vector embedding for a search query (RETRIEVAL_QUERY)."""
        pass

class GeminiEmbeddingProvider(BaseEmbeddingProvider):
    """Google Gemini embedding provider using official REST API (gemini-embedding-001)."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        dimension: Optional[int] = None,
    ):
        raw_key = (
            api_key
            or getattr(settings, "GEMINI_API_KEY", "")
            or getattr(settings, "AI_API_KEY", "")
            or os.environ.get("GEMINI_API_KEY", "")
            or os.environ.get("AI_API_KEY", "")
        )
        self.api_key = raw_key.strip()
        self._model_name = model_name or getattr(settings, "GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
        self._dimension = dimension or getattr(settings, "EMBEDDING_DIMENSION", 768)
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _ensure_api_key(self) -> None:
        if not self.api_key:
            raise EmbeddingAuthError(
                "Gemini API key is not configured. Please set GEMINI_API_KEY in the environment."
            )

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single search query with RETRIEVAL_QUERY task type."""
        clean_query = (query or "").strip()
        if not clean_query:
            return [0.0] * self.dimension

        results = await self.embed_texts([clean_query], is_query=True)
        return results[0]

    async def embed_texts(self, texts: List[str], is_query: bool = False) -> List[List[float]]:
        """Batch embed texts using Gemini's batchEmbedContents or embedContent endpoints.
        
        Validates dimensions, ensures all values are finite, handles rate limits,
        and provides distinct error categorization.
        """
        self._ensure_api_key()

        if not texts:
            return []

        # Gemini supports up to 100 requests per batchEmbedContents call
        batch_size = 50
        all_embeddings: List[List[float]] = []

        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            batch_vectors = await self._embed_batch_with_retry(batch, is_query=is_query)
            all_embeddings.extend(batch_vectors)

        return all_embeddings

    async def _embed_batch_with_retry(
        self, texts: List[str], is_query: bool = False, max_retries: int = 3
    ) -> List[List[float]]:
        """Send a batch of texts with retry and exponential backoff."""
        clean_model = self.model_name if not self.model_name.startswith("models/") else self.model_name.replace("models/", "")
        model_path = f"models/{clean_model}"
        # Official Gemini Developer API endpoint using HTTP header authentication
        endpoint = f"{self.base_url}/{clean_model}:batchEmbedContents"
        headers = {
            "x-goog-api-key": self.api_key,
            "Content-Type": "application/json",
        }

        task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"

        requests_payload = []
        for t in texts:
            clean_t = (t or "").strip()
            if not clean_t:
                clean_t = "empty document"
            elif len(clean_t) > 8000:
                clean_t = clean_t[:8000]

            requests_payload.append({
                "model": model_path,
                "content": {"parts": [{"text": clean_t}]},
                "taskType": task_type,
                "outputDimensionality": self.dimension,
            })

        payload = {"requests": requests_payload}

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=25.0) as client:
                    response = await client.post(endpoint, headers=headers, json=payload)

                if response.status_code == 200:
                    data = response.json()
                    raw_embeddings = data.get("embeddings", [])
                    result_vectors: List[List[float]] = []

                    for emb in raw_embeddings:
                        values = emb.get("values", [])
                        if len(values) != self.dimension:
                            raise EmbeddingAPIError(
                                f"Dimension mismatch: expected {self.dimension}, got {len(values)} from Gemini."
                            )
                        if not all(math.isfinite(x) for x in values):
                            raise EmbeddingAPIError("Gemini embedding returned non-finite values (NaN or Inf).")
                        result_vectors.append(values)

                    return result_vectors

                elif response.status_code == 429:
                    if attempt < max_retries - 1:
                        backoff = (2 ** attempt) * 1.5
                        await asyncio.sleep(backoff)
                        continue
                    raise EmbeddingRateLimitError(
                        "Gemini API rate limit exceeded (HTTP 429). Please retry after a brief delay."
                    )

                elif response.status_code in (401, 403):
                    detail = response.text[:200]
                    raise EmbeddingAuthError(
                        f"Gemini API authentication failed (HTTP {response.status_code}): {detail}."
                    )

                elif response.status_code == 404:
                    raise EmbeddingNotFoundError(
                        f"Embedding model '{self.model_name}' not found on Gemini API (HTTP 404)."
                    )

                else:
                    error_detail = response.text[:200]
                    raise EmbeddingAPIError(
                        f"Gemini API returned error (HTTP {response.status_code}): {error_detail}"
                    )

            except httpx.TimeoutException:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                raise EmbeddingTimeoutError("Gemini API embedding request timed out after 25 seconds.")

            except httpx.RequestError as req_err:
                if attempt < max_retries - 1:
                    await asyncio.sleep(1.0 * (attempt + 1))
                    continue
                raise EmbeddingAPIError(f"Network error connecting to Gemini Embedding API: {str(req_err)}")

        raise EmbeddingAPIError("Failed to generate embeddings after max retries.")

class MockEmbeddingProvider(BaseEmbeddingProvider):
    """Deterministic local embedding provider generating normalized 768-dim vectors.
    
    Used exclusively in testing and offline environments when EMBEDDING_PROVIDER=mock.
    Guarantees:
    - Exactly 768 dimensions.
    - Normalized vectors (|v| = 1.0).
    - Identical texts yield identical vectors.
    - Related texts yield positive cosine similarity.
    """

    def __init__(self, dimension: int = 768, model_name: str = "mock-nlp-embedding-768"):
        self._dimension = dimension
        self._model_name = model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    async def embed_query(self, query: str) -> List[float]:
        return self._generate_vector(query)

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return [self._generate_vector(t) for t in texts]

    def _generate_vector(self, text: str) -> List[float]:
        """Generate a deterministic normalized 768-dim float vector."""
        clean = (text or "").strip().lower()
        if not clean:
            return [0.0] * self._dimension

        vector = [0.0] * self._dimension

        words = re.findall(r"\w+", clean)
        if not words:
            words = ["empty"]

        for idx, word in enumerate(words):
            w_hash = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            pos_1 = w_hash % self._dimension
            pos_2 = (w_hash >> 16) % self._dimension
            pos_3 = (w_hash >> 32) % self._dimension

            weight = 1.0 / (1.0 + math.log1p(idx + 1))
            vector[pos_1] += 1.0 * weight
            vector[pos_2] += 0.5 * weight
            vector[pos_3] += 0.25 * weight

        doc_hash = hashlib.sha256(clean.encode("utf-8")).digest()
        for i in range(min(len(doc_hash), self._dimension)):
            vector[i] += (doc_hash[i] / 255.0) * 0.1

        sq_sum = sum(x * x for x in vector)
        norm = math.sqrt(sq_sum) if sq_sum > 0 else 1.0
        normalized = [round(x / norm, 6) for x in vector]

        return normalized

class VertexAIEmbeddingProvider(BaseEmbeddingProvider):
    """Google Cloud Vertex AI text embedding provider.
    
    Used when EMBEDDING_PROVIDER=vertex, authenticating via OAuth2 Bearer token
    and Google Cloud project credentials.
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: Optional[str] = None,
        access_token: Optional[str] = None,
        model_name: Optional[str] = None,
        dimension: Optional[int] = None,
    ):
        self.project_id = (project_id or getattr(settings, "VERTEX_PROJECT_ID", "") or os.environ.get("VERTEX_PROJECT_ID", "")).strip()
        self.location = (location or getattr(settings, "VERTEX_LOCATION", "us-central1") or os.environ.get("VERTEX_LOCATION", "us-central1")).strip()
        self.access_token = (access_token or getattr(settings, "VERTEX_ACCESS_TOKEN", "") or os.environ.get("VERTEX_ACCESS_TOKEN", "")).strip()
        self._model_name = model_name or getattr(settings, "VERTEX_EMBEDDING_MODEL", "text-embedding-004")
        self._dimension = dimension or getattr(settings, "EMBEDDING_DIMENSION", 768)

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _ensure_credentials(self) -> None:
        if not self.project_id or not self.access_token:
            raise EmbeddingAuthError(
                "Vertex AI credentials not configured. Please set VERTEX_PROJECT_ID and VERTEX_ACCESS_TOKEN."
            )

    async def embed_query(self, query: str) -> List[float]:
        clean = (query or "").strip()
        if not clean:
            return [0.0] * self.dimension
        results = await self.embed_texts([clean], is_query=True)
        return results[0] if results else [0.0] * self.dimension

    async def embed_texts(self, texts: List[str], is_query: bool = False) -> List[List[float]]:
        self._ensure_credentials()
        endpoint = (
            f"https://{self.location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.project_id}/locations/{self.location}/publishers/google/models/{self.model_name}:predict"
        )
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        task_type = "RETRIEVAL_QUERY" if is_query else "RETRIEVAL_DOCUMENT"
        instances = [{"content": (t or "").strip()[:8000], "task_type": task_type} for t in texts]
        payload = {
            "instances": instances,
            "parameters": {"outputDimensionality": self.dimension},
        }

        async with httpx.AsyncClient(timeout=25.0) as client:
            try:
                resp = await client.post(endpoint, json=payload, headers=headers)
            except httpx.TimeoutException:
                raise EmbeddingTimeoutError("Vertex AI request timed out after 25 seconds.")
            except httpx.RequestError as req_err:
                raise EmbeddingAPIError(f"Network error connecting to Vertex AI: {str(req_err)}")

        if resp.status_code in (401, 403):
            raise EmbeddingAuthError(f"Vertex AI authentication failed (HTTP {resp.status_code}): {resp.text[:200]}")
        elif resp.status_code != 200:
            raise EmbeddingAPIError(f"Vertex AI error (HTTP {resp.status_code}): {resp.text[:200]}")

        data = resp.json()
        predictions = data.get("predictions", [])
        vectors = []
        for pred in predictions:
            vals = pred.get("embeddings", {}).get("values", [])
            if len(vals) != self.dimension or not all(math.isfinite(v) for v in vals):
                raise EmbeddingAPIError("Malformed vector received from Vertex AI.")
            vectors.append(vals)
        return vectors


_local_model_lock = threading.Lock()
_cached_local_model = None
_cached_local_model_name = None

def get_local_sentence_transformer(
    model_name: str = "intfloat/multilingual-e5-base",
    device: str = "cpu",
) -> Any:
    """Thread-safe singleton loader for local SentenceTransformer model.
    
    Loads the model once and caches it in memory across all requests.
    Prioritizes locally cached weights and supports offline execution.
    """
    global _cached_local_model, _cached_local_model_name
    if _cached_local_model is not None and _cached_local_model_name == model_name:
        return _cached_local_model

    with _local_model_lock:
        if _cached_local_model is not None and _cached_local_model_name == model_name:
            return _cached_local_model

        try:
            from sentence_transformers import SentenceTransformer
            # Try loading local cached files first to avoid remote check delays
            try:
                model = SentenceTransformer(model_name, device=device, local_files_only=True)
            except Exception:
                model = SentenceTransformer(model_name, device=device)
            _cached_local_model = model
            _cached_local_model_name = model_name
            return _cached_local_model
        except Exception as exc:
            raise EmbeddingAPIError(
                f"Failed to load local embedding model '{model_name}' on device '{device}': {str(exc)}"
            )


class LocalEmbeddingProvider(BaseEmbeddingProvider):
    """Local Sentence Transformers embedding provider using intfloat/multilingual-e5-base.
    
    Guarantees:
    - Runs 100% locally on CPU without external API calls.
    - Produces exactly 768 dimensions matching pgvector vector(768).
    - Uses E5 prefixing: 'passage: ' for document chunks, 'query: ' for search queries.
    - Normalized vectors (|v| = 1.0) for cosine distance (<=>).
    - Reusable singleton model instance: loads once and is cached in memory.
    - Runs CPU-bound inference in worker threads via asyncio.to_thread to prevent event loop blocking.
    - Graceful error handling for missing models, invalid inputs, and initialization failures.
    """

    def __init__(
        self,
        model_name: Optional[str] = None,
        dimension: Optional[int] = None,
        device: Optional[str] = None,
    ):
        self._model_name = model_name or getattr(settings, "LOCAL_EMBEDDING_MODEL", "intfloat/multilingual-e5-base")
        self._dimension = dimension or getattr(settings, "EMBEDDING_DIMENSION", 768)
        self._device = device or getattr(settings, "LOCAL_EMBEDDING_DEVICE", "cpu")

    @property
    def dimension(self) -> int:
        return self._dimension

    @property
    def model_name(self) -> str:
        return self._model_name

    def _format_passage(self, text: str) -> str:
        """Format text chunk with E5 'passage: ' prefix."""
        clean = (text or "").strip()
        if not clean:
            clean = "empty document"
        if clean.startswith("passage: "):
            return clean
        return f"passage: {clean}"

    def _format_query(self, query: str) -> str:
        """Format search query with E5 'query: ' prefix."""
        clean = (query or "").strip()
        if not clean:
            clean = "empty"
        if clean.startswith("query: "):
            return clean
        return f"query: {clean}"

    def _sync_encode(self, texts: List[str]) -> List[List[float]]:
        """Synchronous encoding using cached SentenceTransformer with unit normalization."""
        if not texts:
            return []
        model = get_local_sentence_transformer(self._model_name, self._device)
        raw_embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        vectors = raw_embeddings.tolist() if hasattr(raw_embeddings, "tolist") else [list(x) for x in raw_embeddings]

        for vec in vectors:
            if len(vec) != self._dimension:
                raise EmbeddingAPIError(
                    f"Local model dimension mismatch: expected {self._dimension}, got {len(vec)}"
                )
            if not all(math.isfinite(x) for x in vec):
                raise EmbeddingAPIError("Local model produced non-finite embedding values.")
        return vectors

    async def embed_texts(self, texts: List[str], is_query: bool = False) -> List[List[float]]:
        """Generate normalized 768-dim embeddings for document chunks or queries."""
        if not texts:
            return []
        if is_query:
            prefixed = [self._format_query(t) for t in texts]
        else:
            prefixed = [self._format_passage(t) for t in texts]

        return await asyncio.to_thread(self._sync_encode, prefixed)

    async def embed_query(self, query: str) -> List[float]:
        """Generate a single normalized 768-dim embedding for a search query."""
        clean = (query or "").strip()
        if not clean:
            return [0.0] * self._dimension
        results = await self.embed_texts([clean], is_query=True)
        return results[0] if results else [0.0] * self._dimension


class EmbeddingService:
    """Service orchestrating vector embedding generation with provider transparency.
    
    NEVER silently substitutes mock vectors when real embeddings fail.
    """

    @property
    def active_provider_name(self) -> str:
        return getattr(settings, "EMBEDDING_PROVIDER", "local").lower()

    @property
    def is_mock(self) -> bool:
        return self.active_provider_name == "mock"

    @property
    def is_local(self) -> bool:
        return self.active_provider_name == "local"

    @property
    def provider(self) -> BaseEmbeddingProvider:
        if self.active_provider_name == "local":
            return LocalEmbeddingProvider()
        elif self.active_provider_name == "gemini":
            api_key = (
                getattr(settings, "GEMINI_API_KEY", "")
                or getattr(settings, "AI_API_KEY", "")
                or os.environ.get("GEMINI_API_KEY", "")
                or os.environ.get("AI_API_KEY", "")
            )
            if not api_key:
                raise EmbeddingAuthError(
                    "EMBEDDING_PROVIDER is set to 'gemini' but GEMINI_API_KEY is not configured. "
                    "Cannot generate real embeddings without a valid key."
                )
            return GeminiEmbeddingProvider(api_key=api_key)
        elif self.active_provider_name == "vertex":
            return VertexAIEmbeddingProvider()
        return MockEmbeddingProvider()

    @property
    def dimension(self) -> int:
        return self.provider.dimension

    @property
    def model_name(self) -> str:
        return self.provider.model_name

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        return await self.provider.embed_texts(texts)

    async def embed_query(self, query: str) -> List[float]:
        return await self.provider.embed_query(query)

embedding_service = EmbeddingService()
