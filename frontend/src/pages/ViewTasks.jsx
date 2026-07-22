import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Search, SlidersHorizontal, ListChecks, AlertTriangle, Sun, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import TaskCard from '../components/TaskCard.jsx'
import Modal from '../components/Modal.jsx'
import TaskForm from '../components/TaskForm.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonList } from '../components/Skeletons.jsx'
import {
  useTasks,
  useCompleteTask,
  useUpdateTask,
  useDeleteTask,
  useCalendars,
} from '../api/hooks'
import { bucketOf, SEVERITY_ORDER } from '../utils/format'

const GROUPS = [
  {
    key: 'past_due',
    label: 'Past Due',
    icon: AlertTriangle,
    cls: 'bg-grad-red-soft dark:bg-grad-red-dim blink-pulse',
    tint: 'text-rose-800 dark:text-rose-200',
  },
  {
    key: 'today',
    label: "Today's Tasks",
    icon: Sun,
    cls: 'bg-grad-yellow-soft dark:bg-grad-yellow-dim',
    tint: 'text-amber-800 dark:text-amber-200',
  },
  {
    key: 'future',
    label: 'Future Tasks',
    icon: Sparkles,
    cls: 'bg-grad-blue-soft dark:bg-grad-blue-dim',
    tint: 'text-sky-800 dark:text-sky-200',
  },
]

export default function ViewTasks() {
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState('')
  const [sort, setSort] = useState('due_at')
  const [showCompleted, setShowCompleted] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const params = useMemo(() => {
    const p = { sort, order: 'asc', page_size: 200 }
    if (search) p.search = search
    if (severity) p.severity = severity
    if (!showCompleted) p.status = 'pending'
    return p
  }, [search, severity, sort, showCompleted])

  const { data, isLoading } = useTasks(params)
  const { data: calendars } = useCalendars()
  const complete = useCompleteTask()
  const update = useUpdateTask()
  const del = useDeleteTask()

  const canWrite = !calendars || calendars.some((c) => c.my_role !== 'viewer')

  const grouped = useMemo(() => {
    const g = { past_due: [], today: [], future: [], completed: [] }
    ;(data?.items || []).forEach((t) => g[bucketOf(t)].push(t))
    const sorter = (a, b) => {
      if (sort === 'severity') return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
      if (sort === 'name') return a.name.localeCompare(b.name)
      // Tasks without a start date fall back to their due date.
      if (sort === 'start_at')
        return new Date(a.start_at || a.due_at) - new Date(b.start_at || b.due_at)
      return new Date(a.due_at) - new Date(b.due_at)
    }
    Object.values(g).forEach((arr) => arr.sort(sorter))
    return g
  }, [data, sort])

  const submitEdit = (payload) =>
    update.mutate({ id: editing.id, ...payload }, { onSuccess: () => setEditing(null) })

  const confirmDelete = () =>
    del.mutate(deleting.id, { onSuccess: () => setDeleting(null) })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">View Tasks</h1>
          <p className="text-sm text-slate-500">Grouped automatically by due date.</p>
        </div>
        <Link to="/create" className="btn-primary">
          New task
        </Link>
      </div>

      {/* Filters */}
      <div className="glass-card flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !min-h-[42px] pl-9"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input !min-h-[42px] w-auto" value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
        <select className="input !min-h-[42px] w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="due_at">Sort: Due date</option>
          <option value="start_at">Sort: Start date</option>
          <option value="severity">Sort: Severity</option>
          <option value="name">Sort: A–Z</option>
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-500"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          Show completed
        </label>
        <SlidersHorizontal size={16} className="text-slate-400" />
      </div>

      {isLoading ? (
        <SkeletonList count={5} />
      ) : (data?.items || []).length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          hint="Create your first task to get things moving."
          action={
            <Link to="/create" className="btn-primary">
              Create a task
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {GROUPS.map(({ key, label, icon: Icon, cls, tint }) => {
            const items = grouped[key]
            if (!items.length) return null
            return (
              <section key={key} className={`rounded-2xl p-3 ${cls}`}>
                <h2 className={`mb-3 flex items-center gap-2 px-1 font-display text-lg font-semibold ${tint}`}>
                  <Icon size={18} /> {label}
                  <span className="ml-1 rounded-full bg-white/70 px-2 py-0.5 text-xs text-slate-600 dark:bg-white/10 dark:text-slate-300">
                    {items.length}
                  </span>
                </h2>
                <div className="space-y-3">
                  <AnimatePresence>
                    {items.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        canWrite={canWrite}
                        onToggle={(task) =>
                          complete.mutate({ id: task.id, completed: task.status !== 'completed' })
                        }
                        onEdit={setEditing}
                        onDelete={setDeleting}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )
          })}

          {showCompleted && grouped.completed.length > 0 && (
            <section className="rounded-2xl bg-slate-400/10 p-3">
              <h2 className="mb-3 px-1 font-display text-lg font-semibold text-slate-500">
                Completed <span className="text-xs">({grouped.completed.length})</span>
              </h2>
              <div className="space-y-3">
                <AnimatePresence>
                  {grouped.completed.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      canWrite={canWrite}
                      onToggle={(task) => complete.mutate({ id: task.id, completed: false })}
                      onEdit={setEditing}
                      onDelete={setDeleting}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit task">
        {editing && (
          <TaskForm
            task={editing}
            onSubmit={submitEdit}
            onCancel={() => setEditing(null)}
            submitting={update.isPending}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Delete task?">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Are you sure you want to delete <span className="font-semibold">{deleting?.name}</span>? This
          can't be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-ghost" onClick={() => setDeleting(null)}>
            Cancel
          </button>
          <button
            className="btn bg-red-500 text-white hover:bg-red-600"
            onClick={confirmDelete}
            disabled={del.isPending}
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}
