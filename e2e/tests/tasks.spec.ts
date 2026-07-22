import { test, expect } from '../src/fixtures/test'
import { createTask, deleteAllTasks } from '../src/api/apiClient'

/**
 * Core task lifecycle through the UI: create, complete, edit, delete.
 * `auth` gives us an API token for the signed-in user so we can isolate each
 * test by wiping tasks first, and seed data quickly when the UI isn't the focus.
 */
test.describe('Task management', () => {
  test.beforeEach(async ({ request, auth }) => {
    await deleteAllTasks(request, auth.access_token)
  })

  test('create a task via the form and see it in the list', async ({
    createTaskPage,
    viewTasksPage,
  }) => {
    const name = `Write E2E tests ${Date.now()}`

    await createTaskPage.goto()
    await createTaskPage.fillAndSubmit({
      name,
      severity: 'High',
      date: '2026-08-15',
      time: '14:30',
      notes: 'Automated with Playwright',
    })

    // fillAndSubmit already waited for the /tasks redirect.
    await viewTasksPage.expectTaskVisible(name)
  })

  test('validation blocks an empty task name', async ({ createTaskPage, page }) => {
    await createTaskPage.goto()
    await createTaskPage.saveButton.click()

    await expect(page.getByText('Task name is required')).toBeVisible()
    await expect(page).toHaveURL(/\/create/)
  })

  test('complete a task and find it under "Show completed"', async ({
    request,
    auth,
    viewTasksPage,
  }) => {
    const name = `Finish report ${Date.now()}`
    await createTask(request, auth.access_token, { name, severity: 'critical' })

    await viewTasksPage.goto()
    await viewTasksPage.expectTaskVisible(name)
    await viewTasksPage.toggleComplete(name)

    // Pending list (default) no longer shows it.
    await viewTasksPage.expectTaskHidden(name)

    // It reappears once completed tasks are shown.
    await viewTasksPage.showCompleted.check()
    await viewTasksPage.expectTaskVisible(name)
  })

  test('search filters the task list', async ({ request, auth, viewTasksPage }) => {
    const unique = `Pay invoices ${Date.now()}`
    await createTask(request, auth.access_token, { name: unique })
    await createTask(request, auth.access_token, { name: `Buy groceries ${Date.now()}` })

    await viewTasksPage.goto()
    await viewTasksPage.search('Pay invoices')

    await viewTasksPage.expectTaskVisible(unique)
    await expect(viewTasksPage.card(/Buy groceries/)).toHaveCount(0)
  })

  test('delete a task removes it from the list', async ({ request, auth, viewTasksPage }) => {
    const name = `Temporary task ${Date.now()}`
    await createTask(request, auth.access_token, { name })

    await viewTasksPage.goto()
    await viewTasksPage.expectTaskVisible(name)
    await viewTasksPage.deleteTask(name)

    await viewTasksPage.expectTaskHidden(name)
  })
})
