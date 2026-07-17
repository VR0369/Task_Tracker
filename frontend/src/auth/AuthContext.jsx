import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, loadTokens, saveTokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const tokens = loadTokens()
    if (!tokens?.access_token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/auth/me')
      setUser(data)
    } catch {
      setUser(null)
      saveTokens(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const applyLogin = (data) => {
    saveTokens({ access_token: data.access_token, refresh_token: data.refresh_token })
    setUser(data.user)
  }

  // Dev / mock login (email only).
  const devLogin = async (email, name) => {
    const { data } = await api.post('/auth/dev-login', { email, name })
    applyLogin(data)
    return data.user
  }

  // Google login — pass a real id_token, or a "mock:email:name" token in mock mode.
  const googleLogin = async (idToken) => {
    const { data } = await api.post('/auth/google', { id_token: idToken })
    applyLogin(data)
    return data.user
  }

  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* ignore */
    }
    saveTokens(null)
    setUser(null)
  }

  const updateProfile = async (patch) => {
    const { data } = await api.patch('/auth/me', patch)
    setUser(data)
    return data
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, devLogin, googleLogin, logout, updateProfile, refreshUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
