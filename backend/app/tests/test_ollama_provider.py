import json
import pytest
import httpx
from unittest.mock import patch, MagicMock
from app.ai.ollama_provider import OllamaProvider
from app.ai.provider_factory import get_ai_provider
from app.core.config import settings


@pytest.mark.asyncio
async def test_ollama_provider_init_defaults():
    """Verify OllamaProvider initializes with configured defaults."""
    provider = OllamaProvider()
    assert provider.base_url == settings.OLLAMA_BASE_URL.rstrip("/")
    assert provider.model == settings.OLLAMA_MODEL.strip()
    assert provider.timeout == 60.0


@pytest.mark.asyncio
async def test_ollama_provider_init_custom():
    """Verify OllamaProvider initializes with custom parameters."""
    provider = OllamaProvider(
        base_url="http://custom-host:11434/",
        model="qwen2.5:1.5b",
        timeout=30.0,
    )
    assert provider.base_url == "http://custom-host:11434"
    assert provider.model == "qwen2.5:1.5b"
    assert provider.timeout == 30.0


@pytest.mark.asyncio
async def test_ollama_provider_generate_success():
    """Verify successful Ollama /api/generate call and payload shape."""
    provider = OllamaProvider(model="llama3.2:1b")

    mock_resp = httpx.Response(
        200,
        json={"model": "llama3.2:1b", "response": "PostgreSQL is an object-relational database.", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    captured_payload = None

    async def mock_post(url, json=None, **kwargs):
        nonlocal captured_payload
        captured_payload = json
        return mock_resp

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post):
        result = await provider.generate("Tell me about PostgreSQL.")
        assert result == "PostgreSQL is an object-relational database."
        assert captured_payload is not None
        assert captured_payload["model"] == "llama3.2:1b"
        assert captured_payload["prompt"] == "Tell me about PostgreSQL."
        assert captured_payload["stream"] is False
        assert captured_payload["options"]["temperature"] == 0.2
        assert captured_payload["options"]["num_predict"] == 1024
        assert "system" not in captured_payload


@pytest.mark.asyncio
async def test_ollama_provider_generate_with_system_prompt():
    """Verify system prompt is properly included in Ollama payload."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "System-guided answer.", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    captured_payload = None

    async def mock_post(url, json=None, **kwargs):
        nonlocal captured_payload
        captured_payload = json
        return mock_resp

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post):
        result = await provider.generate(
            prompt="What is indexing?",
            system_prompt="You are a database expert.",
        )
        assert result == "System-guided answer."
        assert captured_payload["system"] == "You are a database expert."


@pytest.mark.asyncio
async def test_ollama_provider_chat_grounded():
    """Verify chat() constructs grounded prompt with retrieved excerpts and strict system instructions."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "Based on Document A, MVCC allows concurrent reads and writes.", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    captured_payload = None

    async def mock_post(url, json=None, **kwargs):
        nonlocal captured_payload
        captured_payload = json
        return mock_resp

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post):
        context = "Document: PostgreSQL Architecture\nPassage: MVCC ensures readers do not block writers."
        result = await provider.chat(query="How does MVCC work?", context=context)

        assert "Based on Document A" in result
        assert captured_payload is not None
        assert "MVCC ensures readers do not block writers." in captured_payload["prompt"]
        assert "How does MVCC work?" in captured_payload["prompt"]
        assert "Ground your response ONLY" in captured_payload["system"]


@pytest.mark.asyncio
async def test_ollama_provider_chat_empty_context():
    """Verify chat() indicates no relevant documents were found when context is missing."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "I searched your Second Brain notes, but could not find enough information to answer this question.", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    captured_payload = None

    async def mock_post(url, json=None, **kwargs):
        nonlocal captured_payload
        captured_payload = json
        return mock_resp

    with patch.object(httpx.AsyncClient, "post", side_effect=mock_post):
        result = await provider.chat(query="What is quantum gravity?", context=None)
        assert "could not find enough information" in result
        assert "[Notice: No relevant documents were found" in captured_payload["prompt"]


@pytest.mark.asyncio
async def test_ollama_provider_chat_empty_query():
    """Verify chat() returns early when query is empty, without network call."""
    provider = OllamaProvider()
    result = await provider.chat(query="   ", context="Some context")
    assert result == "Please provide a question."


@pytest.mark.asyncio
async def test_ollama_provider_summarize():
    """Verify summarize() produces structured summary request."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "## Summary\n- Key takeaway 1\n- Key takeaway 2", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
        result = await provider.summarize(
            content="FastAPI is an async framework with automatic OpenAPI docs.",
            title="FastAPI Guide",
        )
        assert "## Summary" in result


@pytest.mark.asyncio
async def test_ollama_provider_extract_concepts():
    """Verify extract_concepts() parses comma-separated output."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "PostgreSQL, MVCC, B-Tree Indexes, ACID", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
        concepts = await provider.extract_concepts("PostgreSQL database architecture tutorial")
        assert concepts == ["PostgreSQL", "MVCC", "B-Tree Indexes", "ACID"]


@pytest.mark.asyncio
async def test_ollama_provider_suggest_tags():
    """Verify suggest_tags() produces clean lowercase taxonomy tags."""
    provider = OllamaProvider()

    mock_resp = httpx.Response(
        200,
        json={"response": "#database, #postgres, architecture, devops", "done": True},
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
        tags = await provider.suggest_tags(
            content="PostgreSQL container deployment with Docker Compose.",
            title="Postgres Setup",
        )
        assert tags == ["database", "postgres", "architecture", "devops"]


@pytest.mark.asyncio
async def test_ollama_provider_model_not_found_404():
    """Verify HTTP 404 gives helpful pull instruction."""
    provider = OllamaProvider(model="nonexistent-model:latest")

    mock_resp = httpx.Response(
        404,
        text="model 'nonexistent-model:latest' not found",
        request=httpx.Request("POST", "http://127.0.0.1:11434/api/generate"),
    )

    with patch.object(httpx.AsyncClient, "post", return_value=mock_resp):
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("test")
        assert "ollama pull nonexistent-model:latest" in str(exc_info.value)


@pytest.mark.asyncio
async def test_ollama_provider_connect_error_transparent_message():
    """Verify connection failure provides clear diagnostics and never falls back to Gemini."""
    provider = OllamaProvider()

    with patch.object(httpx.AsyncClient, "post", side_effect=httpx.ConnectError("Connection refused")):
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("test")

        err_msg = str(exc_info.value)
        assert "Local AI service (Ollama) is not running or unreachable" in err_msg
        assert "ollama serve" in err_msg
        assert "AI_PROVIDER=mock" in err_msg
        # Strict guarantee: never mention or fall back to Gemini
        assert "gemini" not in err_msg.lower()


@pytest.mark.asyncio
async def test_ollama_provider_timeout_error():
    """Verify timeout provides helpful guidance on model size."""
    provider = OllamaProvider(timeout=1.0)

    with patch.object(httpx.AsyncClient, "post", side_effect=httpx.TimeoutException("Timed out")):
        with pytest.raises(RuntimeError) as exc_info:
            await provider.generate("test")

        err_msg = str(exc_info.value)
        assert "took longer than" in err_msg
        assert "smaller model" in err_msg


def test_ollama_provider_factory_registration():
    """Verify provider factory correctly registers and creates OllamaProvider."""
    with patch.object(settings, "AI_PROVIDER", "ollama"):
        provider = get_ai_provider()
        assert isinstance(provider, OllamaProvider)
        assert provider.model == settings.OLLAMA_MODEL
