import { createContext, useContext, useState } from 'react'

const ScopeContext = createContext(null)

const STORAGE_KEY = 'taskScope'

function readStoredScope() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'shared' ? 'shared' : 'personal'
  } catch {
    return 'personal'
  }
}

// Personal/shared task scope, shared across Dashboard, View Tasks and
// Calendar so switching to "Shared" on one page keeps the others in sync.
export function ScopeProvider({ children }) {
  const [scope, setScopeState] = useState(readStoredScope)

  const setScope = (next) => {
    setScopeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  return <ScopeContext.Provider value={{ scope, setScope }}>{children}</ScopeContext.Provider>
}

export function useScope() {
  const ctx = useContext(ScopeContext)
  if (!ctx) throw new Error('useScope must be used within ScopeProvider')
  return ctx
}
