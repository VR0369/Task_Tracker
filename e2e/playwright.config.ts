import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config()

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'
const NO_WEBSERVER = !!process.env.E2E_NO_WEBSERVER

/**
 * Playwright config for the Orbit Task Tracker E2E suite.
 *
 * Projects:
 *   setup    — logs in once via the backend API and saves storage state.
 *   chromium — the main suite, reusing the authenticated storage state.
 *
 * `webServer` auto-starts the FastAPI backend and Vite frontend in dev mode.
 * Set E2E_NO_WEBSERVER=1 to run against servers you started yourself (e.g. Docker).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // The app uses framer-motion, including an infinite spinner. Ask the
    // browser (and the animation fixture) to still all motion so Playwright's
    // actionability "stable" check isn't blocked by never-ending animations.
    reducedMotion: 'reduce',
  },

  projects: [
    // 1) Authenticate once; writes playwright/.auth/user.json.
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    // 2) Authenticated suite (default). Depends on `setup`.
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      // The login flow spec drives the real login UI, so it opts out of
      // stored auth itself via test.use({ storageState: undefined }).
    },

    // Uncomment to broaden browser coverage.
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/user.json' },
    //   dependencies: ['setup'],
    // },
  ],

  webServer: NO_WEBSERVER
    ? undefined
    : [
        {
          command: 'python -m uvicorn app.main:app --port 8000',
          cwd: '../backend',
          url: 'http://localhost:8000/api/v1/auth/config',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            MOCK_DB: 'true',
            MOCK_AUTH: 'true',
            MOCK_WEATHER: 'true',
            MOCK_HISTORY: 'true',
            SEED_ON_STARTUP: 'false',
            JWT_SECRET: process.env.JWT_SECRET || 'e2e_dev_secret_change_me',
            // cors_origins default already allows :5173 and :4173.
          },
        },
        {
          command: 'npm run dev -- --port 5173',
          cwd: '../frontend',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
})
