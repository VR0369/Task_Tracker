import { Page, Locator, expect } from '@playwright/test'

export interface TaskInput {
  name: string
  severity?: 'Critical' | 'High' | 'Low'
  /** yyyy-mm-dd */
  date?: string
  /** HH:mm (24h) */
  time?: string
  notes?: string
}

/** The Create Task screen (`/create`) and its TaskForm. */
export class CreateTaskPage {
  readonly page: Page
  readonly heading: Locator
  readonly nameInput: Locator
  readonly dateInput: Locator
  readonly timeInput: Locator
  readonly notesInput: Locator
  readonly saveButton: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Create Task' })
    this.nameInput = page.locator('#name')
    this.dateInput = page.locator('#date')
    this.timeInput = page.locator('#time')
    this.notesInput = page.locator('#notes')
    this.saveButton = page.getByRole('button', { name: 'Save task' })
  }

  async goto() {
    await this.page.goto('/create')
    await expect(this.heading).toBeVisible()
  }

  severityButton(label: 'Critical' | 'High' | 'Low'): Locator {
    return this.page.getByRole('button', { name: label, exact: true })
  }

  async fillAndSubmit(task: TaskInput) {
    await this.nameInput.fill(task.name)
    if (task.severity) await this.severityButton(task.severity).click()
    if (task.date) await this.dateInput.fill(task.date)
    if (task.time) await this.timeInput.fill(task.time)
    if (task.notes) await this.notesInput.fill(task.notes)
    await this.saveButton.click()
    // On success the form navigates to the task list.
    await this.page.waitForURL('**/tasks')
  }
}
