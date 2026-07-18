"""Async MongoDB access layer.

Uses Motor against a real MongoDB in production, or an in-memory
``mongomock-motor`` client when ``settings.mock_db`` is True. Both expose the
identical Motor API, so application code never branches on the mode.
"""

from __future__ import annotations

import logging
import re

from .config import settings

logger = logging.getLogger("task_tracker.db")


def _redact(uri: str) -> str:
    """Mask credentials in a Mongo URI before logging (never log the password)."""
    return re.sub(r"://([^:@/]+):[^@/]+@", r"://\1:***@", uri or "")


class Database:
    client = None
    db = None
    mock: bool = False


db_state = Database()

# Collection names (also referenced by indexes/seed)
USERS = "users"
CALENDARS = "calendars"
TASKS = "tasks"
INVITATIONS = "invitations"
QUOTES_CACHE = "quotes_cache"
WEATHER_PREFS = "weather_preferences"
ACTIVITY_LOGS = "activity_logs"


async def connect_to_mongo() -> None:
    if settings.mock_db:
        from mongomock_motor import AsyncMongoMockClient

        db_state.client = AsyncMongoMockClient()
        db_state.mock = True
        logger.info("Connected to in-memory mock MongoDB (MOCK_DB=true).")
    else:
        from motor.motor_asyncio import AsyncIOMotorClient

        db_state.client = AsyncIOMotorClient(
            settings.mongo_url, uuidRepresentation="standard", tz_aware=True
        )
        db_state.mock = False
        logger.info("Connected to MongoDB at %s", _redact(settings.mongo_url))

    db_state.db = db_state.client[settings.mongo_db_name]
    await create_indexes()


async def close_mongo_connection() -> None:
    if db_state.client is not None:
        db_state.client.close()
        logger.info("Closed MongoDB connection.")


def get_db():
    if db_state.db is None:
        raise RuntimeError("Database not initialised. Call connect_to_mongo() first.")
    return db_state.db


def col(name: str):
    return get_db()[name]


async def create_indexes() -> None:
    """Indexes on frequently queried fields (mongomock accepts these as no-ops)."""
    try:
        await col(USERS).create_index("email", unique=True)
        await col(TASKS).create_index([("calendar_id", 1), ("status", 1), ("due_at", 1)])
        await col(TASKS).create_index([("calendar_id", 1), ("severity", 1)])
        await col(TASKS).create_index("due_at")
        await col(INVITATIONS).create_index("token", unique=True)
        await col(INVITATIONS).create_index([("calendar_id", 1), ("email", 1)])
        await col(ACTIVITY_LOGS).create_index([("calendar_id", 1), ("created_at", -1)])
        await col(CALENDARS).create_index("members.user_id")
        logger.info("Indexes ensured.")
    except Exception as exc:  # pragma: no cover - index creation is best-effort
        logger.warning("Index creation skipped: %s", exc)
