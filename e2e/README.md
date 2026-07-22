# Orbit Task Tracker — E2E Automation (Playwright)

End-to-end UI + API automation for the Orbit Task Tracker. Complements the
backend `pytest` suite (unit/API) with browser-driven tests of the real user
flows: login, task lifecycle, navigation.

## Why Playwright

- Same TS/JS ecosystem as the Vite frontend; plugs into the existing CI.
- Auto-waiting handles framer-motion animations + React Query loading (no `sleep`s).
- First-class API testing lets us seed/clean data fast and assert via the UI.
- Trace viewer, parallel runs, cross-browser, and codegen out of the box.

## Layout

```
e2e/
├─ playwright.config.ts     # projects, auto-started servers, reporters
├─ tests/
│  ├─ auth.setup.ts         # logs in once, saves storage state (runs first)
│  ├─ login.spec.ts         # login/logout via the real UI (signed-out)
│  ├─ navigation.spec.ts    # sidebar route smoke tests
│  ├─ tasks.spec.ts         # create / complete / search / delete via UI
│  └─ api.spec.ts           # backend contract tests (no browser)
└─ src/
   ├─ pages/                # Page Object Model (LoginPage, ViewTasksPage, …)
   ├─ fixtures/test.ts      # injects page objects + an API `auth` token
   └─ api/apiClient.ts      # backend REST helpers (seed/clean data)
```

**Design:** Page Object Model keeps selectors in one place. The `auth` fixture
hands a spec an API token for the same user the browser is signed in as, so tests
seed data over the API (fast, stable) and verify through the UI.

## Prerequisites

- Node 18+ and Python 3.12 (only if letting Playwright auto-start the servers)
- Backend deps installed (`pip install -r ../backend/requirements.txt`)
- Frontend deps installed (`npm install` in `../frontend`)

## Setup

```bash
cd e2e
npm install
npx playwright install --with-deps chromium
cp .env.example .env      # optional; defaults work for local dev
```

## Running

Playwright auto-starts the FastAPI backend (mock mode) and the Vite dev server,
then runs the suite:

```bash
npm test              # headless, all projects
npm run test:headed   # watch it drive a real browser
npm run test:ui       # interactive UI mode (great for debugging)
npm run report        # open the last HTML report
```

### Against a running stack (e.g. Docker)

```bash
docker compose up -d --build          # from repo root -> http://localhost:8080
E2E_BASE_URL=http://localhost:8080 E2E_NO_WEBSERVER=1 npm test
```

## How auth works

The app uses Google OAuth, but with `MOCK_AUTH=true` the backend exposes
`POST /api/v1/auth/dev-login`. `auth.setup.ts` calls it, injects the returned
tokens into `localStorage` (`orbit.tokens`, matching `frontend/src/api/client.js`),
and saves the browser storage state so every other test starts signed in.

## Writing a new test

1. Add/extend a Page Object in `src/pages/` — keep selectors there, prefer
   role/label/text locators (the app has stable ARIA labels and headings).
2. Use the fixtures from `src/fixtures/test.ts`:

```ts
import { test, expect } from '../src/fixtures/test'
import { createTask, deleteAllTasks } from '../src/api/apiClient'

test('example', async ({ request, auth, viewTasksPage }) => {
  await deleteAllTasks(request, auth.access_token)            // isolate
  await createTask(request, auth.access_token, { name: 'X' }) // seed via API
  await viewTasksPage.goto()
  await viewTasksPage.expectTaskVisible('X')                  // assert via UI
})
```

## CI

`.github/workflows/e2e.yml` installs backend + frontend + e2e deps, lets
Playwright boot both servers, runs the Chromium project, and uploads the HTML
report as an artifact.
