import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { List, Save, RotateCcw, X } from 'lucide-react'
import { SEVERITY } from '../utils/format'
import { dayjs } from '../utils/format'

const SEV_KEYS = ['critical', 'high', 'low']

function toDateTimeParts(iso) {
  const d = iso ? dayjs(iso) : dayjs()
  return { date: d.format('YYYY-MM-DD'), time: iso ? d.format('HH:mm') : '09:00' }
}

export default function TaskForm({ task, onSubmit, onCancel, submitting }) {
  const initial = task
    ? {
        name: task.name,
        severity: task.severity,
        notes: task.notes || '',
        ...toDateTimeParts(task.due_at),
      }
    : { name: '', severity: 'low', notes: '', ...toDateTimeParts(null) }

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: initial })

  const severity = watch('severity')
  const notes = watch('notes')

  const submit = (v) => {
    const due_at = dayjs(`${v.date} ${v.time}`).toISOString()
    onSubmit({ name: v.name.trim(), severity: v.severity, notes: v.notes, due_at })
  }

  const addBullet = () => {
    const next = (notes ? notes.replace(/\s*$/, '') + '\n' : '') + '- '
    setValue('notes', next, { shouldDirty: true })
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-5">
      <div>
        <label className="label" htmlFor="name">
          Task Name
        </label>
        <input
          id="name"
          className="input"
          placeholder="e.g. Finish the quarterly report"
          {...register('name', { required: 'Task name is required', maxLength: 200 })}
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>

      <div>
        <span className="label">Severity</span>
        <div className="grid grid-cols-3 gap-2">
          {SEV_KEYS.map((k) => {
            const s = SEVERITY[k]
            const active = severity === k
            return (
              <button
                type="button"
                key={k}
                onClick={() => setValue('severity', k, { shouldDirty: true })}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
                  active ? 'text-white' : 'text-slate-600 dark:text-slate-300 border-transparent bg-white/60 dark:bg-white/5'
                }`}
                style={active ? { background: s.color, borderColor: s.color } : { borderColor: 'transparent' }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">
            Due Date
          </label>
          <input id="date" type="date" className="input" {...register('date', { required: true })} />
        </div>
        <div>
          <label className="label" htmlFor="time">
            Due Time
          </label>
          <input id="time" type="time" className="input" {...register('time', { required: true })} />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="label !mb-0" htmlFor="notes">
            Notes
          </label>
          <button
            type="button"
            onClick={addBullet}
            className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
          >
            <List size={14} /> Add bullet
          </button>
        </div>
        <textarea
          id="notes"
          rows={5}
          className="input resize-y"
          placeholder="Add details… supports Markdown (- bullets, **bold**)"
          {...register('notes')}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="submit"
          disabled={submitting}
          className="btn-primary"
        >
          <Save size={16} /> {task ? 'Save changes' : 'Save task'}
        </motion.button>
        <button type="button" onClick={() => reset(initial)} className="btn-ghost">
          <RotateCcw size={16} /> Reset
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost">
            <X size={16} /> Cancel
          </button>
        )}
      </div>
    </form>
  )
}
