import { Page, Locator, expect } from '@playwright/test'

/** The View Tasks screen (`/tasks`): list, filters, and per-task actions. */
export class ViewTasksPage {
  readonly page: Page
  readonly heading: Locator
  readonly searchInput: Locator
  readonly severityFilter: Locator
  readonly sortSelect: Locator
  readonly showCompleted: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'View Tasks' })
    this.searchInput = page.getByPlaceholder('Search tasks…')
    this.severityFilter = page.locator('select').first()
    this.sortSelect = page.locator('select').nth(1)
    this.showCompleted = page.getByRole('checkbox', { name: 'Show completed' })
  }

  async goto() {
    await this.page.goto('/tasks')
    await expect(this.heading).toBeVisible()
  }

  /** A task card, located by its (unique) name. */
  card(name: string | RegExp): Locator {
    return this.page
      .locator('.glass-card')
      .filter({ has: this.page.getByRole('heading', { level: 4, name }) })
  }

  async search(text: string) {
    await this.searchInput.fill(text)
  }

  async expectTaskVisible(name: string) {
    await expect(this.card(name)).toBeVisible()
  }

  async expectTaskHidden(name: string) {
    await expect(this.card(name)).toHaveCount(0)
  }

  async toggleComplete(name: string) {
    await this.card(name).getByRole('checkbox').click()
  }

  async openEdit(name: string) {
    await this.card(name).getByRole('button', { name: 'Edit task' }).click()
  }

  async deleteTask(name: string) {
    await this.card(name).getByRole('button', { name: 'Delete task' }).click()
    // Confirmation modal.
    await this.page.getByRole('button', { name: 'Delete', exact: true }).click()
  }
}
