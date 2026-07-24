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


@pytest.mark.asyncio
async def test_non_recurring_has_null_series_id(client, auth_headers):
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={"name": "Plain task", "due_at": _iso(1)},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["series_id"] is None


@pytest.mark.asyncio
async def test_recurring_weekly_creates_series(client, auth_headers):
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "name": "Weekly sync",
            "severity": "high",
            "due_at": _iso(1),
            "recurrence_frequency": "weekly",
            "recurrence_interval": 2,
            "recurrence_count": 5,
        },
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    series_id = created["series_id"]
    assert series_id is not None

    listing = await client.get(
        "/api/v1/tasks", headers=auth_headers, params={"page_size": 200}
    )
    series_items = [t for t in listing.json()["items"] if t["series_id"] == series_id]
    series_items.sort(key=lambda t: t["due_at"])
    assert len(series_items) == 5
    assert all(t["name"] == "Weekly sync" and t["severity"] == "high" for t in series_items)

    from datetime import datetime

    due_dates = [datetime.fromisoformat(t["due_at"]) for t in series_items]
    for a, b in zip(due_dates, due_dates[1:]):
        assert (b - a).days == 14


@pytest.mark.asyncio
async def test_recurring_until_and_count_mutually_exclusive(client, auth_headers):
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "name": "Bad recurrence",
            "due_at": _iso(1),
            "recurrence_frequency": "daily",
            "recurrence_until": _iso(10),
            "recurrence_count": 3,
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recurring_count_exceeds_hard_cap(client, auth_headers):
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "name": "Too many",
            "due_at": _iso(1),
            "recurrence_frequency": "daily",
            "recurrence_count": 500,
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_recurring_until_hard_capped(client, auth_headers):
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "name": "Long daily series",
            "due_at": _iso(1),
            "recurrence_frequency": "daily",
            "recurrence_interval": 1,
            "recurrence_until": _iso(365 * 5),
        },
    )
    assert resp.status_code == 201, resp.text
    series_id = resp.json()["series_id"]

    listing = await client.get(
        "/api/v1/tasks", headers=auth_headers, params={"page_size": 200}
    )
    series_items = [t for t in listing.json()["items"] if t["series_id"] == series_id]
    assert len(series_items) == 100


@pytest.mark.asyncio
async def test_recurring_monthly_rollover(client, auth_headers):
    from datetime import datetime, timedelta, timezone

    # Fixed future date known to have 31 days, so the clamp on shorter months
    # (Feb, Apr) is exercised deterministically regardless of "today".
    due = datetime(2030, 1, 31, 9, 0, 0, tzinfo=timezone.utc)
    resp = await client.post(
        "/api/v1/tasks",
        headers=auth_headers,
        json={
            "name": "Month-end task",
            "due_at": due.isoformat(),
            "recurrence_frequency": "monthly",
            "recurrence_count": 3,
        },
    )
    assert resp.status_code == 201, resp.text
    series_id = resp.json()["series_id"]

    listing = await client.get(
        "/api/v1/tasks", headers=auth_headers, params={"page_size": 200}
    )
    series_items = [t for t in listing.json()["items"] if t["series_id"] == series_id]
    series_items.sort(key=lambda t: t["due_at"])
    assert len(series_items) == 3

    expected_days = [31, 28, 31]  # Jan 31 -> Feb 28 (2030 not a leap year) -> Mar 31
    for t, expected_day in zip(series_items, expected_days):
        d = datetime.fromisoformat(t["due_at"])
        assert d.day == expected_day
