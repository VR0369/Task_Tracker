import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ListChecks, CalendarDays, Activity } from 'lucide-react'

const ITEMS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/activity', label: 'Activity', icon: Activity },
]

export default function BottomNav() {
  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t px-2 py-1.5 md:hidden">
      {ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] font-medium ${
              isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
