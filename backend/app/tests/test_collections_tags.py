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
    unique = uuid.uuid4().hex[:8]
    email = f"user_a_{unique}@example.com"
    pwd = "PasswordA123!"
    # Signup
    signup_res = await client.post("/api/v1/auth/signup", json={
        "name": "User A",
        "email": email,
        "password": pwd
    })
    assert signup_res.status_code == 201

    # Login
    login_res = await client.post("/api/v1/auth/login", json={
        "username": email,
        "password": pwd
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest_asyncio.fixture
async def user_b(client: httpx.AsyncClient):
    unique = uuid.uuid4().hex[:8]
    email = f"user_b_{unique}@example.com"
    pwd = "PasswordB123!"
    # Signup
    signup_res = await client.post("/api/v1/auth/signup", json={
        "name": "User B",
        "email": email,
        "password": pwd
    })
    assert signup_res.status_code == 201

    # Login
    login_res = await client.post("/api/v1/auth/login", json={
        "username": email,
        "password": pwd
    })
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"email": email, "token": token, "headers": {"Authorization": f"Bearer {token}"}}


@pytest.mark.asyncio
async def test_unauthenticated_access_blocked(client: httpx.AsyncClient):
    """Endpoints must reject unauthenticated requests with 401."""
    res_cols = await client.get("/api/v1/collections")
    assert res_cols.status_code == 401

    res_post_col = await client.post("/api/v1/collections", json={"name": "No Auth"})
    assert res_post_col.status_code == 401

    res_tags = await client.get("/api/v1/tags")
    assert res_tags.status_code == 401

    res_post_tag = await client.post("/api/v1/tags", json={"name": "No Auth"})
    assert res_post_tag.status_code == 401


@pytest.mark.asyncio
async def test_collections_crud_and_isolation(client: httpx.AsyncClient, user_a: dict, user_b: dict):
    """Test full collections lifecycle, CRUD, and strict user isolation."""
    # 1. Create collection as User A
    create_res = await client.post(
        "/api/v1/collections",
        headers=user_a["headers"],
        json={
            "name": "Architecture Patterns",
            "description": "Distributed systems notes",
            "icon": "FolderKanban",
            "color": "#8B5CF6",
        },
    )
    assert create_res.status_code == 201
    col_a = create_res.json()
    assert col_a["name"] == "Architecture Patterns"
    assert col_a["description"] == "Distributed systems notes"
    assert col_a["icon"] == "FolderKanban"
    assert col_a["color"] == "#8B5CF6"
    assert col_a["itemCount"] == 0
    assert "createdAt" in col_a
    col_id = col_a["id"]

    # 2. List collections for User A
    list_a = await client.get("/api/v1/collections", headers=user_a["headers"])
    assert list_a.status_code == 200
    items_a = list_a.json()
    assert any(c["id"] == col_id for c in items_a)

    # 3. User B cannot see User A's collection
    list_b = await client.get("/api/v1/collections", headers=user_b["headers"])
    assert list_b.status_code == 200
    items_b = list_b.json()
    assert not any(c["id"] == col_id for c in items_b)

    # 4. User B cannot GET User A's collection (404)
    get_b = await client.get(f"/api/v1/collections/{col_id}", headers=user_b["headers"])
    assert get_b.status_code == 404

    # 5. User A can GET their own collection
    get_a = await client.get(f"/api/v1/collections/{col_id}", headers=user_a["headers"])
    assert get_a.status_code == 200
    assert get_a.json()["id"] == col_id

    # 6. User B cannot PATCH User A's collection (404)
    patch_b = await client.patch(
        f"/api/v1/collections/{col_id}",
        headers=user_b["headers"],
        json={"name": "Hacked Collection"},
    )
    assert patch_b.status_code == 404

    # 7. User A can PATCH their own collection
    patch_a = await client.patch(
        f"/api/v1/collections/{col_id}",
        headers=user_a["headers"],
        json={"name": "Updated Architecture Patterns", "color": "#10B981"},
    )
    assert patch_a.status_code == 200
    assert patch_a.json()["name"] == "Updated Architecture Patterns"
    assert patch_a.json()["color"] == "#10B981"

    # 8. User B cannot DELETE User A's collection (404)
    del_b = await client.delete(f"/api/v1/collections/{col_id}", headers=user_b["headers"])
    assert del_b.status_code == 404

    # 9. User A can DELETE their own collection (204)
    del_a = await client.delete(f"/api/v1/collections/{col_id}", headers=user_a["headers"])
    assert del_a.status_code == 204

    # 10. Collection is gone for User A
    get_a_deleted = await client.get(f"/api/v1/collections/{col_id}", headers=user_a["headers"])
    assert get_a_deleted.status_code == 404


@pytest.mark.asyncio
async def test_tags_crud_isolation_and_duplicates(client: httpx.AsyncClient, user_a: dict, user_b: dict):
    """Test full tags lifecycle, CRUD, user isolation, and duplicate name constraints."""
    # 1. Create tag as User A
    create_res = await client.post(
        "/api/v1/tags",
        headers=user_a["headers"],
        json={"name": "#kubernetes", "color": "#3B82F6"},
    )
    assert create_res.status_code == 201
    tag_a = create_res.json()
    assert tag_a["name"] == "kubernetes"  # Strip # symbol
    assert tag_a["color"] == "#3B82F6"
    assert tag_a["itemCount"] == 0
    tag_id = tag_a["id"]

    # 2. Duplicate tag name under User A returns 409 Conflict
    dup_res = await client.post(
        "/api/v1/tags",
        headers=user_a["headers"],
        json={"name": "KUBERNETES", "color": "#EF4444"},
    )
    assert dup_res.status_code == 409

    # 3. User B can create a tag with the SAME name (uniqueness is per user)
    create_b = await client.post(
        "/api/v1/tags",
        headers=user_b["headers"],
        json={"name": "kubernetes", "color": "#EC4899"},
    )
    assert create_b.status_code == 201
    tag_b_id = create_b.json()["id"]
    assert tag_b_id != tag_id

    # 4. User A list contains tag_id, not tag_b_id
    list_a = await client.get("/api/v1/tags", headers=user_a["headers"])
    assert list_a.status_code == 200
    ids_a = [t["id"] for t in list_a.json()]
    assert tag_id in ids_a
    assert tag_b_id not in ids_a

    # 5. User B list contains tag_b_id, not tag_id
    list_b = await client.get("/api/v1/tags", headers=user_b["headers"])
    assert list_b.status_code == 200
    ids_b = [t["id"] for t in list_b.json()]
    assert tag_b_id in ids_b
    assert tag_id not in ids_b

    # 6. User B cannot GET User A's tag (404)
    get_b = await client.get(f"/api/v1/tags/{tag_id}", headers=user_b["headers"])
    assert get_b.status_code == 404

    # 7. User A can GET their own tag
    get_a = await client.get(f"/api/v1/tags/{tag_id}", headers=user_a["headers"])
    assert get_a.status_code == 200
    assert get_a.json()["id"] == tag_id

    # 8. User B cannot PATCH User A's tag (404)
    patch_b = await client.patch(
        f"/api/v1/tags/{tag_id}",
        headers=user_b["headers"],
        json={"name": "k8s"},
    )
    assert patch_b.status_code == 404

    # 9. User A can PATCH their own tag
    patch_a = await client.patch(
        f"/api/v1/tags/{tag_id}",
        headers=user_a["headers"],
        json={"name": "k8s-prod", "color": "#F59E0B"},
    )
    assert patch_a.status_code == 200
    assert patch_a.json()["name"] == "k8s-prod"
    assert patch_a.json()["color"] == "#F59E0B"

    # 10. User B cannot DELETE User A's tag (404)
    del_b = await client.delete(f"/api/v1/tags/{tag_id}", headers=user_b["headers"])
    assert del_b.status_code == 404

    # 11. User A can DELETE their own tag (204)
    del_a = await client.delete(f"/api/v1/tags/{tag_id}", headers=user_a["headers"])
    assert del_a.status_code == 204

    # 12. Tag is gone for User A
    get_a_deleted = await client.get(f"/api/v1/tags/{tag_id}", headers=user_a["headers"])
    assert get_a_deleted.status_code == 404

    # 13. User B's tag is unaffected
    get_b_still_exists = await client.get(f"/api/v1/tags/{tag_b_id}", headers=user_b["headers"])
    assert get_b_still_exists.status_code == 200
