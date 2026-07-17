import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

export { dayjs }

export const SEVERITY = {
  critical: { label: 'Critical', color: '#ef4444', bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/30' },
  high: { label: 'High', color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500/30' },
  low: { label: 'Low', color: '#22c55e', bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400', ring: 'ring-green-500/30' },
}

export const SEVERITY_ORDER = { critical: 0, high: 1, low: 2 }

export function fmtDate(d, format = 'MMM D, YYYY') {
  return dayjs(d).format(format)
}

export function fmtTime(d) {
  return dayjs(d).format('h:mm A')
}

export function fromNow(d) {
  return dayjs(d).fromNow()
}

/** Bucket a task by its due date relative to today (local). */
export function bucketOf(task) {
  const today = dayjs().startOf('day')
  const due = dayjs(task.due_at).startOf('day')
  if (task.status === 'completed') return 'completed'
  if (due.isBefore(today)) return 'past_due'
  if (due.isSame(today)) return 'today'
  return 'future'
}
