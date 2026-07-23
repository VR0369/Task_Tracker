import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Clock, Activity as ActivityIcon, CalendarClock, ArrowRight, UserRound } from 'lucide-react'
import QuoteBanner from '../components/QuoteBanner.jsx'
import WeatherWidget from '../components/WeatherWidget.jsx'
import OnThisDay from '../components/OnThisDay.jsx'
import DashboardCards from '../components/DashboardCards.jsx'
import ScopeTabs from '../components/ScopeTabs.jsx'
import Analytics from '../components/Analytics.jsx'
import SeverityBadge from '../components/SeverityBadge.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonList } from '../components/Skeletons.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useDashboard, useTasks, useActivity, useCompleteTask, useCalendars } from '../api/hooks'
import { bucketOf, fmtTime, fromNow } from '../utils/format'

export default function Home() {
  const { user } = useAuth()
  const [scope, setScope] = useState('personal')
  const { data: calendars } = useCalendars()
  const hasShared = (calendars || []).some((c) => c.owner_id !== user?.id)

  const { data: dash, isLoading: dashLoading } = useDashboard(scope)
  const { data: tasks, isLoading: tasksLoading } = useTasks({ status: 'pending', sort: 'due_at', scope })
  const { data: activity, isLoading: actLoading } = useActivity(8, scope)
  const complete = useCompleteTask()

  const todays = (tasks?.items || []).filter((t) => bucketOf(t) === 'today')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            Hi, {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-slate-500">Here's your day at a glance.</p>
        </div>
        {hasShared && <ScopeTabs value={scope} onChange={setScope} />}
      </div>

      <QuoteBanner />

      <DashboardCards data={dash} isLoading={dashLoading} />

      {/* Today's Timeline (full width) */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Clock size={18} /> Today's Timeline
          </h2>
          <Link to="/tasks" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {tasksLoading ? (
          <SkeletonList count={3} />
        ) : todays.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing due today"
            hint="Enjoy the breathing room, or plan ahead."
            action={
              <Link to="/create" className="btn-primary">
                Create a task
              </Link>
            }
          />
        ) : (
          <ol className="relative space-y-3 border-l-2 border-brand-200/60 pl-5 dark:border-white/10">
            {todays.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card flex items-center gap-3 p-3"
              >
                <span className="absolute -left-[9px] h-4 w-4 rounded-full border-2 border-white bg-brand-500" />
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-green-500"
                  onChange={() => complete.mutate({ id: t.id })}
                  aria-label={`Complete ${t.name}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{t.name}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{fmtTime(t.due_at)}</span>
                    {scope === 'shared' && t.created_by_name && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-slate-600 dark:text-slate-300">
                        <UserRound size={11} /> {t.created_by_name}
                      </span>
                    )}
                  </div>
                </div>
                <SeverityBadge severity={t.severity} />
              </motion.li>
            ))}
          </ol>
        )}
      </div>

      {/* Weather + On This Day, side by side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <WeatherWidget />
        <OnThisDay />
      </div>

      {/* Recent Activity (full width) */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
          <ActivityIcon size={18} /> Recent Activity
        </h2>
        {actLoading ? (
          <SkeletonList count={4} />
        ) : (activity || []).length === 0 ? (
          <p className="text-sm text-slate-500">No recent activity.</p>
        ) : (
          <div className="glass-card divide-y divide-white/40 dark:divide-white/10">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3">
                <img src={avatar(a.actor_name)} alt="" className="h-7 w-7 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{a.summary}</p>
                  <p className="text-xs text-slate-400">{fromNow(a.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Analytics />
    </div>
  )
}

function avatar(name) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || '?')}`
}
