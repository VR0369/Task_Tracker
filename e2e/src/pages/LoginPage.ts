import { Page, Locator, expect } from '@playwright/test'

/** The unauthenticated login screen (`/login`). */
export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly signInButton: Locator
  readonly demoButton: Locator
  readonly heading: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.getByPlaceholder('you@example.com')
    this.signInButton = page.getByRole('button', { name: 'Sign in' })
    this.demoButton = page.getByRole('button', { name: /demo@example\.com/ })
    this.heading = page.getByRole('heading', { name: 'Orbit' })
  }

  async goto() {
    await this.page.goto('/login')
    await expect(this.heading).toBeVisible()
  }

  /** Dev login via the on-screen email form (MOCK_AUTH mode). */
  async loginWithEmail(email: string) {
    await this.emailInput.fill(email)
    await this.signInButton.click()
  }
}
