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
    email = f"user_k_a_{uid}@example.com"
    pwd = "PasswordA123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User KA", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"user_k_b_{uid}@example.com"
    pwd = "PasswordB123!"
    res = await client.post("/api/v1/auth/signup", json={"name": "User KB", "email": email, "password": pwd})
    assert res.status_code == 201
    login_res = await client.post("/api/v1/auth/login", json={"username": email, "password": pwd})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.mark.asyncio
async def test_unauthenticated_knowledge_access_blocked(client: httpx.AsyncClient):
    """Unauthenticated users must receive 401 on all knowledge endpoints."""
    res_list = await client.get("/api/v1/knowledge")
    assert res_list.status_code == 401

    res_create = await client.post("/api/v1/knowledge", json={"title": "Test"})
    assert res_create.status_code == 401

    res_get = await client.get("/api/v1/knowledge/some-id")
    assert res_get.status_code == 401

    res_patch = await client.patch("/api/v1/knowledge/some-id", json={"title": "Updated"})
    assert res_patch.status_code == 401

    res_del = await client.delete("/api/v1/knowledge/some-id")
    assert res_del.status_code == 401


@pytest.mark.asyncio
async def test_knowledge_create_and_validation(client: httpx.AsyncClient, user_a: dict):
    """Test note creation, validation, and field defaults."""
    # 1. Missing title validation
    empty_res = await client.post(
        "/api/v1/knowledge",
        headers=user_a["headers"],
        json={"title": "   ", "type": "NOTE"},
    )
    assert empty_res.status_code in (422, 400)

    # 2. Successful creation
    create_res = await client.post(
        "/api/v1/knowledge",
        headers=user_a["headers"],
        json={
            "title": "PostgreSQL Architecture Principles",
            "type": "NOTE",
            "content": "Deep dive into MVCC, WAL, and write amplification.",
            "summary": "Postgres storage internals overview.",
            "tags": ["postgres", "database", "backend"],
            "isFavorite": True,
        },
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["title"] == "PostgreSQL Architecture Principles"
    assert data["type"] == "NOTE"
    assert data["content"] == "Deep dive into MVCC, WAL, and write amplification."
    assert data["summary"] == "Postgres storage internals overview."
    assert set(data["tags"]) == {"postgres", "database", "backend"}
    assert data["isFavorite"] is True
    assert data["isArchived"] is False
    assert "id" in data
    assert "createdAt" in data


@pytest.mark.asyncio
async def test_knowledge_collection_and_tag_ownership(
    client: httpx.AsyncClient, user_a: dict, user_b: dict
):
    """Users cannot assign other users' collections or access cross-user items."""
    # User A creates a collection
    col_a = (
        await client.post(
            "/api/v1/collections",
            headers=user_a["headers"],
            json={"name": "User A Private Collection"},
        )
    ).json()
    col_a_id = col_a["id"]

    # User B attempts to create a note referencing User A's collection -> rejected (404)
    hacked_note = await client.post(
        "/api/v1/knowledge",
        headers=user_b["headers"],
        json={"title": "Cross User Note", "collectionId": col_a_id},
    )
    assert hacked_note.status_code == 404

    # User A creates a note in their collection
    valid_note = (
        await client.post(
            "/api/v1/knowledge",
            headers=user_a["headers"],
            json={
                "title": "User A Note in Collection",
                "collectionId": col_a_id,
                "tags": ["private-tag"],
            },
        )
    ).json()
    note_id = valid_note["id"]
    assert valid_note["collectionId"] == col_a_id
    assert valid_note["collectionName"] == "User A Private Collection"

    # User B cannot GET User A's note (404)
    get_b = await client.get(f"/api/v1/knowledge/{note_id}", headers=user_b["headers"])
    assert get_b.status_code == 404

    # User B cannot PATCH User A's note (404)
    patch_b = await client.patch(
        f"/api/v1/knowledge/{note_id}",
        headers=user_b["headers"],
        json={"title": "Hacked Title"},
    )
    assert patch_b.status_code == 404

    # User B cannot DELETE User A's note (404)
    del_b = await client.delete(f"/api/v1/knowledge/{note_id}", headers=user_b["headers"])
    assert del_b.status_code == 404


@pytest.mark.asyncio
async def test_knowledge_crud_lifecycle_and_filters(client: httpx.AsyncClient, user_a: dict):
    """Test full CRUD lifecycle, updates, favorite toggle, filtering, and deletion."""
    # 1. Create collection
    col = (
        await client.post(
            "/api/v1/collections",
            headers=user_a["headers"],
            json={"name": "Engineering Notes", "color": "#10B981"},
        )
    ).json()
    col_id = col["id"]

    # 2. Create Note 1
    n1 = (
        await client.post(
            "/api/v1/knowledge",
            headers=user_a["headers"],
            json={
                "title": "React 19 Server Components",
                "type": "NOTE",
                "content": "RSC hydration model.",
                "collectionId": col_id,
                "tags": ["react", "frontend"],
                "isFavorite": True,
            },
        )
    ).json()

    # 3. Create Note 2 (LINK)
    n2 = (
        await client.post(
            "/api/v1/knowledge",
            headers=user_a["headers"],
            json={
                "title": "FastAPI Async Documentation",
                "type": "LINK",
                "originalUrl": "https://fastapi.tiangolo.com",
                "content": "Official FastAPI reference.",
                "tags": ["python", "backend"],
                "isFavorite": False,
            },
        )
    ).json()

    # 4. Filter by type=NOTE
    res_notes = await client.get("/api/v1/knowledge?type=NOTE", headers=user_a["headers"])
    assert res_notes.status_code == 200
    items_notes = res_notes.json()
    assert any(item["id"] == n1["id"] for item in items_notes)
    assert not any(item["id"] == n2["id"] for item in items_notes)

    # 5. Filter by collection
    res_col = await client.get(f"/api/v1/knowledge?collection_id={col_id}", headers=user_a["headers"])
    assert res_col.status_code == 200
    items_col = res_col.json()
    assert any(item["id"] == n1["id"] for item in items_col)
    assert not any(item["id"] == n2["id"] for item in items_col)

    # 6. Filter by tag
    res_tag = await client.get("/api/v1/knowledge?tag=python", headers=user_a["headers"])
    assert res_tag.status_code == 200
    items_tag = res_tag.json()
    assert any(item["id"] == n2["id"] for item in items_tag)
    assert not any(item["id"] == n1["id"] for item in items_tag)

    # 7. Filter favorites
    res_fav = await client.get("/api/v1/knowledge?favorites_only=true", headers=user_a["headers"])
    assert res_fav.status_code == 200
    items_fav = res_fav.json()
    assert any(item["id"] == n1["id"] for item in items_fav)
    assert not any(item["id"] == n2["id"] for item in items_fav)

    # 8. Text search
    res_search = await client.get("/api/v1/knowledge?q=hydration", headers=user_a["headers"])
    assert res_search.status_code == 200
    items_search = res_search.json()
    assert any(item["id"] == n1["id"] for item in items_search)
    assert not any(item["id"] == n2["id"] for item in items_search)

    # 9. Update Note 1 (edit title and content, change tags)
    patch_res = await client.patch(
        f"/api/v1/knowledge/{n1['id']}",
        headers=user_a["headers"],
        json={
            "title": "React 19 Server Components Deep Dive",
            "content": "Updated content with streaming SSR explanations.",
            "tags": ["react", "nextjs", "frontend"],
        },
    )
    assert patch_res.status_code == 200
    updated_n1 = patch_res.json()
    assert updated_n1["title"] == "React 19 Server Components Deep Dive"
    assert updated_n1["content"] == "Updated content with streaming SSR explanations."
    assert set(updated_n1["tags"]) == {"react", "nextjs", "frontend"}

    # 10. Toggle favorite
    fav_res = await client.post(
        f"/api/v1/knowledge/{n1['id']}/favorite",
        headers=user_a["headers"],
    )
    assert fav_res.status_code == 200
    assert fav_res.json()["isFavorite"] is False

    # 11. Delete Note 1
    del_res = await client.delete(f"/api/v1/knowledge/{n1['id']}", headers=user_a["headers"])
    assert del_res.status_code == 204

    # 12. Verify Note 1 is gone
    get_del = await client.get(f"/api/v1/knowledge/{n1['id']}", headers=user_a["headers"])
    assert get_del.status_code == 404


@pytest.mark.asyncio
async def test_knowledge_batch_create(client: httpx.AsyncClient, user_a: dict):
    """Test idempotent batch creation for legacy migration."""
    batch_payload = [
        {"title": "Batch Note 1", "content": "Content 1", "tags": ["batch"]},
        {"title": "Batch Note 2", "content": "Content 2", "tags": ["batch"]},
    ]
    res = await client.post("/api/v1/knowledge/batch", headers=user_a["headers"], json=batch_payload)
    assert res.status_code == 201
    items = res.json()
    titles = [item["title"] for item in items]
    assert "Batch Note 1" in titles
    assert "Batch Note 2" in titles

    # Running batch again with the same titles should not create duplicates
    res2 = await client.post("/api/v1/knowledge/batch", headers=user_a["headers"], json=batch_payload)
    assert res2.status_code == 201
    items2 = res2.json()
    matching1 = [item for item in items2 if item["title"] == "Batch Note 1"]
    assert len(matching1) == 1


@pytest.mark.asyncio
async def test_collection_and_tag_counts_and_cascade(client: httpx.AsyncClient, user_a: dict):
    """Test accurate collection and tag item count calculations and cascade behavior."""
    # 1. Create Collection
    col_res = await client.post(
        "/api/v1/collections",
        headers=user_a["headers"],
        json={"name": "Database Systems", "color": "#3B82F6"},
    )
    assert col_res.status_code == 201
    col_id = col_res.json()["id"]

    # Collection item count starts at 0
    get_col = await client.get(f"/api/v1/collections/{col_id}", headers=user_a["headers"])
    assert get_col.json()["itemCount"] == 0

    # 2. Create Tag
    tag_res = await client.post(
        "/api/v1/tags",
        headers=user_a["headers"],
        json={"name": "storage-engines", "color": "#10B981"},
    )
    assert tag_res.status_code == 201
    tag_id = tag_res.json()["id"]

    # Tag item count starts at 0
    get_tag = await client.get(f"/api/v1/tags/{tag_id}", headers=user_a["headers"])
    assert get_tag.json()["itemCount"] == 0

    # 3. Create Note 1 in Collection with Tag
    note_1 = (
        await client.post(
            "/api/v1/knowledge",
            headers=user_a["headers"],
            json={
                "title": "LSM Trees vs B+ Trees",
                "collectionId": col_id,
                "tags": ["storage-engines"],
            },
        )
    ).json()

    # 4. Create Note 2 in Collection with Tag
    note_2 = (
        await client.post(
            "/api/v1/knowledge",
            headers=user_a["headers"],
            json={
                "title": "WAL Logging Internals",
                "collectionId": col_id,
                "tags": ["storage-engines"],
            },
        )
    ).json()

    # 5. Verify counts updated in Collections and Tags endpoints
    col_list = (await client.get("/api/v1/collections", headers=user_a["headers"])).json()
    target_col = next(c for c in col_list if c["id"] == col_id)
    assert target_col["itemCount"] == 2

    tag_list = (await client.get("/api/v1/tags", headers=user_a["headers"])).json()
    target_tag = next(t for t in tag_list if t["id"] == tag_id)
    assert target_tag["itemCount"] == 2

    # 6. Delete Note 1 -> Counts decrement to 1
    del_res = await client.delete(f"/api/v1/knowledge/{note_1['id']}", headers=user_a["headers"])
    assert del_res.status_code == 204

    col_list2 = (await client.get("/api/v1/collections", headers=user_a["headers"])).json()
    assert next(c for c in col_list2 if c["id"] == col_id)["itemCount"] == 1

    # 7. Delete Collection -> Note 2 collectionId becomes null without corrupting note
    del_col_res = await client.delete(f"/api/v1/collections/{col_id}", headers=user_a["headers"])
    assert del_col_res.status_code == 204

    note_2_after = (await client.get(f"/api/v1/knowledge/{note_2['id']}", headers=user_a["headers"])).json()
    assert note_2_after["collectionId"] is None
    assert "storage-engines" in note_2_after["tags"]

    # 8. Delete Tag -> Note 2 remains valid
    del_tag_res = await client.delete(f"/api/v1/tags/{tag_id}", headers=user_a["headers"])
    assert del_tag_res.status_code == 204

    note_2_final = (await client.get(f"/api/v1/knowledge/{note_2['id']}", headers=user_a["headers"])).json()
    assert note_2_final["id"] == note_2["id"]

