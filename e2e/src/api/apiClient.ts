import { APIRequestContext, expect } from '@playwright/test'

/**
 * Thin wrapper over the backend REST API (`/api/v1`). Tests use this to set up
 * and tear down state quickly, keeping the browser focused on the behaviour
 * under test. It mirrors what the frontend's axios client does.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173'
export const API_BASE_URL =
  process.env.E2E_API_BASE_URL || `${BASE_URL}/api/v1`

export interface Tokens {
  access_token: string
  refresh_token: string
}

export interface AuthResult extends Tokens {
  user: { id: string; email: string; name: string }
}

export interface Task {
  id: string
  name: string
  severity: 'critical' | 'high' | 'low'
  status: 'pending' | 'completed'
  due_at: string
  notes?: string
}

/** Passwordless dev login (requires backend MOCK_AUTH=true). */
export async function devLogin(
  request: APIRequestContext,
  email = process.env.E2E_USER_EMAIL || 'e2e@example.com',
  name?: string,
): Promise<AuthResult> {
  const res = await request.post(`${API_BASE_URL}/auth/dev-login`, {
    data: { email, name },
  })
  expect(res.ok(), `dev-login failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.json()
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export interface NewTask {
  name: string
  severity?: Task['severity']
  due_at?: string
  notes?: string
}

/** Create a task directly via the API (fast fixture setup). */
export async function createTask(
  request: APIRequestContext,
  token: string,
  task: NewTask,
): Promise<Task> {
  const res = await request.post(`${API_BASE_URL}/tasks`, {
    headers: authHeaders(token),
    data: {
      severity: 'low',
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
      notes: '',
      ...task,
    },
  })
  expect(res.ok(), `createTask failed: ${res.status()} ${await res.text()}`).toBeTruthy()
  return res.json()
}

export async function listTasks(
  request: APIRequestContext,
  token: string,
  params: Record<string, string | number> = {},
): Promise<Task[]> {
  const res = await request.get(`${API_BASE_URL}/tasks`, {
    headers: authHeaders(token),
    params: { page_size: 200, ...params },
  })
  expect(res.ok(), `listTasks failed: ${res.status()}`).toBeTruthy()
  const body = await res.json()
  return body.items ?? body
}

export async function deleteTask(
  request: APIRequestContext,
  token: string,
  id: string,
): Promise<void> {
  const res = await request.delete(`${API_BASE_URL}/tasks/${id}`, {
    headers: authHeaders(token),
  })
  expect([200, 204].includes(res.status()), `deleteTask failed: ${res.status()}`).toBeTruthy()
}

/** Remove every task for the authenticated user — handy for test isolation. */
export async function deleteAllTasks(
  request: APIRequestContext,
  token: string,
): Promise<void> {
  const tasks = await listTasks(request, token, { status: 'pending' })
  const completed = await listTasks(request, token, { status: 'completed' })
  for (const t of [...tasks, ...completed]) {
    await deleteTask(request, token, t.id)
  }
}
