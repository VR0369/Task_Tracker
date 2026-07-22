import { test, expect } from '../src/fixtures/test'

/**
 * Login flow — drives the real UI, so it opts out of the shared authenticated
 * storage state and starts from a clean, signed-out browser.
 */
test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Orbit' })).toBeVisible()
  })

  test('user can sign in with the dev email login', async ({ loginPage, appShell, page }) => {
    await loginPage.goto()
    await loginPage.loginWithEmail('login-flow@example.com')

    await expect(page).toHaveURL(/\/$|\/\?/)
    await appShell.expectLoaded()
  })

  test('user can log out', async ({ loginPage, appShell, page }) => {
    await loginPage.goto()
    await loginPage.loginWithEmail('logout-flow@example.com')
    await appShell.expectLoaded()

    await appShell.logout()
    await expect(page).toHaveURL(/\/login/)
  })
})
