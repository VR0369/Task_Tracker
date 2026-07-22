import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const THEME_KEY = 'orbit.theme'
const ACCENT_KEY = 'orbit.accent'

// How far each shade sits from the accent (shade 500) toward white or black.
// Ratios are taken from the original #7c5cff scale, so any accent keeps the
// same contrast rhythm while shade 500 stays exactly the color the user picked.
const SHADE_MIX = {
  50: 0.993,
  100: 0.893,
  200: 0.689,
  300: 0.426,
  400: 0.173,
  500: 0,
  600: -0.218,
  700: -0.454,
  800: -0.701,
  900: -0.892,
}

function hexToHsl(hex) {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return { h: 0, s: 0, l }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let hue
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) hue = ((b - r) / d + 2) / 6
  else hue = ((r - g) / d + 4) / 6
  return { h: hue, s, l }
}

function hslToChannels({ h, s, l }) {
  if (!s) {
    const v = Math.round(l * 255)
    return `${v} ${v} ${v}`
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const chan = (t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [chan(h + 1 / 3), chan(h), chan(h - 1 / 3)]
    .map((v) => Math.round(v * 255))
    .join(' ')
}

function applyAccent(accent) {
  const base = hexToHsl(accent)
  if (!base) return
  const root = document.documentElement
  root.style.setProperty('--accent', accent)
  const lightEnd = 0.97
  const darkEnd = base.l * 0.44
  for (const [shade, mix] of Object.entries(SHADE_MIX)) {
    const l = mix >= 0 ? base.l + mix * (lightEnd - base.l) : base.l + mix * (base.l - darkEnd)
    // Very pale shades read better slightly desaturated.
    const s = mix > 0.6 ? base.s * (1 - 0.3 * mix) : base.s
    root.style.setProperty(`--brand-${shade}`, hslToChannels({ h: base.h, s, l }))
  }
  // Gradient companion: the original pairs #7c5cff with a hue ~38deg cooler.
  root.style.setProperty(
    '--brand-alt',
    hslToChannels({ h: (base.h - 38 / 360 + 1) % 1, s: base.s, l: Math.min(base.l + 0.02, 0.95) })
  )
}

function apply(theme, accent) {
  const root = document.documentElement
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  root.classList.toggle('dark', dark)
  if (accent) applyAccent(accent)
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

  const setTheme = useCallback((t) => {
    localStorage.setItem(THEME_KEY, t)
    setThemeState(t)
  }, [])
  const setAccent = useCallback((a) => {
    localStorage.setItem(ACCENT_KEY, a)
    setAccentState(a)
  }, [])

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
