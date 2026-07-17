import { useState } from 'react'
import { motion } from 'framer-motion'
import { Cloud, Droplets, Wind, MapPin, Search, Sun, CloudRain, CloudSun } from 'lucide-react'
import { useWeather } from '../api/hooks'
import { useAuth } from '../auth/AuthContext.jsx'

function conditionIcon(condition = '') {
  const c = condition.toLowerCase()
  if (c.includes('rain')) return CloudRain
  if (c.includes('sun') || c.includes('clear')) return Sun
  if (c.includes('cloud')) return CloudSun
  return Cloud
}

export default function WeatherWidget() {
  const { user, updateProfile } = useAuth()
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState(user?.settings?.weather_location || null)
  const { data, isLoading } = useWeather(location)
  const Icon = conditionIcon(data?.condition)

  const search = async (e) => {
    e.preventDefault()
    if (!query.trim()) return
    setLocation(query.trim())
  }

  const savePreferred = async () => {
    if (!data?.location) return
    await updateProfile({
      settings: { ...(user.settings || {}), weather_location: data.location },
    })
  }

  return (
    <div className="glass-card p-5">
      <form onSubmit={search} className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !min-h-[40px] pl-9"
            placeholder="Search a city…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-ghost !min-h-[40px] !py-2">
          Go
        </button>
      </form>

      {isLoading ? (
        <div className="skeleton h-24 w-full" />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <MapPin size={14} /> {data?.location}
              </div>
              <div className="mt-1 font-display text-4xl font-bold">
                {Math.round(data?.temperature_c)}°C
              </div>
              <div className="text-sm text-slate-500">{data?.condition}</div>
            </div>
            <Icon size={56} className="text-brand-500" />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
              <Droplets size={16} className="mx-auto mb-1 text-blue-500" />
              {data?.humidity}%
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
              <Wind size={16} className="mx-auto mb-1 text-teal-500" />
              {Math.round(data?.wind_kph)} kph
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
              <Sun size={16} className="mx-auto mb-1 text-amber-500" />
              {Math.round(data?.temperature_f)}°F
            </div>
          </div>

          {data?.forecast?.length > 0 && (
            <div className="mt-3 flex justify-between gap-1">
              {data.forecast.slice(0, 5).map((f, i) => {
                const FI = conditionIcon(f.condition)
                return (
                  <div key={i} className="flex flex-1 flex-col items-center rounded-lg py-1 text-[11px]">
                    <FI size={16} className="text-brand-400" />
                    <span className="mt-1 font-semibold">{Math.round(f.high_c)}°</span>
                    <span className="text-slate-400">{Math.round(f.low_c)}°</span>
                  </div>
                )
              })}
            </div>
          )}

          <button onClick={savePreferred} className="mt-3 w-full text-xs text-brand-600 hover:underline">
            Save as preferred location
          </button>
          {data?.is_mock && (
            <p className="mt-1 text-center text-[10px] text-slate-400">
              Mock data — add an AccuWeather key to go live
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}
