import { Page, Locator, expect } from '@playwright/test'

export type NavItem =
  | 'Dashboard'
  | 'Create Task'
  | 'View Tasks'
  | 'Calendar'
  | 'Invite Members'
  | 'Activity Log'
  | 'Settings'

/**
 * The authenticated app shell (sidebar nav, header, logout). Shared by every
 * page that renders inside the protected Layout.
 */
export class AppShell {
  readonly page: Page
  readonly logoutButton: Locator

  constructor(page: Page) {
    this.page = page
    this.logoutButton = page.getByRole('button', { name: 'Logout' })
  }

  nav(item: NavItem): Locator {
    return this.page.getByRole('link', { name: item, exact: true })
  }

  async goToViaNav(item: NavItem) {
    await this.nav(item).click()
  }

  async expectLoaded() {
    await expect(this.nav('Dashboard')).toBeVisible()
  }

  async logout() {
    await this.logoutButton.click()
    await this.page.waitForURL('**/login')
  }
}
