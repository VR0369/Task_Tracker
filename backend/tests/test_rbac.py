from datetime import datetime, timedelta, timezone

import pytest


def _iso(days=1):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


@pytest.mark.asyncio
async def test_viewer_cannot_create(client):
    # Admin sets up a calendar and invites a viewer.
    admin = (await client.post("/api/v1/auth/dev-login", json={"email": "admin@example.com"})).json()
    admin_h = {"Authorization": f"Bearer {admin['access_token']}"}
    cal_id = admin["user"]["default_calendar_id"]

    inv = await client.post(
        "/api/v1/invites",
        headers=admin_h,
        json={"email": "viewer@example.com", "role": "viewer", "calendar_id": cal_id},
    )
    token = inv.json()["invitation"]["token"]

    viewer = (await client.post("/api/v1/auth/dev-login", json={"email": "viewer@example.com"})).json()
    viewer_h = {"Authorization": f"Bearer {viewer['access_token']}"}

    accept = await client.post("/api/v1/invites/accept", headers=viewer_h, json={"token": token})
    assert accept.json()["status"] == "approved"

    # Viewer now a member but must not be able to create a task on that calendar.
    resp = await client.post(
        "/api/v1/tasks",
        headers=viewer_h,
        json={"name": "Nope", "severity": "low", "due_at": _iso(), "calendar_id": cal_id},
    )
    assert resp.status_code == 403
