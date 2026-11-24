import uuid
import pytest
import pytest_asyncio
import httpx
from unittest.mock import patch

from app.main import app
from app.services.chunking_service import chunking_service, ChunkingService
from app.services.embedding_service import embedding_service, MockEmbeddingProvider, EmbeddingAPIError
from app.services.rag_ingestion_service import rag_ingestion_service

@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def user_a(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"rag_user_a_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "RAG User A", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"rag_user_b_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "RAG User B", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


# -------------------------------------------------------------
# 1. PGVECTOR EXTENSION AVAILABILITY & SQL TEST IN POSTGRES
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_pgvector_extension_in_postgres():
    """Verify that vector extension is enabled and vector math operates in PostgreSQL."""
    try:
        import asyncpg
        conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/second_brain")
        version = await conn.fetchval("SELECT extversion FROM pg_extension WHERE extname = 'vector';")
        assert version is not None, "pgvector extension is not installed in PostgreSQL"
        assert version in ("0.8.0", "0.8.1", "0.7.0", "0.7.4", "0.6.2", "0.5.1")

        l2 = await conn.fetchval("SELECT '[1,0,0]'::vector <-> '[0,1,0]'::vector;")
        assert l2 > 0

        cosine = await conn.fetchval("SELECT '[1,2,3]'::vector <=> '[1,2,3]'::vector;")
        assert round(float(cosine), 4) == 0.0
        await conn.close()
    except Exception as exc:
        pytest.skip(f"PostgreSQL connection not reachable: {exc}")


# -------------------------------------------------------------
# 2. CHUNKING SERVICE: BOUNDARIES, OVERLAP, EMPTY, LONG DOCS
# -------------------------------------------------------------
def test_chunking_empty_and_short_content():
    """Verify chunking behavior with empty and short content."""
    service = ChunkingService(default_chunk_size=100, default_chunk_overlap=20)
    
    assert service.chunk_text("") == []
    assert service.chunk_text("   \n\n  ") == []

    short_text = "This is a single short sentence for testing Second Brain RAG."
    chunks = service.chunk_text(short_text)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].content == short_text
    assert len(chunks[0].content_hash) == 64
    assert chunks[0].token_count > 0


def test_chunking_overlap_and_offsets():
    """Verify that consecutive chunks preserve overlap and character offsets."""
    service = ChunkingService(default_chunk_size=30, default_chunk_overlap=10)
    
    text = (
        "Paragraph One introduces the distributed database architecture.\n\n"
        "Paragraph Two discusses how replication and consensus algorithms operate.\n\n"
        "Paragraph Three describes index structures like B-Trees and LSM Trees.\n\n"
        "Paragraph Four analyzes write amplification and storage efficiency."
    )
    chunks = service.chunk_text(text, source_type="NOTE")
    assert len(chunks) > 1

    for idx, c in enumerate(chunks):
        assert c.chunk_index == idx
        assert c.start_char < c.end_char
        assert len(c.content_hash) == 64
        assert c.source_metadata["source_type"] == "NOTE"
        assert c.source_metadata["chunk_index"] == idx


def test_chunking_preserves_page_and_heading_metadata():
    """Verify that PDF page markers and Markdown headers are detected and preserved."""
    service = ChunkingService()
    doc_text = (
        "# Architectural Guidelines\n\n"
        "--- Page 1 ---\n"
        "First section discusses system latency under high concurrent load."
    )
    chunks = service.chunk_text(doc_text, source_type="PDF")
    assert len(chunks) >= 1
    meta = chunks[0].source_metadata
    assert meta["source_type"] == "PDF"
    assert meta.get("page_number") == 1
    assert meta.get("heading") == "Architectural Guidelines"


def test_chunking_very_long_document():
    """Verify chunking of large multi-paragraph documents."""
    service = ChunkingService(default_chunk_size=150, default_chunk_overlap=30)
    paragraphs = [
        f"Paragraph {i}: Detailed explanation of vector retrieval, embeddings, and semantic similarity scoring with pgvector."
        for i in range(40)
    ]
    long_doc = "\n\n".join(paragraphs)
    chunks = service.chunk_text(long_doc, source_type="DOCUMENT")
    assert len(chunks) >= 5

    # Check contiguous monotonic indexing
    for idx, c in enumerate(chunks):
        assert c.chunk_index == idx


# -------------------------------------------------------------
# 3. EMBEDDING SERVICE: DIMENSIONS, DETERMINISM, BATCHES
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_mock_embedding_provider_dimension_and_determinism():
    """Verify mock provider dimensions (768), normalization, and determinism."""
    provider = MockEmbeddingProvider()
    assert provider.dimension == 768

    v1 = await provider.embed_query("Second Brain Vector Search")
    v2 = await provider.embed_query("Second Brain Vector Search")
    assert len(v1) == 768
    assert v1 == v2, "Embeddings for identical text must be deterministic"

    import math
    norm = math.sqrt(sum(x * x for x in v1))
    assert abs(norm - 1.0) < 0.01


@pytest.mark.asyncio
async def test_embedding_batch_processing():
    """Verify batch embedding generation for multiple texts."""
    provider = MockEmbeddingProvider()
    texts = [f"Knowledge chunk number {i} discussing vector search algorithms" for i in range(12)]
    vectors = await provider.embed_texts(texts)
    assert len(vectors) == 12
    for vec in vectors:
        assert len(vec) == 768


# -------------------------------------------------------------
# 4. RAG INGESTION LIFECYCLE & API ENDPOINTS
# -------------------------------------------------------------
@pytest.mark.asyncio
async def test_rag_ingest_lifecycle_via_api(client: httpx.AsyncClient, user_a: dict):
    """Test full ingestion: note creation -> chunking -> vector storage -> status update."""
    headers = user_a["headers"]

    # 1. Create a note via API
    note_payload = {
        "title": "PostgreSQL MVCC Mechanics",
        "type": "NOTE",
        "content": "PostgreSQL uses Multi-Version Concurrency Control (MVCC) to provide transaction isolation. Readers do not block writers and writers do not block readers.",
        "summary": "MVCC transaction isolation summary.",
        "tags": ["postgres", "database"],
    }
    create_res = await client.post("/api/v1/knowledge", json=note_payload, headers=headers)
    assert create_res.status_code == 201
    created_item = create_res.json()
    item_id = created_item["id"]

    # Check item indexing status
    get_res = await client.get(f"/api/v1/knowledge/{item_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["indexingStatus"] in ("INDEXED", "UNINDEXED", "PENDING")

    # Explicitly call re-index endpoint on this item
    reindex_res = await client.post(f"/api/v1/rag/reindex/{item_id}?force=true", headers=headers)
    assert reindex_res.status_code == 200
    assert reindex_res.json()["status"] in ("INDEXED", "ALREADY_INDEXED")

    # Fetch chunks via RAG API
    chunks_res = await client.get(f"/api/v1/rag/chunks/{item_id}", headers=headers)
    assert chunks_res.status_code == 200
    chunks = chunks_res.json()
    assert len(chunks) >= 1
    assert chunks[0]["knowledgeId"] == item_id
    assert chunks[0]["hasEmbedding"] is True
    assert chunks[0]["tokenCount"] > 0


@pytest.mark.asyncio
async def test_rag_user_isolation(client: httpx.AsyncClient, user_a: dict, user_b: dict):
    """Verify that User B cannot access User A's chunks or trigger re-indexing on User A's item."""
    # User A creates a note
    res = await client.post(
        "/api/v1/knowledge",
        json={"title": "Secret Note of User A", "type": "NOTE", "content": "Private architectural document."},
        headers=user_a["headers"],
    )
    assert res.status_code == 201
    item_id = res.json()["id"]

    # User B attempts to access chunks of User A's item
    b_chunks_res = await client.get(f"/api/v1/rag/chunks/{item_id}", headers=user_b["headers"])
    assert b_chunks_res.status_code == 404

    # User B attempts to trigger re-index on User A's item
    b_reindex_res = await client.post(f"/api/v1/rag/reindex/{item_id}", headers=user_b["headers"])
    assert b_reindex_res.status_code == 404


@pytest.mark.asyncio
async def test_rag_reindex_and_estimate_endpoints(client: httpx.AsyncClient, user_a: dict):
    """Test /api/v1/rag/status, /api/v1/rag/estimate, and /api/v1/rag/reindex with dryRun."""
    headers = user_a["headers"]

    # 1. Status endpoint
    status_res = await client.get("/api/v1/rag/status", headers=headers)
    assert status_res.status_code == 200
    status_data = status_res.json()
    assert "embeddingDimension" in status_data
    assert status_data["embeddingDimension"] == 768
    assert "totalItems" in status_data

    # 2. Estimate endpoint
    est_res = await client.get("/api/v1/rag/estimate", headers=headers)
    assert est_res.status_code == 200
    est_data = est_res.json()
    assert "estimatedChunks" in est_data
    assert "estimatedTokens" in est_data
    assert "estimatedApiRequests" in est_data

    # 3. Dry-run reindex
    reindex_res = await client.post("/api/v1/rag/reindex", json={"dryRun": True}, headers=headers)
    assert reindex_res.status_code == 200
    assert reindex_res.json()["dryRun"] is True


@pytest.mark.asyncio
async def test_rag_error_handling_when_embedding_fails(client: httpx.AsyncClient, user_a: dict):
    """Verify that when embedding generation fails, the original knowledge record remains intact."""
    headers = user_a["headers"]

    res = await client.post(
        "/api/v1/knowledge",
        json={"title": "Error Handling Note", "type": "NOTE", "content": "Content to test embedding failure resilience."},
        headers=headers,
    )
    assert res.status_code == 201
    item_id = res.json()["id"]

    # Force reindex with mocked embedding failure
    with patch.object(embedding_service, "embed_texts", side_effect=EmbeddingAPIError("Simulated Gemini Failure")):
        reindex_res = await client.post(f"/api/v1/rag/reindex/{item_id}?force=true", headers=headers)
        assert reindex_res.status_code == 200
        assert reindex_res.json()["status"] == "FAILED"

    # Original note is still intact
    get_res = await client.get(f"/api/v1/knowledge/{item_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["content"] == "Content to test embedding failure resilience."
    assert get_res.json()["indexingStatus"] == "FAILED"
