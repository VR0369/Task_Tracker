from datetime import datetime, timedelta, timezone

import pytest


def _iso(days=0, hour=9):
    return (datetime.now(timezone.utc) + timedelta(days=days)).replace(
        hour=hour, minute=0, second=0, microsecond=0
    ).isoformat()


@pytest.mark.asyncio
async def test_task_crud_and_dashboard(client, auth_headers):
    # Create a past-due critical task
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Overdue thing", "severity": "critical", "due_at": _iso(-2)},
    )
    assert resp.status_code == 201, resp.text
    task = resp.json()
    assert task["status"] == "pending"
    task_id = task["id"]

    # It should show in the dashboard past-due card
    dash = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert dash.status_code == 200
    assert dash.json()["past_due"]["critical"] >= 1

    # Complete it -> leaves past-due
    done = await client.post(f"/api/v1/tasks/{task_id}/complete", headers=auth_headers)
    assert done.status_code == 200
    assert done.json()["status"] == "completed"

    dash2 = await client.get("/api/v1/dashboard", headers=auth_headers)
    assert dash2.json()["past_due"]["critical"] == dash.json()["past_due"]["critical"] - 1

    # Listing returns it
    listing = await client.get("/api/v1/tasks", headers=auth_headers)
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    # Delete it
    delete = await client.delete(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert delete.status_code == 204


@pytest.mark.asyncio
async def test_filters_and_sort(client, auth_headers):
    await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Alpha", "severity": "low", "due_at": _iso(1)},
    )
    await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Beta", "severity": "high", "due_at": _iso(2)},
    )
    resp = await client.get(
        "/api/v1/tasks", headers=auth_headers, params={"severity": "high", "search": "Bet"}
    )
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["severity"] == "high" for i in items)
    assert any(i["name"] == "Beta" for i in items)
