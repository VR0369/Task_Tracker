import { test as setup, expect } from '@playwright/test'
import { devLogin } from '../src/api/apiClient'

const authFile = 'playwright/.auth/user.json'

/**
 * Runs once before the suite. Signs the E2E user in via the backend dev-login
 * endpoint, injects the resulting tokens into localStorage exactly the way the
 * frontend's AuthContext does, and saves the storage state for reuse. This
 * keeps every other test from re-doing the login dance.
 */
setup('authenticate', async ({ page, request }) => {
  const { access_token, refresh_token } = await devLogin(request)

  // The app can't set localStorage until a page from its origin is loaded.
  await page.goto('/login')
  await page.evaluate((tokens) => {
    // Key + shape must match frontend/src/api/client.js (saveTokens).
    localStorage.setItem('orbit.tokens', JSON.stringify(tokens))
  }, { access_token, refresh_token })

  // Verify the injected session is accepted (redirects away from /login).
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()

  await page.context().storageState({ path: authFile })
})
