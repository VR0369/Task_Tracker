import { motion } from 'framer-motion'
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2 } from 'lucide-react'
import Counter from './Counter.jsx'
import { CardSkeleton } from './Skeletons.jsx'
import { fmtDate } from '../utils/format.js'

const CARDS = [
  { key: 'past_due', label: 'Past Due', grad: 'bg-grad-red', icon: AlertTriangle },
  { key: 'due_today', label: 'Due Today', grad: 'bg-grad-yellow', icon: CalendarClock },
  { key: 'upcoming', label: 'Upcoming', grad: 'bg-grad-blue', icon: CalendarRange },
  { key: 'completed_yesterday', label: 'Completed Yesterday', grad: 'bg-grad-green', icon: CheckCircle2 },
]

function Card({ label, subLabel, grad, icon: Icon, data, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      whileHover={{ y: -4 }}
      className={`relative overflow-hidden rounded-2xl ${grad} p-5 text-white shadow-glass-lg`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 opacity-20">
        <Icon size={96} />
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide opacity-90">
        <Icon size={16} /> {label}
        {subLabel && <span className="normal-case tracking-normal opacity-75">{subLabel}</span>}
      </div>
      <div className="mt-2 font-display text-5xl font-bold">
        <Counter value={data?.total ?? 0} />
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <Row label="Critical" value={data?.critical ?? 0} />
        <Row label="High" value={data?.high ?? 0} />
        <Row label="Low" value={data?.low ?? 0} />
      </div>
    </motion.div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-t border-white/20 pt-1">
      <span className="opacity-90">{label}</span>
      <span className="font-semibold tabular-nums">
        <Counter value={value} />
      </span>
    </div>
  )
}

export default function DashboardCards({ data, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((c) => (
          <CardSkeleton key={c.key} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map((c, i) => (
        <Card
          key={c.key}
          {...c}
          data={data?.[c.key]}
          subLabel={c.key === 'upcoming' && data?.upcoming_end ? `till ${fmtDate(data.upcoming_end, 'MMM D')}` : null}
          index={i}
        />
      ))}
    </div>
  )
}
