import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X, Sun, Moon, Monitor, Plus, PanelLeftClose, PanelLeft } from 'lucide-react'
import Sidebar from './Sidebar.jsx'
import BottomNav from './BottomNav.jsx'
import { useTheme } from '../theme/ThemeContext.jsx'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const opts = [
    { key: 'light', icon: Sun },
    { key: 'dark', icon: Moon },
    { key: 'system', icon: Monitor },
  ]
  return (
    <div className="flex items-center gap-0.5 rounded-xl bg-white/60 dark:bg-white/5 p-0.5 border border-white/50 dark:border-white/10">
      {opts.map(({ key, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          aria-label={`${key} theme`}
          className={`grid h-8 w-8 place-items-center rounded-lg transition ${
            theme === key ? 'bg-grad-brand text-white' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  )
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`glass sticky top-0 hidden h-screen shrink-0 border-r md:block transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              className="glass fixed inset-y-0 left-0 z-50 w-64 border-r md:hidden"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            >
              <button
                className="absolute right-3 top-4 text-slate-500"
                onClick={() => setDrawer(false)}
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
              <Sidebar onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-white/60 md:hidden"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <button
            className="hidden h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-white/60 md:grid"
            onClick={() => setCollapsed((c) => !c)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <div className="flex-1" />
          <ThemeToggle />
        </header>

        <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-6xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating action button */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => navigate('/create')}
        className="fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full bg-grad-brand text-white shadow-xl shadow-brand-500/40 md:bottom-8 md:right-8"
        aria-label="Create task"
      >
        <Plus size={26} />
      </motion.button>

      <BottomNav />
    </div>
  )
}
