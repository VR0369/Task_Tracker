import { useState } from 'react'
import toast from 'react-hot-toast'
import { Palette, Clock, Bell, Cloud, LayoutGrid, Save } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'

const ACCENTS = ['#7c5cff', '#4f8cff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6']
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]
const DATE_FORMATS = ['MMM D, YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <Icon size={18} /> {title}
      </h2>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const { theme, setTheme, accent, setAccent } = useTheme()
  const [s, setS] = useState(() => ({ ...(user?.settings || {}) }))
  const [saving, setSaving] = useState(false)

  const set = (patch) => setS((prev) => ({ ...prev, ...patch }))
  const setNotif = (k, v) => set({ notifications: { ...(s.notifications || {}), [k]: v } })

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ settings: { ...s, theme, accent_color: accent } })
      toast.success('Settings saved')
    } catch {
      toast.error('Could not save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Settings</h1>
          <p className="text-sm text-slate-500">Personalize your workspace.</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          <Save size={16} /> Save
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Section icon={Palette} title="Appearance">
          <label className="label">Theme</label>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {['light', 'dark', 'system'].map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-xl border-2 py-2 text-sm font-semibold capitalize transition ${
                  theme === t ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-transparent bg-white/60 dark:bg-white/5'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <label className="label">Accent color</label>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => setAccent(c)}
                aria-label={`Accent ${c}`}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 transition ${
                  accent === c ? 'ring-slate-800 dark:ring-white' : 'ring-transparent'
                }`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Section>

        <Section icon={Clock} title="Locale & Time">
          <label className="label">Time zone</label>
          <select className="input mb-4" value={s.timezone || 'UTC'} onChange={(e) => set({ timezone: e.target.value })}>
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="label">Date format</label>
          <select
            className="input"
            value={s.date_format || 'MMM D, YYYY'}
            onChange={(e) => set({ date_format: e.target.value })}
          >
            {DATE_FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </Section>

        <Section icon={LayoutGrid} title="Defaults">
          <label className="label">Default calendar view</label>
          <div className="grid grid-cols-3 gap-2">
            {['day', 'week', 'month'].map((v) => (
              <button
                key={v}
                onClick={() => set({ default_calendar_view: v })}
                className={`rounded-xl border-2 py-2 text-sm font-semibold capitalize transition ${
                  s.default_calendar_view === v ? 'border-brand-500 bg-brand-500/10 text-brand-600' : 'border-transparent bg-white/60 dark:bg-white/5'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="label mt-4">Preferred weather location</label>
          <div className="relative">
            <Cloud size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              value={s.weather_location || ''}
              onChange={(e) => set({ weather_location: e.target.value })}
              placeholder="City"
            />
          </div>
        </Section>

        <Section icon={Bell} title="Notifications">
          {[
            ['task_created', 'Task created'],
            ['task_completed', 'Task completed'],
            ['invitations', 'Invitations'],
            ['email_reminders', 'Email reminders before deadlines'],
          ].map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center justify-between py-2">
              <span className="text-sm">{label}</span>
              <input
                type="checkbox"
                className="h-5 w-9 appearance-none rounded-full bg-slate-300 transition checked:bg-brand-500 relative cursor-pointer
                  before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition checked:before:translate-x-4"
                checked={!!s.notifications?.[k]}
                onChange={(e) => setNotif(k, e.target.checked)}
              />
            </label>
          ))}
        </Section>
      </div>
    </div>
  )
}
