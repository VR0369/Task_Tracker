"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .database import close_mongo_connection, connect_to_mongo
from .reminders import start_scheduler, stop_scheduler
from .routers import (
    activity,
    auth,
    calendars,
    dashboard,
    invites,
    tasks,
    widgets,
)
from .seed import seed_demo_data

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("task_tracker")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    # Seeds sample data on first boot (idempotent — skips if the demo user
    # already exists). Set SEED_ON_STARTUP=false in real production.
    if settings.seed_on_startup:
        await seed_demo_data()
    try:
        start_scheduler()
    except Exception as exc:  # scheduler is best-effort
        logger.warning("Scheduler not started: %s", exc)
    yield
    stop_scheduler()
    await close_mongo_connection()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=(
        "Backend for the AI-Powered Task Tracker. Google OAuth + JWT auth, "
        "role-based access control, real-time dashboard aggregation, and "
        "mock-but-real-ready weather / quotes / on-this-day widgets."
    ),
    lifespan=lifespan,
    openapi_url=f"{settings.api_v1_prefix}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Simple in-memory rate limiter (per client IP) ---
_hits: dict[str, deque] = defaultdict(deque)


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.url.path.startswith(settings.api_v1_prefix):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        window = settings.rate_limit_window_seconds
        dq = _hits[ip]
        while dq and dq[0] < now - window:
            dq.popleft()
        if len(dq) >= settings.rate_limit_requests:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Rate limit exceeded. Slow down a little."},
            )
        dq.append(now)
    return await call_next(request)


# --- Routers ---
api = settings.api_v1_prefix
for r in (auth, tasks, dashboard, calendars, invites, activity, widgets):
    app.include_router(r.router, prefix=api)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "mock_db": settings.mock_db, "mock_auth": settings.mock_auth}


# --- Static SPA (production single-service deploy) ---------------------------
# When the built frontend is present (copied to ./static in the Docker image),
# FastAPI serves it directly, so the whole app runs from one origin — no CORS,
# no separate frontend service. In local dev this folder is absent and the JSON
# root below is served instead (the Vite dev server handles the UI).
STATIC_DIR = (Path(__file__).resolve().parent.parent / "static").resolve()

if STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    async def spa_root():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        # API and doc routes are matched earlier; everything else is either a
        # real static asset (favicon, manifest, service worker) or a client-side
        # route that the SPA resolves from index.html.
        if full_path.startswith("api"):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
        candidate = (STATIC_DIR / full_path).resolve()
        if STATIC_DIR in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")

else:

    @app.get("/", tags=["health"])
    async def root():
        return {
            "name": settings.app_name,
            "docs": "/docs",
            "health": "/health",
            "api": settings.api_v1_prefix,
        }
