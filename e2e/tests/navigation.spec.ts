import { test, expect } from '../src/fixtures/test'
import type { NavItem } from '../src/pages/AppShell'

/** Smoke-tests every primary route reachable from the sidebar. */
test.describe('Navigation', () => {
  test.beforeEach(async ({ page, appShell }) => {
    await page.goto('/')
    await appShell.expectLoaded()
  })

  const routes: Array<{ nav: NavItem; url: RegExp }> = [
    { nav: 'Create Task', url: /\/create/ },
    { nav: 'View Tasks', url: /\/tasks/ },
    { nav: 'Calendar', url: /\/calendar/ },
    { nav: 'Invite Members', url: /\/invite/ },
    { nav: 'Activity Log', url: /\/activity/ },
    { nav: 'Settings', url: /\/settings/ },
  ]

  for (const { nav, url } of routes) {
    test(`navigates to ${nav}`, async ({ page, appShell }) => {
      await appShell.goToViaNav(nav)
      await expect(page).toHaveURL(url)
    })
  }
})
