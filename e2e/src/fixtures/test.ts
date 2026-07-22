import { test as base, expect } from '@playwright/test'
import { LoginPage } from '../pages/LoginPage'
import { AppShell } from '../pages/AppShell'
import { CreateTaskPage } from '../pages/CreateTaskPage'
import { ViewTasksPage } from '../pages/ViewTasksPage'
import { devLogin, type AuthResult } from '../api/apiClient'

/**
 * Custom fixtures: page objects are injected per-test, plus an `auth` fixture
 * that yields an API token for the same user the browser is signed in as, so a
 * spec can seed/clean data via the API and assert through the UI.
 */
type Fixtures = {
  loginPage: LoginPage
  appShell: AppShell
  createTaskPage: CreateTaskPage
  viewTasksPage: ViewTasksPage
  auth: AuthResult
}

// Injected before any app code runs: neutralise CSS + framer-motion animations
// so Playwright's "stable" actionability check is never blocked by an
// infinitely-animating element (the app has a spinner with repeat: Infinity).
const KILL_ANIMATIONS = `
  (() => {
    const css = '*,*::before,*::after{animation-duration:0s!important;' +
      'animation-delay:0s!important;transition-duration:0s!important;' +
      'transition-delay:0s!important;scroll-behavior:auto!important}';
    const add = () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head?.appendChild(s);
    };
    if (document.head) add();
    else document.addEventListener('DOMContentLoaded', add);
    // framer-motion honours this global flag and skips all animations.
    // @ts-ignore
    window.MotionGlobalConfig = { skipAnimations: true };
  })();
`

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    await page.addInitScript(KILL_ANIMATIONS)
    await use(page)
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page))
  },
  appShell: async ({ page }, use) => {
    await use(new AppShell(page))
  },
  createTaskPage: async ({ page }, use) => {
    await use(new CreateTaskPage(page))
  },
  viewTasksPage: async ({ page }, use) => {
    await use(new ViewTasksPage(page))
  },
  auth: async ({ request }, use) => {
    const result = await devLogin(request)
    await use(result)
  },
})

export { expect }
