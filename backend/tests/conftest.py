import os

os.environ.setdefault("MOCK_DB", "true")
os.environ.setdefault("MOCK_AUTH", "true")
os.environ.setdefault("SEED_ON_STARTUP", "false")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import connect_to_mongo, close_mongo_connection
from app.main import app


@pytest_asyncio.fixture
async def client():
    await connect_to_mongo()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    await close_mongo_connection()


@pytest_asyncio.fixture
async def auth_headers(client):
    resp = await client.post(
        "/api/v1/auth/dev-login", json={"email": "tester@example.com", "name": "Tester"}
    )
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
