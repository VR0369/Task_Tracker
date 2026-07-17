import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const THEME_KEY = 'orbit.theme'
const ACCENT_KEY = 'orbit.accent'

function apply(theme, accent) {
  const root = document.documentElement
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
  if (accent) root.style.setProperty('--accent', accent)
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(THEME_KEY) || 'system')
  const [accent, setAccentState] = useState(() => localStorage.getItem(ACCENT_KEY) || '#7c5cff')

  useEffect(() => {
    apply(theme, accent)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => theme === 'system' && apply(theme, accent)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme, accent])

  const setTheme = (t) => {
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }
  const setAccent = (a) => {
    localStorage.setItem(ACCENT_KEY, a)
    setAccentState(a)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
