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
async def auth_user(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_dash_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "Dashboard User", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest_asyncio.fixture
async def other_user(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"other_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "Other User", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.mark.asyncio
async def test_dashboard_stats_empty(client: httpx.AsyncClient, auth_user: dict):
    headers = auth_user["headers"]
    res = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["totalKnowledge"] == 0
    assert data["totalNotes"] == 0
    assert data["totalLinks"] == 0
    assert data["totalDocuments"] == 0
    assert data["totalCollections"] == 0
    assert data["totalTags"] == 0
    assert data["totalFavorites"] == 0
    assert len(data["recentItems"]) == 0
    assert len(data["recentAccessed"]) == 0
    assert len(data["recentActivities"]) == 0

@pytest.mark.asyncio
async def test_dashboard_stats_and_activity_logging_lifecycle(client: httpx.AsyncClient, auth_user: dict, other_user: dict):
    headers = auth_user["headers"]
    other_headers = other_user["headers"]

    # 1. Create a collection
    col_res = await client.post(
        "/api/v1/collections",
        json={"name": "Distributed Systems", "description": "Cloud & systems notes", "icon": "Server", "color": "#10B981"},
        headers=headers,
    )
    assert col_res.status_code == 201
    col_id = col_res.json()["id"]

    # 2. Create a tag
    tag_res = await client.post(
        "/api/v1/tags",
        json={"name": "postgres", "color": "#336791"},
        headers=headers,
    )
    assert tag_res.status_code == 201

    # 3. Create a note
    k_res = await client.post(
        "/api/v1/knowledge",
        json={
            "title": "PostgreSQL MVCC & WAL Internals",
            "type": "NOTE",
            "content": "Deep dive into Multi-Version Concurrency Control and Write-Ahead Logging.",
            "summary": "Explains tuple visibility and durability guarantees.",
            "collectionId": col_id,
            "tags": ["postgres"],
        },
        headers=headers,
    )
    assert k_res.status_code == 201
    k_id = k_res.json()["id"]

    # 4. Favorite the note
    fav_res = await client.post(f"/api/v1/knowledge/{k_id}/favorite", headers=headers)
    assert fav_res.status_code == 200
    assert fav_res.json()["isFavorite"] is True

    # 5. Access the note (triggers last_accessed_at update)
    get_res = await client.get(f"/api/v1/knowledge/{k_id}", headers=headers)
    assert get_res.status_code == 200

    # 6. Update the note
    upd_res = await client.patch(
        f"/api/v1/knowledge/{k_id}",
        json={"title": "PostgreSQL MVCC & WAL Internals (Updated)"},
        headers=headers,
    )
    assert upd_res.status_code == 200

    # 7. Check dashboard stats
    dash_res = await client.get("/api/v1/dashboard/stats", headers=headers)
    assert dash_res.status_code == 200
    stats = dash_res.json()

    assert stats["totalKnowledge"] == 1
    assert stats["totalNotes"] == 1
    assert stats["totalLinks"] == 0
    assert stats["totalDocuments"] == 0
    assert stats["totalCollections"] == 1
    assert stats["totalTags"] == 1
    assert stats["totalFavorites"] == 1
    assert len(stats["recentItems"]) == 1
    assert stats["recentItems"][0]["id"] == k_id
    assert len(stats["recentAccessed"]) == 1
    assert stats["recentAccessed"][0]["id"] == k_id
    assert len(stats["recentActivities"]) >= 4

    # 8. Check activities endpoint
    act_res = await client.get("/api/v1/activities", headers=headers)
    assert act_res.status_code == 200
    activities = act_res.json()
    actions = [a["action"] for a in activities]
    assert "UPDATED" in actions
    assert "FAVORITED" in actions
    assert "CREATED" in actions
    assert "COLLECTION_CREATED" in actions
    assert "TAG_CREATED" in actions

    # 9. Verify user-level isolation: other user cannot see these activities or stats
    other_stats_res = await client.get("/api/v1/dashboard/stats", headers=other_headers)
    assert other_stats_res.status_code == 200
    other_stats = other_stats_res.json()
    assert other_stats["totalKnowledge"] == 0
    assert other_stats["totalCollections"] == 0
    assert len(other_stats["recentActivities"]) == 0

    other_act_res = await client.get("/api/v1/activities", headers=other_headers)
    assert other_act_res.status_code == 200
    assert len(other_act_res.json()) == 0

    # 10. Delete the note and verify DELETED activity logged
    del_res = await client.delete(f"/api/v1/knowledge/{k_id}", headers=headers)
    assert del_res.status_code == 204

    after_del_act = await client.get("/api/v1/activities", headers=headers)
    assert after_del_act.status_code == 200
    first_act = after_del_act.json()[0]
    assert first_act["action"] == "DELETED"
    assert "PostgreSQL MVCC" in first_act["knowledgeTitle"]

