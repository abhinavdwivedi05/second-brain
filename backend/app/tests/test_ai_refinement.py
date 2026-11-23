import uuid
import pytest
import pytest_asyncio
import httpx
from app.main import app
from app.ai.mock_provider import MockAIProvider

@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def auth_user(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_ai_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User AI", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

POSTGRES_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Part I. Tutorial - PostgreSQL Documentation</title>
    <meta name="description" content="Welcome to the PostgreSQL Tutorial.">
</head>
<body>
<div class="navheader">Nav header here</div>
<article>
    <h1>Part I. Tutorial</h1>
    <p>Welcome to the PostgreSQL Tutorial. The following few chapters are intended to give a simple introduction to PostgreSQL, relational database concepts, and the SQL language to those who are new to any one of these aspects. We only assume some general knowledge of how to use a computer.</p>
    <p>PostgreSQL is an advanced, enterprise-class open-source relational database system that supports both SQL (relational) and JSON (non-relational) querying. It is known for its reliability, data integrity, and robust feature set.</p>
    <p>In this tutorial, you will learn how to create a database, start the PostgreSQL server, create tables, insert data, query tables with SQL, and manage database permissions.</p>
</article>
<div class="navfooter">Footer navigation</div>
</body>
</html>
"""

PYTHON_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>The Python Tutorial — Python documentation</title>
</head>
<body>
<article>
    <h1>The Python Tutorial</h1>
    <p>Python is an easy to learn, powerful programming language. It has efficient high-level data structures and a simple but effective approach to object-oriented programming.</p>
    <p>Python’s elegant syntax and dynamic typing, together with its interpreted nature, make it an ideal language for scripting and rapid application development in many areas on most platforms.</p>
    <p>The Python interpreter and the extensive standard library are freely available in source or binary form for all major platforms.</p>
</article>
</body>
</html>
"""

DOCKER_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Docker Overview — Docker Docs</title>
</head>
<body>
<article>
    <h1>Docker Overview</h1>
    <p>Docker is an open platform for developing, shipping, and running applications. Docker enables you to separate your applications from your infrastructure so you can deliver software quickly.</p>
    <p>With Docker, you can manage your infrastructure in the same ways you manage your applications. By taking advantage of Docker methodologies for shipping, testing, and deploying code, you can significantly reduce the delay between writing code and running it in production.</p>
    <p>Docker provides the ability to package and run an application in a loosely isolated environment called a container.</p>
</article>
</body>
</html>
"""

@pytest.mark.asyncio
async def test_summary_quality_postgres():
    mock = MockAIProvider()
    content = (
        "# Part I. Tutorial\n\n"
        "Welcome to the PostgreSQL Tutorial. The following few chapters are intended to give a simple introduction to PostgreSQL.\n\n"
        "PostgreSQL is an advanced, enterprise-class open-source relational database system that supports both SQL (relational) and JSON (non-relational) querying. It is known for its reliability, data integrity, and robust feature set.\n\n"
        "In this tutorial, you will learn how to create a database, start the PostgreSQL server, create tables, insert data, query tables with SQL, and manage database permissions."
    )
    summary = await mock.summarize(content, "Part I. Tutorial")
    
    # 1. No title repetition
    assert "Summary of" not in summary
    assert "Part I. Tutorial" not in summary
    # 2. No greeting or navigational boilerplate
    assert "Welcome to" not in summary
    assert "The following few chapters" not in summary
    # 3. Substantive content preserved
    assert "PostgreSQL" in summary
    assert "relational database" in summary
    # 4. Concise 2-4 sentences
    sentences = [s for s in summary.split(".") if len(s.strip()) > 5]
    assert 2 <= len(sentences) <= 4

@pytest.mark.asyncio
async def test_concept_extraction_quality():
    mock = MockAIProvider()
    content = (
        "# Part I. Tutorial\n\n"
        "Welcome to the PostgreSQL Tutorial. The following few chapters are intended to give a simple introduction to PostgreSQL.\n\n"
        "PostgreSQL is an advanced, enterprise-class open-source relational database system that supports both SQL (relational) and JSON (non-relational) querying."
    )
    concepts = await mock.extract_concepts(content)
    
    # Must NOT contain navigation or boilerplate words
    assert "Part" not in concepts
    assert "Tutorial" not in concepts
    assert "Welcome" not in concepts
    assert "Intended" not in concepts
    assert "Give" not in concepts
    
    # Must contain actual technical concepts
    assert "PostgreSQL" in concepts
    assert any("SQL" in c or "Database" in c or "JSON" in c for c in concepts)

@pytest.mark.asyncio
async def test_ai_chat_explanatory_answers():
    mock = MockAIProvider()
    context = (
        "Document Title: Part I. Tutorial\n"
        "Type: LINK\n"
        "Content:\n"
        "PostgreSQL is an advanced, enterprise-class open-source relational database system that supports both SQL (relational) and JSON (non-relational) querying. It is known for its reliability, data integrity, and robust feature set.\n\n"
        "In this tutorial, you will learn how to create a database, start the PostgreSQL server, create tables, insert data, query tables with SQL, and manage database permissions."
    )
    
    # Question 1: What is postgres?
    ans1 = await mock.chat("What is postgres?", context)
    assert "Document Title:" not in ans1
    assert "relational database system" in ans1.lower()
    assert "enterprise-class" in ans1.lower()
    
    # Question 2: How do I create a database?
    ans2 = await mock.chat("How do I create a database?", context)
    assert "create a database" in ans2.lower()
    
    # Question 3: Completely unrelated question
    ans3 = await mock.chat("What is quantum entanglement?", context)
    assert "does not contain" in ans3.lower() or "could not find" in ans3.lower() or "none of your saved" in ans3.lower()

@pytest.mark.asyncio
async def test_three_document_import_and_chat_e2e(client: httpx.AsyncClient, auth_user: dict, monkeypatch):
    """Import Postgres, Python, and Docker docs, verify distinct summaries, concepts, and chat."""
    from app.services import web_extractor
    
    # Mock HTTP fetch to return our 3 sample docs based on URL
    async def mock_fetch(url: str, **kwargs):
        if "postgres" in url:
            return POSTGRES_HTML, url, 200
        elif "python" in url:
            return PYTHON_HTML, url, 200
        elif "docker" in url:
            return DOCKER_HTML, url, 200
        raise ValueError(f"Unexpected url {url}")

    import socket
    from app.core.config import settings
    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")
    monkeypatch.setattr(web_extractor, "fetch_webpage", mock_fetch)
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
    ])

    headers = auth_user["headers"]

    # 1. Import PostgreSQL
    res_pg = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://www.postgresql.org/docs/tutorial.html"},
        headers=headers
    )
    assert res_pg.status_code == 201
    pg_data = res_pg.json()
    assert "Summary of" not in pg_data["summary"]
    assert "Welcome to" not in pg_data["summary"]
    assert "Part" not in pg_data["keyConcepts"]
    assert "PostgreSQL" in pg_data["keyConcepts"]

    # 2. Import Python
    res_py = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://docs.python.org/3/tutorial/index.html"},
        headers=headers
    )
    assert res_py.status_code == 201
    py_data = res_py.json()
    assert "Python" in py_data["keyConcepts"]

    # 3. Import Docker
    res_dk = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://docs.docker.com/get-started/overview/"},
        headers=headers
    )
    assert res_dk.status_code == 201
    dk_data = res_dk.json()
    assert "Docker" in dk_data["keyConcepts"]

    # 4. Chat about PostgreSQL
    chat_pg = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is postgres?"},
        headers=headers
    )
    assert chat_pg.status_code == 200
    pg_answer = chat_pg.json()["answer"]
    assert "relational database" in pg_answer.lower()
    assert len(chat_pg.json()["sources"]) > 0

    # 5. Chat about Docker
    chat_dk = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is Docker?"},
        headers=headers
    )
    assert chat_dk.status_code == 200
    dk_answer = chat_dk.json()["answer"]
    assert "docker" in dk_answer.lower()
    assert "applications" in dk_answer.lower() or "container" in dk_answer.lower()

    # 6. Unrelated question should not return sources
    chat_unrelated = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is quantum computing?"},
        headers=headers
    )
    assert chat_unrelated.status_code == 200
    assert len(chat_unrelated.json()["sources"]) == 0

@pytest.mark.asyncio
async def test_context_isolation_scenarios_a_to_f(client: httpx.AsyncClient, auth_user: dict, monkeypatch):
    """Verify Scenarios A through F: Document Context Isolation vs Global Knowledge Mode."""
    from app.services import web_extractor
    from app.core.config import settings
    import socket

    async def mock_fetch(url: str, **kwargs):
        if "postgres" in url:
            return POSTGRES_HTML, url, 200
        elif "docker" in url:
            return DOCKER_HTML, url, 200
        raise ValueError(f"Unexpected url {url}")

    monkeypatch.setattr(settings, "AI_PROVIDER", "mock")
    monkeypatch.setattr(web_extractor, "fetch_webpage", mock_fetch)
    monkeypatch.setattr(socket, "getaddrinfo", lambda *args, **kwargs: [
        (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", 443))
    ])

    headers = auth_user["headers"]

    # Ingest PostgreSQL Note
    res_pg = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://www.postgresql.org/docs/tutorial.html"},
        headers=headers
    )
    assert res_pg.status_code == 201
    pg_id = res_pg.json()["id"]

    # Ingest Docker Note
    res_dk = await client.post(
        "/api/v1/knowledge/import-url",
        json={"url": "https://docs.docker.com/get-started/overview/"},
        headers=headers
    )
    assert res_dk.status_code == 201
    dk_id = res_dk.json()["id"]

    # ----------------------------------------------------
    # Case A: Active Document = PostgreSQL, query = "What is PostgreSQL?"
    # ----------------------------------------------------
    res_a = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is PostgreSQL?", "knowledge_id": pg_id},
        headers=headers
    )
    assert res_a.status_code == 200
    data_a = res_a.json()
    assert "relational database" in data_a["answer"].lower()
    assert "docker" not in data_a["answer"].lower()
    source_ids_a = [s["id"] for s in data_a["sources"]]
    assert source_ids_a == [pg_id]
    assert dk_id not in source_ids_a

    # ----------------------------------------------------
    # Case B: Active Document = PostgreSQL, query = "What is the difference between a database and a table?"
    # (Document mentions database and table in passing but does not define both in contrast)
    # ----------------------------------------------------
    res_b = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is the difference between a database and a table?", "knowledge_id": pg_id},
        headers=headers
    )
    assert res_b.status_code == 200
    data_b = res_b.json()
    # Must provide honest answer or limitation, and never cite Docker
    source_ids_b = [s["id"] for s in data_b["sources"]]
    assert dk_id not in source_ids_b
    assert "docker" not in data_b["answer"].lower()

    # ----------------------------------------------------
    # Case C: Active Document = Docker, query = "What is Docker?"
    # ----------------------------------------------------
    res_c = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is Docker?", "knowledge_id": dk_id},
        headers=headers
    )
    assert res_c.status_code == 200
    data_c = res_c.json()
    assert "docker" in data_c["answer"].lower()
    assert "postgres" not in data_c["answer"].lower()
    source_ids_c = [s["id"] for s in data_c["sources"]]
    assert source_ids_c == [dk_id]
    assert pg_id not in source_ids_c

    # ----------------------------------------------------
    # Case D: Switch context back to PostgreSQL, query = "What is SQL?"
    # ----------------------------------------------------
    res_d = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is SQL?", "knowledge_id": pg_id},
        headers=headers
    )
    assert res_d.status_code == 200
    data_d = res_d.json()
    assert "docker" not in data_d["answer"].lower()
    source_ids_d = [s["id"] for s in data_d["sources"]]
    assert source_ids_d == [pg_id]

    # ----------------------------------------------------
    # Case E: Close document (no knowledge_id / Global Mode), query = "What do I know about Docker?"
    # ----------------------------------------------------
    res_e = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What do I know about Docker?"},
        headers=headers
    )
    assert res_e.status_code == 200
    data_e = res_e.json()
    assert "docker" in data_e["answer"].lower()
    source_ids_e = [s["id"] for s in data_e["sources"]]
    assert dk_id in source_ids_e

    # ----------------------------------------------------
    # Case F: Global Mode, out-of-scope query = "What is quantum teleportation?"
    # ----------------------------------------------------
    res_f = await client.post(
        "/api/v1/ai/chat",
        json={"query": "What is quantum teleportation?"},
        headers=headers
    )
    assert res_f.status_code == 200
    data_f = res_f.json()
    assert "could not find" in data_f["answer"].lower() or "none of your saved" in data_f["answer"].lower()
    assert len(data_f["sources"]) == 0
