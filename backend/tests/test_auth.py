import pytest


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_dev_login_and_me(client):
    resp = await client.post("/api/v1/auth/dev-login", json={"email": "a@example.com"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["user"]["email"] == "a@example.com"
    assert data["user"]["default_calendar_id"]

    me = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "a@example.com"


@pytest.mark.asyncio
async def test_me_requires_auth(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_refresh(client):
    login = await client.post("/api/v1/auth/dev-login", json={"email": "r@example.com"})
    refresh_token = login.json()["refresh_token"]
    resp = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    assert resp.json()["access_token"]
