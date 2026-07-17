import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

// In-memory token store (no localStorage per artifact constraints elsewhere,
// but this is a real app — we persist to localStorage for session continuity).
const TOKENS_KEY = 'orbit.tokens'

export function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveTokens(tokens) {
  if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(TOKENS_KEY)
}

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const tokens = loadTokens()
  if (tokens?.access_token) {
    config.headers.Authorization = `Bearer ${tokens.access_token}`
  }
  return config
})

// Transparent refresh on 401 (once per request).
let refreshing = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    const tokens = loadTokens()
    if (
      error.response?.status === 401 &&
      !original._retry &&
      tokens?.refresh_token &&
      !original.url?.includes('/auth/')
    ) {
      original._retry = true
      try {
        refreshing =
          refreshing ||
          axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: tokens.refresh_token })
        const { data } = await refreshing
        refreshing = null
        saveTokens(data)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return api(original)
      } catch (e) {
        refreshing = null
        saveTokens(null)
        window.location.href = '/login'
        return Promise.reject(e)
      }
    }
    return Promise.reject(error)
  }
)
