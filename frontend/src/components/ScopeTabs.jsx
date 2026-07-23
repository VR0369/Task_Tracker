import { Users, User } from 'lucide-react'

const TABS = [
  { key: 'personal', label: 'Personal', icon: User },
  { key: 'shared', label: 'Shared', icon: Users },
]

export default function ScopeTabs({ value, onChange }) {
  return (
    <div className="glass-card inline-flex items-center gap-1 p-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              active
                ? 'bg-brand-500 text-white shadow'
                : 'text-slate-500 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        )
      })}
    </div>
  )
}
