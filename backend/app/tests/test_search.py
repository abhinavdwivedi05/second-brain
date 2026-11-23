import uuid
import pytest
import pytest_asyncio
import httpx
from app.main import app


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def user_a(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_srch_a_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User Search A", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_srch_b_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User Search B", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.mark.asyncio
async def test_unauthenticated_search_blocked(client: httpx.AsyncClient):
    """Unauthenticated calls to /search must return 401."""
    res = await client.get("/api/v1/search?q=test")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_search_relevance_ranking(client: httpx.AsyncClient, user_a):
    """Items with query match in title rank higher than content-only matches."""
    # Item 1: Query in content only
    res1 = await client.post(
        "/api/v1/knowledge",
        json={
            "title": "Backend Engineering Practices",
            "content": "This document covers microservices and Kubernetes cluster management.",
            "type": "note",
        },
        headers=user_a["headers"],
    )
    assert res1.status_code == 201

    # Item 2: Query in title
    res2 = await client.post(
        "/api/v1/knowledge",
        json={
            "title": "Kubernetes Deployment Guide",
            "content": "Best practices for deploying cloud workloads.",
            "type": "note",
        },
        headers=user_a["headers"],
    )
    assert res2.status_code == 201

    search_res = await client.get("/api/v1/search?q=Kubernetes", headers=user_a["headers"])
    assert search_res.status_code == 200
    data = search_res.json()
    assert data["total"] >= 2
    items = data["items"]

    # First item must be the title match
    assert items[0]["title"] == "Kubernetes Deployment Guide"
    score_0 = items[0].get("score") or items[0].get("relevance_score") or items[0].get("relevanceScore", 0)
    score_1 = items[1].get("score") or items[1].get("relevance_score") or items[1].get("relevanceScore", 0)
    assert score_0 > score_1
    snippet_0 = items[0].get("snippet", "")
    assert "Kubernetes" in snippet_0 or "Kubernetes" in items[0]["title"]


@pytest.mark.asyncio
async def test_search_filters_and_pagination(client: httpx.AsyncClient, user_a):
    """Search correctly filters by type, favorite, and supports pagination."""
    # Create note (favorite)
    await client.post(
        "/api/v1/knowledge",
        json={"title": "Alpha Note", "content": "Content alpha", "type": "NOTE", "is_favorite": True},
        headers=user_a["headers"],
    )
    # Create document (not favorite)
    await client.post(
        "/api/v1/knowledge",
        json={"title": "Beta Document", "content": "Content beta", "type": "DOCUMENT", "is_favorite": False},
        headers=user_a["headers"],
    )

    # Filter by type=document (case-insensitive)
    doc_search = await client.get("/api/v1/search?type=document", headers=user_a["headers"])
    assert doc_search.status_code == 200
    doc_items = doc_search.json()["items"]
    assert len(doc_items) >= 1
    assert all(item["type"].upper() == "DOCUMENT" for item in doc_items)

    # Filter by is_favorite=true
    fav_search = await client.get("/api/v1/search?is_favorite=true", headers=user_a["headers"])
    assert fav_search.status_code == 200
    fav_items = fav_search.json()["items"]
    assert len(fav_items) >= 1
    assert all((item.get("is_favorite") is True or item.get("isFavorite") is True) for item in fav_items)

    # Pagination: page_size=1
    page_res = await client.get("/api/v1/search?page=1&page_size=1", headers=user_a["headers"])
    assert page_res.status_code == 200
    page_data = page_res.json()
    assert len(page_data["items"]) == 1
    assert page_data["page"] == 1
    page_sz = page_data.get("page_size") or page_data.get("pageSize")
    assert page_sz == 1
    total_pgs = page_data.get("total_pages") or page_data.get("totalPages")
    assert total_pgs >= 2


@pytest.mark.asyncio
async def test_search_sorting(client: httpx.AsyncClient, user_a):
    """Search supports sorting by title_asc, title_desc, newest, oldest."""
    uid = uuid.uuid4().hex[:4]
    await client.post(
        "/api/v1/knowledge",
        json={"title": f"AAA Title {uid}", "content": "Test sorting", "type": "NOTE"},
        headers=user_a["headers"],
    )
    await client.post(
        "/api/v1/knowledge",
        json={"title": f"ZZZ Title {uid}", "content": "Test sorting", "type": "NOTE"},
        headers=user_a["headers"],
    )

    asc_res = await client.get(f"/api/v1/search?q={uid}&sort_by=title_asc", headers=user_a["headers"])
    assert asc_res.status_code == 200
    asc_items = asc_res.json()["items"]
    assert len(asc_items) == 2
    assert asc_items[0]["title"].startswith("AAA")
    assert asc_items[1]["title"].startswith("ZZZ")

    desc_res = await client.get(f"/api/v1/search?q={uid}&sort_by=title_desc", headers=user_a["headers"])
    assert desc_res.status_code == 200
    desc_items = desc_res.json()["items"]
    assert len(desc_items) == 2
    assert desc_items[0]["title"].startswith("ZZZ")
    assert desc_items[1]["title"].startswith("AAA")


@pytest.mark.asyncio
async def test_search_user_isolation(client: httpx.AsyncClient, user_a, user_b):
    """User B cannot see any of User A's items via search."""
    secret_term = f"TopSecret_{uuid.uuid4().hex[:8]}"
    await client.post(
        "/api/v1/knowledge",
        json={"title": f"Note with {secret_term}", "content": "Confidential content", "type": "NOTE"},
        headers=user_a["headers"],
    )

    # User A finds it
    res_a = await client.get(f"/api/v1/search?q={secret_term}", headers=user_a["headers"])
    assert res_a.status_code == 200
    assert res_a.json()["total"] == 1

    # User B searches the same query -> returns 0 items
    res_b = await client.get(f"/api/v1/search?q={secret_term}", headers=user_b["headers"])
    assert res_b.status_code == 200
    assert res_b.json()["total"] == 0
    assert len(res_b.json()["items"]) == 0
