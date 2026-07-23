import { motion } from 'framer-motion'
import { Pencil, Trash2, Clock, CalendarDays, Play, UserRound } from 'lucide-react'
import SeverityBadge from './SeverityBadge.jsx'
import { fmtDate, fmtTime } from '../utils/format'

export default function TaskCard({
  task,
  onToggle,
  onEdit,
  onDelete,
  canWrite = true,
  showCreator = false,
}) {
  const done = task.status === 'completed'
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass-card group flex items-start gap-3 p-4"
    >
      <button
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        disabled={!canWrite}
        onClick={() => onToggle?.(task)}
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition ${
          done
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-slate-400 bg-white/80 dark:border-white/30 dark:bg-white/5 hover:border-brand-500'
        } disabled:opacity-40`}
      >
        {done && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h4
            className={`font-semibold ${
              done ? 'text-slate-400 line-through' : ''
            }`}
          >
            {task.name}
          </h4>
          <SeverityBadge severity={task.severity} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          {task.start_at && (
            <span className="inline-flex items-center gap-1" title="Starts">
              <Play size={13} /> {fmtDate(task.start_at)}, {fmtTime(task.start_at)}
            </span>
          )}
          <span className="inline-flex items-center gap-1" title="Due">
            <CalendarDays size={13} /> {fmtDate(task.due_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} /> {fmtTime(task.due_at)}
          </span>
          {showCreator && task.created_by_name && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-slate-600 dark:text-slate-300"
              title={task.created_by_email}
            >
              <UserRound size={13} /> {task.created_by_name}
            </span>
          )}
        </div>
        {task.notes && (
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
            {task.notes}
          </p>
        )}
      </div>

      {canWrite && (
        <div className="flex shrink-0 items-center gap-1 opacity-70 transition group-hover:opacity-100">
          <button
            onClick={() => onEdit?.(task)}
            aria-label="Edit task"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-brand-500/10 hover:text-brand-600"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => onDelete?.(task)}
            aria-label="Delete task"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-600"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </motion.div>
  )
}
