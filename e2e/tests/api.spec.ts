import { test, expect } from '../src/fixtures/test'
import { API_BASE_URL, createTask, listTasks, deleteAllTasks } from '../src/api/apiClient'

/**
 * API-level E2E — no browser. Validates the backend contract the UI depends on.
 * Fast, stable, and a good place to cover edge cases the UI can't easily reach.
 */
test.describe('API contract', () => {
  test.beforeEach(async ({ request, auth }) => {
    await deleteAllTasks(request, auth.access_token)
  })

  test('rejects unauthenticated task access', async ({ request }) => {
    const res = await request.get(`${API_BASE_URL}/tasks`)
    expect(res.status()).toBe(401)
  })

  test('creates and retrieves a task', async ({ request, auth }) => {
    const created = await createTask(request, auth.access_token, {
      name: 'API created task',
      severity: 'high',
    })
    expect(created.id).toBeTruthy()
    expect(created.severity).toBe('high')

    const tasks = await listTasks(request, auth.access_token)
    expect(tasks.map((t) => t.id)).toContain(created.id)
  })

  test('completing a task flips its status', async ({ request, auth }) => {
    const created = await createTask(request, auth.access_token, { name: 'Complete me' })

    const res = await request.post(`${API_BASE_URL}/tasks/${created.id}/complete`, {
      headers: { Authorization: `Bearer ${auth.access_token}` },
      params: { completed: 'true' },
    })
    expect(res.ok(), `complete failed: ${res.status()} ${await res.text()}`).toBeTruthy()

    const completed = await listTasks(request, auth.access_token, { status: 'completed' })
    expect(completed.map((t) => t.id)).toContain(created.id)
  })
})
