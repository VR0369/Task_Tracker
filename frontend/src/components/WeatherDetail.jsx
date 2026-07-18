import {
  Droplets, Wind, Gauge, Eye, Sun, Cloud, Sunrise, Sunset, RefreshCw, Thermometer,
} from 'lucide-react'
import { conditionIcon, AQI_LEVELS, tempOf } from '../utils/weather'

function WIcon({ url, condition, size = 40, className = '' }) {
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

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl bg-white/50 dark:bg-white/5 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-400">
        <Icon size={13} /> {label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  )
}

export default function WeatherDetail({ data, unit, onToggleUnit, onRefresh, isFetching }) {
  if (!data) return null
  const aqi = data.aqi && data.aqi.us_epa_index ? AQI_LEVELS[data.aqi.us_epa_index] : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-xl font-bold">{data.location}</div>
          <div className="text-xs text-slate-500">
            {[data.region, data.country].filter(Boolean).join(', ')}
          </div>
          <div className="mt-3 flex items-end gap-3">
            <WIcon url={data.icon} condition={data.condition} size={56} className="text-brand-500" />
            <div>
              <div className="font-display text-5xl font-bold leading-none">
                {tempOf(data.temperature_c, data.temperature_f, unit)}
              </div>
              <div className="mt-1 text-sm text-slate-500">{data.condition}</div>
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            Feels like {tempOf(data.feelslike_c, data.feelslike_f, unit)}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/50 dark:border-white/10 text-xs font-semibold">
            {['C', 'F'].map((u) => (
              <button
                key={u}
                onClick={() => unit !== u && onToggleUnit()}
                className={`px-2.5 py-1 transition ${unit === u ? 'bg-grad-brand text-white' : 'text-slate-500'}`}
              >
                °{u}
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            className="btn-ghost !min-h-0 !p-2"
            aria-label="Refresh weather"
            title="Refresh"
          >
            <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* AQI banner */}
      {aqi && (
        <div className="flex items-center gap-2 rounded-xl bg-white/50 dark:bg-white/5 px-3 py-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${aqi.dot}`} />
          <span className="font-semibold">Air Quality:</span>
          <span className={aqi.text}>{aqi.label}</span>
          {data.aqi.pm2_5 != null && (
            <span className="ml-auto text-xs text-slate-400">
              PM2.5 {Math.round(data.aqi.pm2_5)} · PM10 {Math.round(data.aqi.pm10)}
            </span>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat icon={Droplets} label="Humidity" value={`${data.humidity}%`} />
        <Stat icon={Wind} label="Wind" value={`${Math.round(data.wind_kph)} km/h`} sub={data.wind_dir} />
        <Stat icon={Gauge} label="Pressure" value={`${Math.round(data.pressure_mb)} hPa`} />
        <Stat icon={Eye} label="Visibility" value={`${Math.round(data.visibility_km)} km`} />
        <Stat icon={Sun} label="UV Index" value={Math.round(data.uv)} />
        <Stat icon={Cloud} label="Cloud" value={`${data.cloud}%`} />
        <Stat icon={Sunrise} label="Sunrise" value={data.sunrise || '—'} />
        <Stat icon={Sunset} label="Sunset" value={data.sunset || '—'} />
        <Stat icon={Thermometer} label="Feels Like" value={tempOf(data.feelslike_c, data.feelslike_f, unit)} />
      </div>

      {/* Hourly */}
      {data.hourly?.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Next 24 hours</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {data.hourly.map((h, i) => (
              <div
                key={i}
                className="flex min-w-[62px] flex-col items-center rounded-xl bg-white/50 dark:bg-white/5 px-2 py-2 text-center"
              >
                <span className="text-[11px] text-slate-400">{h.label}</span>
                <WIcon url={h.icon} condition={h.condition} size={26} className="my-1 text-brand-400" />
                <span className="text-sm font-semibold">{tempOf(h.temp_c, h.temp_f, unit)}</span>
                <span className="mt-0.5 flex items-center gap-0.5 text-[10px] text-blue-500">
                  <Droplets size={9} /> {h.chance_of_rain}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily forecast */}
      {data.daily?.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <span>{data.daily.length}-day forecast</span>
          </div>
          <div className="space-y-1">
            {data.daily.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl bg-white/50 dark:bg-white/5 px-3 py-2 text-sm"
              >
                <span className="w-10 font-semibold">{i === 0 ? 'Today' : d.day_name}</span>
                <WIcon url={d.icon} condition={d.condition} size={26} className="text-brand-400" />
                <span className="flex-1 truncate text-slate-500">{d.condition}</span>
                <span className="flex items-center gap-0.5 text-[11px] text-blue-500">
                  <Droplets size={10} /> {d.chance_of_rain}%
                </span>
                <span className="w-16 text-right font-semibold">
                  {tempOf(d.max_c, d.max_f, unit)}
                  <span className="ml-1 text-slate-400">{tempOf(d.min_c, d.min_f, unit)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>Updated {data.last_updated || data.localtime}</span>
        {data.is_mock && <span>Sample data — add a WeatherAPI key to go live</span>}
      </div>
    </div>
  )
}
