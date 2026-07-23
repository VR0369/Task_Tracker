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
async def test_start_date(client, auth_headers):
    # start_at is optional
    plain = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "No start", "due_at": _iso(1)},
    )
    assert plain.status_code == 201
    assert plain.json()["start_at"] is None

    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Has start", "due_at": _iso(3), "start_at": _iso(1)},
    )
    assert resp.status_code == 201, resp.text
    task_id = resp.json()["id"]
    assert resp.json()["start_at"] is not None

    # Start after due is rejected on create...
    bad = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Backwards", "due_at": _iso(1), "start_at": _iso(4)},
    )
    assert bad.status_code == 422

    # ...and on update, including against the task's stored due date.
    bad_patch = await client.patch(
        f"/api/v1/tasks/{task_id}", headers=auth_headers, json={"start_at": _iso(5)}
    )
    assert bad_patch.status_code == 400

    # Explicit null clears it
    cleared = await client.patch(
        f"/api/v1/tasks/{task_id}", headers=auth_headers, json={"start_at": None}
    )
    assert cleared.status_code == 200
    assert cleared.json()["start_at"] is None

    ordered = await client.get(
        "/api/v1/tasks", headers=auth_headers, params={"sort": "start_at"}
    )
    assert ordered.status_code == 200


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


@pytest.mark.asyncio
async def test_personal_vs_shared_scope(client):
    # Parent (admin) creates a task on their own calendar, then invites a child.
    parent = (await client.post("/api/v1/auth/dev-login", json={"email": "parent@example.com"})).json()
    parent_h = {"Authorization": f"Bearer {parent['access_token']}"}
    parent_cal = parent["user"]["default_calendar_id"]

    await client.post(
        "/api/v1/tasks",
        headers=parent_h,
        json={"name": "Parent's task", "due_at": _iso(1), "calendar_id": parent_cal},
    )

    inv = await client.post(
        "/api/v1/invites",
        headers=parent_h,
        json={"email": "child@example.com", "role": "contributor", "calendar_id": parent_cal},
    )
    token = inv.json()["invitation"]["token"]

    child = (await client.post("/api/v1/auth/dev-login", json={"email": "child@example.com"})).json()
    child_h = {"Authorization": f"Bearer {child['access_token']}"}
    accept = await client.post("/api/v1/invites/accept", headers=child_h, json={"token": token})
    assert accept.json()["status"] == "approved"

    # Child creates their own task on their own (personal) calendar.
    child_cal = child["user"]["default_calendar_id"]
    await client.post(
        "/api/v1/tasks",
        headers=child_h,
        json={"name": "Child's own task", "due_at": _iso(1), "calendar_id": child_cal},
    )

    # Personal: only the child's own task.
    personal = await client.get(
        "/api/v1/tasks", headers=child_h, params={"scope": "personal"}
    )
    personal_names = {t["name"] for t in personal.json()["items"]}
    assert personal_names == {"Child's own task"}

    # Shared: only the parent's task, with creator name attached.
    shared = await client.get("/api/v1/tasks", headers=child_h, params={"scope": "shared"})
    shared_items = shared.json()["items"]
    shared_names = {t["name"] for t in shared_items}
    assert shared_names == {"Parent's task"}
    assert shared_items[0]["created_by_name"]

    # Dashboard mirrors the same split via the past/upcoming buckets total count.
    dash_personal = await client.get(
        "/api/v1/dashboard", headers=child_h, params={"scope": "personal"}
    )
    dash_shared = await client.get(
        "/api/v1/dashboard", headers=child_h, params={"scope": "shared"}
    )
    assert dash_personal.status_code == 200 and dash_shared.status_code == 200
