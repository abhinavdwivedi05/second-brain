import uuid
import pytest
import pytest_asyncio
import httpx
from unittest.mock import patch
from app.main import app
from app.core.config import settings
from app.ai.gemini_provider import GeminiProvider


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_a(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_ai_a_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User AI A", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_ai_b_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User AI B", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.mark.asyncio
async def test_unauthenticated_ai_endpoints_blocked(client: httpx.AsyncClient):
    """Unauthenticated requests to AI endpoints must return 401."""
    endpoints = [
        ("/api/v1/ai/summarize", {"content": "Some text"}),
        ("/api/v1/ai/extract-concepts", {"content": "Some text"}),
        ("/api/v1/ai/suggest-tags", {"content": "Some text"}),
        ("/api/v1/ai/chat", {"query": "Hello"}),
    ]
    for url, payload in endpoints:
        res = await client.post(url, json=payload)
        assert res.status_code == 401, f"Expected 401 for {url}, got {res.status_code}"


@pytest.mark.asyncio
async def test_ai_missing_gemini_api_key_returns_503(client: httpx.AsyncClient, user_a):
    """When provider is gemini but no API key is configured, return 503."""
    with patch.object(settings, "AI_PROVIDER", "gemini"), \
         patch.object(settings, "GEMINI_API_KEY", ""):
        res = await client.post(
            "/api/v1/ai/summarize",
            json={"content": "Test text needing summary"},
            headers=user_a["headers"],
        )
        assert res.status_code == 503
        data = res.json()
        assert "not configured" in data["detail"].lower() or "gemini" in data["detail"].lower()


@pytest.mark.asyncio
async def test_ai_summarize_raw_content_mock(client: httpx.AsyncClient, user_a):
    """Summarize raw content using mock provider."""
    with patch.object(settings, "AI_PROVIDER", "mock"):
        res = await client.post(
            "/api/v1/ai/summarize",
            json={"content": "FastAPI is a modern, fast web framework for building APIs with Python."},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert "summary" in data
        assert len(data["summary"]) > 0
        assert data.get("provider") == "mock"


@pytest.mark.asyncio
async def test_ai_summarize_knowledge_item(client: httpx.AsyncClient, user_a):
    """Summarize an existing knowledge item by ID."""
    with patch.object(settings, "AI_PROVIDER", "mock"):
        # Create knowledge item first
        k_res = await client.post(
            "/api/v1/knowledge",
            json={
                "title": "Quantum Computing Introduction",
                "content": "Quantum computing harnesses the phenomena of quantum mechanics such as superposition and entanglement.",
                "type": "note",
            },
            headers=user_a["headers"],
        )
        assert k_res.status_code == 201
        k_id = k_res.json()["id"]

        # Summarize using knowledge_id
        res = await client.post(
            "/api/v1/ai/summarize",
            json={"knowledge_id": k_id},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert "summary" in data
        assert data.get("knowledge_id") == k_id or data.get("knowledgeId") == k_id


@pytest.mark.asyncio
async def test_ai_extract_concepts_mock(client: httpx.AsyncClient, user_a):
    """Extract key concepts from knowledge item or text."""
    with patch.object(settings, "AI_PROVIDER", "mock"):
        k_res = await client.post(
            "/api/v1/knowledge",
            json={
                "title": "Database Normalization",
                "content": "Database normalization reduces data redundancy and improves data integrity through 1NF, 2NF, 3NF, and BCNF.",
                "type": "note",
            },
            headers=user_a["headers"],
        )
        assert k_res.status_code == 201
        k_id = k_res.json()["id"]

        res = await client.post(
            "/api/v1/ai/extract-concepts",
            json={"knowledge_id": k_id},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        concepts = data.get("concepts") or data.get("keyConcepts") or data.get("key_concepts")
        assert concepts is not None
        assert isinstance(concepts, list)
        assert len(concepts) > 0


@pytest.mark.asyncio
async def test_ai_suggest_tags_mock(client: httpx.AsyncClient, user_a):
    """Suggest relevant tags from content."""
    with patch.object(settings, "AI_PROVIDER", "mock"):
        res = await client.post(
            "/api/v1/ai/suggest-tags",
            json={"title": "React Performance Optimization", "content": "Using useMemo, useCallback, and React.memo for re-render control."},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        tags = data.get("suggested_tags") or data.get("suggestedTags") or data.get("tags")
        assert tags is not None
        assert isinstance(tags, list)
        assert len(tags) > 0


@pytest.mark.asyncio
async def test_ai_chat_grounded_in_knowledge(client: httpx.AsyncClient, user_a):
    """Chat grounded in a specific knowledge item."""
    with patch.object(settings, "AI_PROVIDER", "mock"):
        k_res = await client.post(
            "/api/v1/knowledge",
            json={
                "title": "Project Falcon Architecture",
                "content": "Project Falcon utilizes microservices communicating via gRPC with an Event Store.",
                "type": "note",
            },
            headers=user_a["headers"],
        )
        assert k_res.status_code == 201
        k_id = k_res.json()["id"]

        res = await client.post(
            "/api/v1/ai/chat",
            json={"query": "What protocol does Project Falcon use?", "knowledge_id": k_id},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert "answer" in data
        assert "sources" in data
        assert len(data["sources"]) == 1
        assert data["sources"][0]["id"] == k_id
        assert data["sources"][0]["title"] == "Project Falcon Architecture"


@pytest.mark.asyncio
async def test_ai_user_isolation(client: httpx.AsyncClient, user_a, user_b):
    """User B cannot access or summarize User A's knowledge items."""
    k_res = await client.post(
        "/api/v1/knowledge",
        json={"title": "User A Private Plan", "content": "Confidential roadmap for Q4.", "type": "note"},
        headers=user_a["headers"],
    )
    assert k_res.status_code == 201
    k_id = k_res.json()["id"]

    # User B attempts to summarize User A's item -> 404
    res = await client.post(
        "/api/v1/ai/summarize",
        json={"knowledge_id": k_id},
        headers=user_b["headers"],
    )
    assert res.status_code == 404

    # User B attempts to chat scoped to User A's item -> 404
    chat_res = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is in the plan?", "knowledge_id": k_id},
        headers=user_b["headers"],
    )
    assert chat_res.status_code == 404


@pytest.mark.asyncio
async def test_gemini_provider_unit():
    """Unit test GeminiProvider behavior with mocked HTTP responses."""
    provider = GeminiProvider(api_key="test-api-key", model="gemini-1.5-flash")

    # Test missing key raises ValueError
    unconfigured = GeminiProvider(api_key="")
    with pytest.raises(ValueError, match="Gemini API key is not configured"):
        await unconfigured.generate("test")

    # Mock HTTP response with real httpx.Response
    mock_response = httpx.Response(
        200,
        json={
            "candidates": [
                {
                    "content": {
                        "parts": [{"text": '["FastAPI", "Python", "AsyncIO"]'}]
                    }
                }
            ]
        },
        request=httpx.Request("POST", "http://test")
    )

    with patch.object(httpx.AsyncClient, "post", return_value=mock_response):
        concepts = await provider.extract_concepts("FastAPI Python AsyncIO tutorial")
        assert concepts == ["FastAPI", "Python", "AsyncIO"]

        tags = await provider.suggest_tags("FastAPI Python AsyncIO tutorial", title="FastAPI Tutorial")
        assert "fastapi" in [t.lower() for t in tags]
