# Orbit — AI-Powered Task Tracker

A modern, responsive, collaborative task tracker with a real-time dashboard,
role-based access control, a glassmorphism UI, and mock-but-real-ready
integrations (Google OAuth, live weather via Open-Meteo, on-this-day
history, motivational quotes).

> **Runs with zero credentials out of the box.** The whole stack boots in
> "mock mode": an in-memory database, a dev login, and mocked weather/quotes/
> history. Flip a few env flags and add API keys to go fully live — the real
> integration code is already written.

**Stack:** React 19 · Vite 6 · Tailwind CSS · React Query · Framer Motion ·
Recharts · FastAPI · MongoDB (Motor) · JWT · Pydantic v2.

---

## Table of contents

- [Quick start (fastest path)](#quick-start-fastest-path)
- [Run with Docker Compose](#run-with-docker-compose)
- [Deploy to Render](#deploy-to-render)
- [Configuration & going live](#configuration--going-live)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [API & docs](#api--docs)
- [Roles (RBAC)](#roles-rbac)
- [Testing](#testing)
- [What's fully built vs. scaffolded](#whats-fully-built-vs-scaffolded)

---

## Quick start (fastest path)

You need **Python 3.11+** and **Node 20+**. Two terminals.

### 1) Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env          # defaults are fine for mock mode
uvicorn app.main:app --reload # http://localhost:8000  (docs at /docs)
```

The backend starts with an **in-memory database** and **seeds demo data**
(a `demo@example.com` user with tasks spanning past-due / today / upcoming /
completed-yesterday), so the dashboard is populated immediately.

### 2) Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev                    # http://localhost:5173
```

Vite proxies `/api` to the backend, so no extra config is needed.

### 3) Log in

Open http://localhost:5173 and click **Continue with Google** — in mock mode
this logs you in as `demo@example.com` with the seeded tasks. Or use the dev
login box with any email to start fresh.

---

## Run with Docker Compose

Brings up MongoDB, the FastAPI backend, and the Nginx-served frontend (which
also reverse-proxies `/api` to the backend).

```bash
docker compose up --build
# open http://localhost:8080
```

By default Compose runs against a **real MongoDB** (`MOCK_DB=false`) but keeps
`MOCK_AUTH=true` / `MOCK_WEATHER=true` so it works without any external keys.
Demo data is seeded on first boot. Set `SEED_ON_STARTUP=false` for a clean
production database.

---

## Deploy to Render

The included `render.yaml` blueprint deploys the whole app as **one** Docker web
service: a multi-stage build compiles the React SPA and FastAPI serves it, so the
API and UI share a single origin — no CORS, no separate frontend service.

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, select the repo, then **Apply**. Render reads
   `render.yaml` and provisions one free web service.
3. On Apply, Render prompts for the one secret declared with `sync: false`:
   - `MONGO_URL` — your MongoDB Atlas connection string (see below).

   `JWT_SECRET` is generated automatically. Live weather (Open-Meteo) needs no
   key — `MOCK_WEATHER=false` is already set in `render.yaml`.

Then open `https://<service>.onrender.com` and use the dev login (mock auth stays
on until you wire real Google OAuth).

### MongoDB Atlas (persistence)

Render doesn't host MongoDB, so point the app at a free Atlas cluster:

1. Create a free **M0** cluster at [cloud.mongodb.com](https://cloud.mongodb.com/).
2. **Database Access** → add a user + password.
3. **Network Access** → allow `0.0.0.0/0` (Render's free tier has no fixed
   outbound IP, so a single-IP allowlist won't work).
4. **Connect → Drivers** → copy the `mongodb+srv://…` URI and set it as
   `MONGO_URL` in Render. The blueprint already sets `MOCK_DB=false`.

> **Free-tier notes:** the web service sleeps after ~15 min idle (~50s cold
> start on the next request), and an idle Atlas M0 cluster can pause.

---

## Configuration & going live

All backend settings live in `backend/.env` (see `.env.example`). Key toggles:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MOCK_DB` | `true` | In-memory DB (no MongoDB). Set `false` + `MONGO_URL` for real Mongo. |
| `MOCK_AUTH` | `true` | Enables dev login + fake Google tokens. |
| `MOCK_WEATHER` | `true` | Mocked weather. Set `false` for live Open-Meteo data (no key). |
| `MOCK_HISTORY` | `true` | Mocked "On This Day". Set `false` to use the live keyless API. |
| `JWT_SECRET` | dev key | **Change this in production.** |
| `SEED_ON_STARTUP` | `true` | Seed demo data on first boot (idempotent). |

### Google OAuth (real)

1. Create an OAuth 2.0 Client ID in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Set `MOCK_AUTH=false`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `GOOGLE_REDIRECT_URI` in `backend/.env`, and `VITE_GOOGLE_CLIENT_ID` in
   `frontend/.env`.
3. The backend verifies the Google `id_token` server-side via `google-auth`
   (`app/security.py → verify_google_id_token`). Wire the Google Identity
   Services button on the login page to call `POST /api/v1/auth/google` with the
   returned `id_token`.

### Weather (real)

Set `MOCK_WEATHER=false` — that's it. Live weather comes from
[Open-Meteo](https://open-meteo.com/), which is **free and keyless** (no signup).
It powers current conditions, the 24-hour hourly strip, the 7-day forecast, and
air quality; [Open-Meteo geocoding](https://open-meteo.com/en/docs/geocoding-api)
drives city/state search, [Zippopotam.us](https://zippopotam.us/) resolves
ZIP/postal codes to a city, and BigDataCloud reverse-geocodes coordinates to a
place name (`app/services/weather.py`). Responses are cached ~10 min, and the
service gracefully falls back to mock data (with a short cooldown) if a provider
is rate-limited or unreachable.

---

## Architecture

```
┌────────────┐     /api/v1      ┌──────────────┐     Motor      ┌──────────┐
│  React SPA │ ───────────────▶ │   FastAPI    │ ─────────────▶ │ MongoDB  │
│ (Vite+PWA) │  JWT (Bearer)    │  RBAC + APIs │  (or in-mem)   │          │
└────────────┘ ◀─────────────── └──────────────┘                └──────────┘
        │  React Query cache          │  APScheduler (reminders)
        │  optimistic updates         │  Google OAuth / Open-Meteo (real-ready)
```

- **Auth:** passwordless Google OAuth → app-issued JWT access + refresh tokens.
  Axios transparently refreshes on 401.
- **Real-time dashboard:** every task mutation invalidates the dashboard,
  tasks, and activity queries via React Query, so counts update instantly with
  no page refresh. Completing a task also updates optimistically.
- **RBAC:** every calendar has members with roles; task/invite endpoints check
  the caller's role on the relevant calendar.
- **Timezone-correct buckets:** dashboard buckets (past-due / today / upcoming /
  completed-yesterday) are computed in the user's configured timezone.

---

## Project structure

```
task-tracker/
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory, CORS, gzip, rate limit, lifespan
│   │   ├── config.py          # env-driven settings + mock toggles
│   │   ├── database.py        # Motor / mongomock client + indexes
│   │   ├── security.py        # JWT + Google id_token verification
│   │   ├── deps.py            # auth + role-based dependencies
│   │   ├── crud.py            # data-access helpers
│   │   ├── seed.py            # demo data
│   │   ├── models/            # Pydantic schemas + enums
│   │   ├── routers/           # auth, tasks, dashboard, calendars, invites,
│   │   │                      #   activity, widgets
│   │   └── services/          # quotes, weather, history
│   ├── tests/                 # pytest (auth, tasks, dashboard, RBAC)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # axios client + React Query hooks
│   │   ├── auth/ theme/       # context providers
│   │   ├── components/        # Layout, cards, widgets, forms, charts
│   │   ├── pages/             # Home, CreateTask, ViewTasks, Calendar,
│   │   │                      #   Invite, ActivityLog, Settings, Login
│   │   └── utils/
│   ├── Dockerfile + nginx.conf
│   └── vite.config.js         # PWA + dev proxy
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## API & docs

Interactive OpenAPI docs are auto-generated:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

Selected endpoints (all under `/api/v1`):

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/auth/dev-login` | Mock-mode email login |
| POST | `/auth/google` | Exchange Google `id_token` for tokens |
| POST | `/auth/refresh` | Refresh access token |
| GET/PATCH | `/auth/me` | Profile + settings |
| GET/POST | `/tasks` | List (filters/sort/pagination) / create |
| PATCH/DELETE | `/tasks/{id}` | Update / delete |
| POST | `/tasks/{id}/complete` | Toggle completion |
| GET | `/dashboard` | The four aggregated cards |
| GET | `/calendars` | User's calendars + role |
| POST | `/invites` · `/invites/{id}/approve` | Invitation workflow |
| GET | `/activity` | Audit log |
| GET | `/quotes/random` · `/weather` · `/weather/search` · `/history/on-this-day` | Widgets |

---

## Roles (RBAC)

| Capability | Admin | Contributor | Viewer |
| --- | :---: | :---: | :---: |
| View tasks & dashboard | ✅ | ✅ | ✅ |
| Create / edit / delete / complete tasks | ✅ | ✅ | ❌ |
| Invite / remove members, manage calendar | ✅ | ❌ | ❌ |

**Invitation flow:** admin invites (link generated) → recipient logs in with
Google and accepts → request goes to the admin → admin approves/rejects → the
user joins with the assigned role.

---

## Testing

```bash
cd backend
pytest -q
```

Covers health, auth (dev login / me / refresh), task CRUD + dashboard
recalculation, filtering/sorting, and RBAC (a viewer cannot create tasks). Tests
run entirely on the in-memory database — no MongoDB needed.

Frontend build check:

```bash
cd frontend && npm run build
```

---

## What's fully built vs. scaffolded

**Fully working end-to-end:** Google-shaped auth + JWT refresh, task CRUD with
RBAC, the real-time four-card dashboard, View Tasks (auto-grouped, filters,
sort, edit/delete/complete), Create Task, Calendar (day/week/month +
drag-to-reschedule), Invitations (create → accept → approve), Activity log,
Settings (theme/accent/timezone/notifications), homepage widgets — motivational
quote, live weather (current + 24h hourly + multi-day forecast + AQI, with
search autocomplete, geolocation, °C/°F toggle, and a detail modal),
on-this-day — Recharts analytics, toasts, skeletons, empty states, dark mode,
responsive + mobile bottom nav, and PWA install/offline.

**Scaffolded / simplified (clearly marked, easy to extend):** email/push
reminder delivery (APScheduler scans and logs; wire your provider in
`app/reminders.py`), the Google Identity Services button (backend verification
is ready — drop the GIS script in and call `/auth/google`), and hard token
revocation (JWTs are stateless; add a denylist if you need instant logout).

---

## Security notes

JWT access + refresh tokens, passwordless Google sign-in, CORS allow-list,
per-IP rate limiting, Pydantic input validation, MongoDB (no SQL injection
surface) with parameterized queries, and audit logging of critical actions.
Serve over HTTPS in production and set a strong `JWT_SECRET`.

---

Built as a production-shaped starting point — clone it, add your keys, and ship.
