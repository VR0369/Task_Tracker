import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { MapPin, Search, Droplets, Wind, LocateFixed, AlertTriangle, Gauge } from 'lucide-react'
import { useWeather, useWeatherSearch } from '../api/hooks'
import { useAuth } from '../auth/AuthContext.jsx'
import Modal from './Modal.jsx'
import WeatherDetail from './WeatherDetail.jsx'
import { conditionIcon, AQI_LEVELS, tempOf } from '../utils/weather'
import { dayjs } from '../utils/format'

const UNIT_KEY = 'orbit.weather.units'

function WIcon({ url, condition, size = 48, className = '' }) {
  if (url) {
    return (
      <img
        src={url}
        alt={condition}
        style={{ width: size, height: size }}
        className={`inline-block object-contain ${className}`}
      />
    )
  }
  const I = conditionIcon(condition)
  return <I size={size} className={className} />
}

export default function WeatherWidget() {
  const { user, updateProfile } = useAuth()

  const [unit, setUnit] = useState(() => localStorage.getItem(UNIT_KEY) || 'C')
  const toggleUnit = () =>
    setUnit((u) => {
      const next = u === 'C' ? 'F' : 'C'
      localStorage.setItem(UNIT_KEY, next)
      return next
    })

  // Which place to show. Coords take priority over a named location.
  const savedLoc = user?.settings?.weather_location || null
  const [place, setPlace] = useState(savedLoc ? { location: savedLoc } : null)
  const [modalOpen, setModalOpen] = useState(false)

  // On first mount with no saved preference, try geolocation (falls back gracefully).
  const askedGeo = useRef(false)
  const locate = () => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setPlace((p) => p || { location: 'New York' }),
      { timeout: 8000 },
    )
  }
  useEffect(() => {
    if (askedGeo.current || place) return
    askedGeo.current = true
    locate()
  }, [place])

  const weatherArg = place
    ? place.lat != null
      ? { lat: place.lat, lon: place.lon }
      : { location: place.location }
    : {}
  const { data, isLoading, isError, refetch, isFetching } = useWeather(weatherArg)

  // Search + autocomplete (debounced).
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(t)
  }, [query])
  const { data: suggestions = [] } = useWeatherSearch(debounced)

  const submitSearch = (e) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setPlace({ location: q })
    setOpen(false)
    setQuery('')
  }
  const pick = (s) => {
    setPlace({ lat: s.lat, lon: s.lon })
    setOpen(false)
    setQuery('')
  }

  const savePreferred = async () => {
    if (!data?.location) return
    await updateProfile({
      settings: { ...(user.settings || {}), weather_location: data.location },
    })
  }

  const aqi = data?.aqi?.us_epa_index ? AQI_LEVELS[data.aqi.us_epa_index] : null

  return (
    <div className="glass-card p-5">
      {/* Search */}
      <form onSubmit={submitSearch} className="relative mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !min-h-[40px] pl-9"
            placeholder="Search city, state, ZIP…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && suggestions.length > 0 && (
            <ul className="glass absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border py-1 text-sm shadow-lg">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(s)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/60 dark:hover:bg-white/10"
                  >
                    <MapPin size={13} className="text-slate-400" />
                    <span className="truncate">
                      {s.name}
                      <span className="text-slate-400">
                        {[s.region, s.country].filter(Boolean).length
                          ? `, ${[s.region, s.country].filter(Boolean).join(', ')}`
                          : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" onClick={locate} className="btn-ghost !min-h-[40px] !p-2" title="Use my location" aria-label="Use my location">
          <LocateFixed size={16} />
        </button>
        <button type="submit" className="btn-ghost !min-h-[40px] !py-2">Go</button>
      </form>

      {isLoading ? (
        <div className="space-y-3">
          <div className="skeleton h-20 w-full" />
          <div className="skeleton h-10 w-full" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <AlertTriangle size={22} className="text-amber-500" />
          <p className="text-sm text-slate-500">Unable to retrieve weather.<br />Please try again.</p>
          <button onClick={() => refetch()} className="btn-ghost !py-1.5 text-sm">Retry</button>
        </div>
      ) : (
        <motion.div key={data?.location} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {/* Clickable summary → opens detail modal */}
          <button onClick={() => setModalOpen(true)} className="w-full text-left" title="View full forecast">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1 text-sm text-slate-500">
                  <MapPin size={14} /> {data?.location}
                </div>
                <div className="mt-1 font-display text-4xl font-bold">
                  {tempOf(data?.temperature_c, data?.temperature_f, unit)}
                </div>
                <div className="text-sm text-slate-500">{data?.condition}</div>
              </div>
              <WIcon url={data?.icon} condition={data?.condition} size={56} className="text-brand-500" />
            </div>
          </button>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
              <Droplets size={16} className="mx-auto mb-1 text-blue-500" />
              {data?.humidity}%
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
              <Wind size={16} className="mx-auto mb-1 text-teal-500" />
              {Math.round(data?.wind_kph)} km/h
            </div>
            {aqi ? (
              <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
                <span className={`mx-auto mb-1 block h-2.5 w-2.5 rounded-full ${aqi.dot}`} />
                <span className={aqi.text}>{aqi.label.split(' ')[0]}</span>
              </div>
            ) : (
              <div className="rounded-xl bg-white/50 dark:bg-white/5 p-2">
                <Gauge size={16} className="mx-auto mb-1 text-amber-500" />
                {tempOf(data?.feelslike_c, data?.feelslike_f, unit)}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex overflow-hidden rounded-lg border border-white/50 dark:border-white/10 text-xs font-semibold">
              {['C', 'F'].map((u) => (
                <button
                  key={u}
                  onClick={() => unit !== u && toggleUnit()}
                  className={`px-2 py-0.5 transition ${unit === u ? 'bg-grad-brand text-white' : 'text-slate-500'}`}
                >
                  °{u}
                </button>
              ))}
            </div>
            <button onClick={() => setModalOpen(true)} className="text-xs text-brand-600 hover:underline">
              Full forecast →
            </button>
          </div>

          <button onClick={savePreferred} className="mt-2 w-full text-xs text-brand-600 hover:underline">
            Save as preferred location
          </button>
          <p className="mt-1 text-center text-[10px] text-slate-400">
            {data?.is_mock
              ? 'Showing sample data — live weather unavailable'
              : data?.last_updated || data?.localtime
              ? `Updated ${dayjs(data.last_updated || data.localtime).format('h:mm A')}`
              : ''}
          </p>
        </motion.div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Weather">
        <WeatherDetail
          data={data}
          unit={unit}
          onToggleUnit={toggleUnit}
          onRefresh={() => refetch()}
          isFetching={isFetching}
        />
      </Modal>
    </div>
  )
}
