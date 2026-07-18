import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react'

/** Fallback lucide icon by condition text (used when the API icon URL is absent, e.g. mock). */
export function conditionIcon(condition = '') {
  const c = condition.toLowerCase()
  if (c.includes('thunder') || c.includes('lightning')) return CloudLightning
  if (c.includes('snow') || c.includes('sleet') || c.includes('ice') || c.includes('blizzard')) return CloudSnow
  if (c.includes('drizzle')) return CloudDrizzle
  if (c.includes('rain') || c.includes('shower')) return CloudRain
  if (c.includes('fog') || c.includes('mist')) return CloudFog
  if (c.includes('sun') || c.includes('clear')) return Sun
  if (c.includes('partly')) return CloudSun
  return Cloud
}

/** US EPA index (1–6) → label + colour classes. */
export const AQI_LEVELS = {
  1: { label: 'Good', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
  2: { label: 'Moderate', text: 'text-yellow-600 dark:text-yellow-400', dot: 'bg-yellow-500' },
  3: { label: 'Unhealthy for Sensitive', text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  4: { label: 'Unhealthy', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  5: { label: 'Very Unhealthy', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  6: { label: 'Hazardous', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-600' },
}

/** Format a temperature given both units and the active unit ('C' | 'F'). */
export function tempOf(c, f, unit) {
  const v = unit === 'F' ? f : c
  return `${Math.round(v ?? 0)}°`
}
