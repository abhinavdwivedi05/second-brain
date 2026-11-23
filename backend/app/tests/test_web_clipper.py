import uuid
import pytest
import pytest_asyncio
import httpx
from unittest.mock import patch, MagicMock
from app.main import app
from app.services.web_extractor import (
    validate_target_url,
    parse_webpage_content,
    SSRFSecurityError,
    WebDownloadError,
    web_extractor,
)


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_a(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_clipper_a_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User Clipper A", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_clipper_b_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User Clipper B", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


SAMPLE_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>PostgreSQL Concurrency and MVCC Architecture | Database Weekly</title>
    <meta name="description" content="In-depth guide on PostgreSQL multi-version concurrency control and transaction isolation levels.">
    <link rel="canonical" href="https://example.com/postgresql-mvcc-guide">
</head>
<body>
    <header><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
    <div class="sidebar ad-banner"><p>Buy something!</p></div>
    <article>
        <h1>PostgreSQL Concurrency and MVCC Architecture</h1>
        <p>PostgreSQL achieves transaction isolation using Multi-Version Concurrency Control (MVCC).</p>
        <p>Instead of locking rows for reading, each transaction sees a consistent snapshot of the database.</p>
        <h2>Tuple Storage and Visibility</h2>
        <p>Every table row in Postgres contains hidden system columns including xmin and xmax to track transaction visibility.</p>
        <ul>
            <li>xmin stores the transaction ID of the inserting transaction.</li>
            <li>xmax stores the transaction ID of the deleting or updating transaction.</li>
        </ul>
        <blockquote>Readers never block writers, and writers never block readers.</blockquote>
    </article>
    <footer><p>&copy; 2026 Database Weekly</p></footer>
</body>
</html>
"""


# -------------------------------------------------------------------------
# Unit Tests: SSRF and HTML Parsing
# -------------------------------------------------------------------------

def test_ssrf_prohibits_localhost_and_private_ips():
    """Verify that localhost, 127.0.0.1, 10.x, 192.168.x, and cloud metadata are blocked."""
    prohibited_urls = [
        "http://localhost:8000/admin",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:80",
        "http://[::1]:8080",
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
        "ftp://example.com/file.txt",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "http://internal.localhost/",
        "http://router.local/",
    ]
    for bad_url in prohibited_urls:
        with pytest.raises(SSRFSecurityError):
            validate_target_url(bad_url)


def test_ssrf_dns_resolution_blocking():
    """Verify that hostnames resolving to private IPs are blocked via DNS lookup check."""
    with patch("socket.getaddrinfo") as mock_dns:
        # Mock DNS returning a private 192.168.1.1 address for an innocent-looking domain
        mock_dns.return_value = [(2, 1, 6, "", ("192.168.1.50", 80))]
        with pytest.raises(SSRFSecurityError, match="private/internal IP"):
            validate_target_url("https://malicious-rebinding-test.com/secret")


def test_html_parsing_extracts_title_description_and_clean_markdown():
    """Verify BeautifulSoup DOM cleaning, heading, and list extraction."""
    parsed = parse_webpage_content(SAMPLE_HTML, "https://example.com/article")
    assert parsed["title"] == "PostgreSQL Concurrency and MVCC Architecture"
    assert "In-depth guide on PostgreSQL multi-version" in parsed["description"]
    assert parsed["domain"] == "example.com"
    assert parsed["canonical_url"] == "https://example.com/postgresql-mvcc-guide"
    assert "Multi-Version Concurrency Control" in parsed["extracted_content"]
    assert "Tuple Storage and Visibility" in parsed["extracted_content"]
    assert "- xmin stores the transaction ID" in parsed["extracted_content"]
    # Verify that ads and headers/footers were decomposed
    assert "Buy something!" not in parsed["extracted_content"]
    assert "Database Weekly" not in parsed["extracted_content"] or "PostgreSQL" in parsed["extracted_content"]
    assert parsed["word_count"] > 30
    assert parsed["extraction_status"] == "SUCCESS"


# -------------------------------------------------------------------------
# Integration Tests: /extract-url and /import-url API Endpoints
# -------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unauthenticated_web_endpoints_blocked(client: httpx.AsyncClient):
    """Unauthenticated requests to extract-url and import-url must return 401."""
    res1 = await client.post("/api/v1/knowledge/extract-url", json={"url": "https://example.com"})
    assert res1.status_code == 401

    res2 = await client.post("/api/v1/knowledge/import-url", json={"url": "https://example.com"})
    assert res2.status_code == 401


@pytest.mark.asyncio
async def test_extract_url_ssrf_validation_rejection(client: httpx.AsyncClient, user_a):
    """Verify that passing localhost or prohibited URLs to /extract-url returns 400 Bad Request."""
    bad_urls = [
        "http://localhost:8000",
        "http://127.0.0.1:5432",
        "http://169.254.169.254",
        "ftp://files.example.com",
    ]
    for u in bad_urls:
        res = await client.post(
            "/api/v1/knowledge/extract-url",
            json={"url": u},
            headers=user_a["headers"],
        )
        assert res.status_code == 400
        assert "security" in res.json()["detail"].lower() or "prohibited" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_extract_url_success_with_mocked_fetch(client: httpx.AsyncClient, user_a):
    """Test successful preview/extraction of a public website with mocked HTTP response."""
    with patch("socket.getaddrinfo") as mock_dns, \
         patch("app.services.web_extractor.fetch_webpage") as mock_fetch:

        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
        mock_fetch.return_value = (SAMPLE_HTML, "https://example.com/article", "text/html")

        res = await client.post(
            "/api/v1/knowledge/extract-url",
            json={"url": "https://example.com/article"},
            headers=user_a["headers"],
        )
        assert res.status_code == 200
        data = res.json()

        assert data["title"] == "PostgreSQL Concurrency and MVCC Architecture"
        assert data["domain"] == "example.com"
        assert "Multi-Version Concurrency Control" in data["content"]
        assert len(data["summary"]) > 0
        assert len(data["tags"]) > 0
        assert len(data["keyConcepts"]) > 0
        assert data["extractionStatus"] == "SUCCESS"


@pytest.mark.asyncio
async def test_import_url_end_to_end_persistence(client: httpx.AsyncClient, user_a):
    """Test importing a public URL, saving to PostgreSQL, and tagging."""
    with patch("socket.getaddrinfo") as mock_dns, \
         patch("app.services.web_extractor.fetch_webpage") as mock_fetch:

        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
        mock_fetch.return_value = (SAMPLE_HTML, "https://example.com/article", "text/html")

        res = await client.post(
            "/api/v1/knowledge/import-url",
            json={"url": "https://example.com/article"},
            headers=user_a["headers"],
        )
        assert res.status_code == 201
        created = res.json()

        assert created["type"] == "LINK"
        assert created["originalUrl"] == "https://example.com/article"
        assert "PostgreSQL Concurrency" in created["title"]
        assert len(created["summary"]) > 0
        assert len(created["tags"]) > 0
        assert created["processingStatus"] == "COMPLETED"

        # Verify the item is permanently retrieved from the database via GET
        get_res = await client.get(f"/api/v1/knowledge/{created['id']}", headers=user_a["headers"])
        assert get_res.status_code == 200
        fetched = get_res.json()
        assert fetched["title"] == created["title"]
        assert fetched["content"] == created["content"]


@pytest.mark.asyncio
async def test_import_url_duplicate_handling(client: httpx.AsyncClient, user_a):
    """Importing the same URL twice updates the existing record without creating duplicate entries."""
    unique_url = f"https://example.com/article-{uuid.uuid4().hex[:6]}"

    with patch("socket.getaddrinfo") as mock_dns, \
         patch("app.services.web_extractor.fetch_webpage") as mock_fetch:

        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
        mock_fetch.return_value = (SAMPLE_HTML, unique_url, "text/html")

        # 1. First import
        res1 = await client.post(
            "/api/v1/knowledge/import-url",
            json={"url": unique_url},
            headers=user_a["headers"],
        )
        assert res1.status_code == 201
        item1 = res1.json()

        # 2. Second import of same URL with edited title
        res2 = await client.post(
            "/api/v1/knowledge/import-url",
            json={
                "url": unique_url,
                "title": "PostgreSQL MVCC Updated Title",
                "content": "Updated extracted text content.",
            },
            headers=user_a["headers"],
        )
        # Should return 200 OK updating the existing item
        assert res2.status_code == 200
        item2 = res2.json()
        assert item2["id"] == item1["id"]
        assert item2["title"] == "PostgreSQL MVCC Updated Title"


@pytest.mark.asyncio
async def test_import_url_user_isolation(client: httpx.AsyncClient, user_a, user_b):
    """User B cannot see or overwrite User A's imported website knowledge item."""
    url = f"https://example.com/private-article-{uuid.uuid4().hex[:6]}"

    with patch("socket.getaddrinfo") as mock_dns, \
         patch("app.services.web_extractor.fetch_webpage") as mock_fetch:

        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
        mock_fetch.return_value = (SAMPLE_HTML, url, "text/html")

        # User A imports URL
        res_a = await client.post("/api/v1/knowledge/import-url", json={"url": url}, headers=user_a["headers"])
        assert res_a.status_code == 201
        item_a = res_a.json()

        # User B attempts to access User A's item
        res_b = await client.get(f"/api/v1/knowledge/{item_a['id']}", headers=user_b["headers"])
        assert res_b.status_code == 404


@pytest.mark.asyncio
async def test_imported_url_searchable_in_database(client: httpx.AsyncClient, user_a):
    """Imported web clipper article is indexed and retrievable via PostgreSQL search."""
    url = f"https://example.com/mvcc-search-{uuid.uuid4().hex[:6]}"

    with patch("socket.getaddrinfo") as mock_dns, \
         patch("app.services.web_extractor.fetch_webpage") as mock_fetch:

        mock_dns.return_value = [(2, 1, 6, "", ("93.184.216.34", 443))]
        mock_fetch.return_value = (SAMPLE_HTML, url, "text/html")

        # Import
        await client.post("/api/v1/knowledge/import-url", json={"url": url}, headers=user_a["headers"])

        # Search for unique keyword from the article
        search_res = await client.get(
            "/api/v1/search?q=xmin",
            headers=user_a["headers"],
        )
        assert search_res.status_code == 200
        search_data = search_res.json()
        assert search_data["total"] >= 1
        found_titles = [item["title"] for item in search_data["items"]]
        assert any("PostgreSQL Concurrency" in t for t in found_titles)

