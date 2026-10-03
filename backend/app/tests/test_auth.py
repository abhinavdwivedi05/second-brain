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


@pytest.mark.asyncio
async def test_auth_full_cycle(client: httpx.AsyncClient):
    uid = uuid.uuid4().hex[:8]
    email = f"auth_test_{uid}@example.com"
    password = "SecurePassword123!"
    name = "Auth Test User"

    # 1. Signup
    signup_res = await client.post("/api/v1/auth/signup", json={
        "name": name,
        "email": email,
        "password": password
    })
    assert signup_res.status_code == 201
    user_data = signup_res.json()
    assert user_data["email"] == email
    assert user_data["name"] == name

    # 2. Duplicate signup returns 409
    dup_res = await client.post("/api/v1/auth/signup", json={
        "name": name,
        "email": email,
        "password": password
    })
    assert dup_res.status_code == 409

    # 3. Wrong password returns 401
    wrong_pwd_res = await client.post("/api/v1/auth/login", json={
        "username": email,
        "password": "WrongPassword!"
    })
    assert wrong_pwd_res.status_code == 401

    # 4. Valid login with JSON payload returns JWT access token
    login_res = await client.post("/api/v1/auth/login", json={
        "username": email,
        "password": password
    })
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # 5. GET /api/v1/auth/me without token returns 401
    unauth_me = await client.get("/api/v1/auth/me")
    assert unauth_me.status_code == 401

    # 6. GET /api/v1/auth/me with invalid token returns 401
    bad_token_me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"}
    )
    assert bad_token_me.status_code == 401

    # 7. GET /api/v1/auth/me with Bearer token succeeds
    auth_me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert auth_me.status_code == 200
    profile = auth_me.json()
    assert profile["email"] == email
    assert profile["name"] == name
