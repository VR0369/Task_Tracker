import { motion } from 'framer-motion'
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  UserPlus,
  UserCheck,
  Activity as ActivityIcon,
} from 'lucide-react'
import { SkeletonList } from '../components/Skeletons.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { useActivity } from '../api/hooks'
import { dayjs, fromNow } from '../utils/format'

const ICONS = {
  created: { icon: Plus, cls: 'bg-brand-500' },
  updated: { icon: Pencil, cls: 'bg-amber-500' },
  deleted: { icon: Trash2, cls: 'bg-red-500' },
  completed: { icon: CheckCircle2, cls: 'bg-green-500' },
  reopened: { icon: RotateCcw, cls: 'bg-slate-500' },
  invited: { icon: UserPlus, cls: 'bg-blue-500' },
  approved: { icon: UserCheck, cls: 'bg-green-600' },
  requested_access: { icon: UserPlus, cls: 'bg-amber-500' },
}

export default function ActivityLogPage() {
  const { data, isLoading } = useActivity(100)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Activity Log</h1>
        <p className="text-sm text-slate-500">A full audit trail of what's happened.</p>
      </div>

      {isLoading ? (
        <SkeletonList count={6} />
      ) : (data || []).length === 0 ? (
        <EmptyState icon={ActivityIcon} title="No activity yet" hint="Actions you take will show up here." />
      ) : (
        <div className="relative space-y-4 border-l-2 border-brand-200/60 pl-6 dark:border-white/10">
          {data.map((a, i) => {
            const meta = ICONS[a.action] || { icon: ActivityIcon, cls: 'bg-slate-400' }
            const Icon = meta.icon
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}
                className="relative"
              >
                <span
                  className={`absolute -left-[34px] grid h-6 w-6 place-items-center rounded-full text-white ${meta.cls}`}
                >
                  <Icon size={13} />
                </span>
                <div className="glass-card p-3">
                  <p className="text-sm">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {a.actor_name} · {dayjs(a.created_at).format('MMM D, h:mm A')} ·{' '}
                    {fromNow(a.created_at)}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
