import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '../components/Modal.jsx'
import TaskForm from '../components/TaskForm.jsx'
import ScopeTabs from '../components/ScopeTabs.jsx'
import { useTasks, useUpdateTask, useCalendars } from '../api/hooks'
import { dayjs, SEVERITY, fmtTime } from '../utils/format'
import { useAuth } from '../auth/AuthContext.jsx'
import { useScope } from '../scope/ScopeContext.jsx'

const VIEWS = ['month', 'week', 'day']

export default function CalendarPage() {
  const { user } = useAuth()
  const { scope, setScope } = useScope()
  const [view, setView] = useState(user?.settings?.default_calendar_view || 'month')
  const [cursor, setCursor] = useState(dayjs())
  const [editing, setEditing] = useState(null)
  const [dragId, setDragId] = useState(null)

  const { data: calendars } = useCalendars()
  const hasShared = (calendars || []).some(
    (c) => c.owner_id !== user?.id || (c.members || []).length > 1
  )

  const { data } = useTasks({ page_size: 200, scope })
  const update = useUpdateTask()

  const byDay = useMemo(() => {
    const map = {}
    ;(data?.items || []).forEach((t) => {
      const k = dayjs(t.due_at).format('YYYY-MM-DD')
      ;(map[k] ||= []).push(t)
    })
    Object.values(map).forEach((a) => a.sort((x, y) => new Date(x.due_at) - new Date(y.due_at)))
    return map
  }, [data])

  const move = (unit, dir) => setCursor((c) => c.add(dir, unit))

  const onDrop = (dateStr) => {
    if (!dragId) return
    const task = (data?.items || []).find((t) => t.id === dragId)
    setDragId(null)
    if (!task) return
    const newDue = dayjs(dateStr)
      .hour(dayjs(task.due_at).hour())
      .minute(dayjs(task.due_at).minute())
    const payload = { id: task.id, due_at: newDue.toISOString() }
    // Shift the start date by the same amount so the task keeps its duration
    // (and never ends up starting after it is due).
    if (task.start_at) {
      const shift = newDue.diff(dayjs(task.due_at))
      payload.start_at = dayjs(task.start_at).add(shift, 'millisecond').toISOString()
    }
    update.mutate(payload)
  }

  const submitEdit = (payload) =>
    update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setEditing(null) })

  const title =
    view === 'day'
      ? cursor.format('dddd, MMM D, YYYY')
      : view === 'week'
      ? `${cursor.startOf('week').format('MMM D')} – ${cursor.endOf('week').format('MMM D, YYYY')}`
      : cursor.format('MMMM YYYY')

  const stepUnit = view === 'day' ? 'day' : view === 'week' ? 'week' : 'month'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-3">
          {hasShared && <ScopeTabs value={scope} onChange={setScope} />}
          <div className="flex items-center gap-1 rounded-xl bg-white/60 dark:bg-white/5 p-0.5 border border-white/50 dark:border-white/10">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize transition ${
                  view === v ? 'bg-grad-brand text-white' : 'text-slate-500'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <button className="btn-ghost !p-2" onClick={() => move(stepUnit, -1)} aria-label="Previous">
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold">{title}</div>
            <button className="text-xs text-brand-600 hover:underline" onClick={() => setCursor(dayjs())}>
              Today
            </button>
          </div>
          <button className="btn-ghost !p-2" onClick={() => move(stepUnit, 1)} aria-label="Next">
            <ChevronRight size={18} />
          </button>
        </div>

        {view === 'month' && (
          <MonthGrid cursor={cursor} byDay={byDay} onOpen={setEditing} onDrop={onDrop} setDragId={setDragId} />
        )}
        {view === 'week' && (
          <WeekGrid cursor={cursor} byDay={byDay} onOpen={setEditing} onDrop={onDrop} setDragId={setDragId} />
        )}
        {view === 'day' && (
          <DayList cursor={cursor} byDay={byDay} onOpen={setEditing} showCreator={scope === 'shared'} />
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Tip: drag a task chip to another day to reschedule it.
      </p>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Task details">
        {editing && (
          <TaskForm task={editing} onSubmit={submitEdit} onCancel={() => setEditing(null)} submitting={update.isPending} />
        )}
      </Modal>
    </div>
  )
}

function Chip({ task, onOpen, setDragId }) {
  const s = SEVERITY[task.severity] || SEVERITY.low
  return (
    <button
      draggable
      onDragStart={() => setDragId(task.id)}
      onClick={() => onOpen(task)}
      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-white ${
        task.status === 'completed' ? 'opacity-50 line-through' : ''
      }`}
      style={{ background: s.color }}
      title={task.name}
    >
      {task.name}
    </button>
  )
}

function MonthGrid({ cursor, byDay, onOpen, onDrop, setDragId }) {
  const start = cursor.startOf('month').startOf('week')
  const cells = Array.from({ length: 42 }, (_, i) => start.add(i, 'day'))
  const today = dayjs().format('YYYY-MM-DD')
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = d.format('YYYY-MM-DD')
          const items = byDay[k] || []
          const muted = d.month() !== cursor.month()
          return (
            <div
              key={k}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(k)}
              className={`min-h-[92px] rounded-lg border border-white/40 dark:border-white/10 p-1 ${
                muted ? 'opacity-40' : ''
              } ${k === today ? 'ring-2 ring-brand-400' : ''}`}
            >
              <div className="mb-1 text-right text-xs text-slate-500">{d.date()}</div>
              <div className="space-y-0.5">
                {items.slice(0, 3).map((t) => (
                  <Chip key={t.id} task={t} onOpen={onOpen} setDragId={setDragId} />
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-slate-400">+{items.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekGrid({ cursor, byDay, onOpen, onDrop, setDragId }) {
  const start = cursor.startOf('week')
  const days = Array.from({ length: 7 }, (_, i) => start.add(i, 'day'))
  const today = dayjs().format('YYYY-MM-DD')
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const k = d.format('YYYY-MM-DD')
        const items = byDay[k] || []
        return (
          <div
            key={k}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(k)}
            className={`min-h-[140px] rounded-lg border border-white/40 dark:border-white/10 p-2 ${
              k === today ? 'ring-2 ring-brand-400' : ''
            }`}
          >
            <div className="mb-1 text-xs font-semibold text-slate-500">
              {d.format('ddd')} {d.date()}
            </div>
            <div className="space-y-1">
              {items.map((t) => (
                <Chip key={t.id} task={t} onOpen={onOpen} setDragId={setDragId} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayList({ cursor, byDay, onOpen, showCreator }) {
  const k = cursor.format('YYYY-MM-DD')
  const items = byDay[k] || []
  if (!items.length) return <p className="py-8 text-center text-sm text-slate-500">No tasks this day.</p>
  return (
    <div className="space-y-2">
      {items.map((t) => {
        const s = SEVERITY[t.severity] || SEVERITY.low
        return (
          <button
            key={t.id}
            onClick={() => onOpen(t)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/40 dark:border-white/10 p-3 text-left hover:bg-white/50"
          >
            <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
            <span className="w-16 text-xs text-slate-500">{fmtTime(t.due_at)}</span>
            <span className={`flex-1 font-medium ${t.status === 'completed' ? 'line-through opacity-50' : ''}`}>
              {t.name}
            </span>
            {showCreator && t.created_by_name && (
              <span className="text-xs text-slate-500">{t.created_by_name}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
