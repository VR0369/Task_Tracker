import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Plus,
  ListChecks,
  CalendarDays,
  UserPlus,
  Activity,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/create', label: 'Create Task', icon: Plus },
  { to: '/tasks', label: 'View Tasks', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/invite', label: 'Invite Members', icon: UserPlus },
  { to: '/activity', label: 'Activity Log', icon: Activity },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Item({ to, label, icon: Icon, end, collapsed, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
          isActive
            ? 'bg-grad-brand text-white shadow-lg shadow-brand-500/30'
            : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/5'
        }`
      }
    >
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

export default function Sidebar({ collapsed, onNavigate }) {
  const { user, logout } = useAuth()
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-3 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-grad-brand text-white shadow-lg shadow-brand-500/30">
          <motion.span
            className="block h-4 w-4 rounded-full border-2 border-white"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          />
        </div>
        {!collapsed && (
          <div className="font-display text-lg font-bold tracking-tight">Orbit</div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {NAV.map((n) => (
          <Item key={n.to} {...n} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-white/40 dark:border-white/10 p-2">
        {!collapsed && user && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl px-2 py-2">
            <img
              src={user.picture}
              alt=""
              className="h-9 w-9 rounded-full ring-2 ring-white/60"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-red-500/10 hover:text-red-600"
        >
          <LogOut size={20} />
          {!collapsed && 'Logout'}
        </button>
      </div>
    </div>
  )
}
