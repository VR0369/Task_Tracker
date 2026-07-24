import { useForm } from 'react-hook-form'
import { motion } from 'framer-motion'
import { List, Repeat, Save, RotateCcw, X } from 'lucide-react'
import { SEVERITY } from '../utils/format'
import { dayjs } from '../utils/format'

const SEV_KEYS = ['critical', 'high', 'low']
const REPEAT_UNIT = { daily: 'day', weekly: 'week', monthly: 'month' }

function toDateTimeParts(iso) {
  const d = iso ? dayjs(iso) : dayjs()
  return { date: d.format('YYYY-MM-DD'), time: iso ? d.format('HH:mm') : '09:00' }
}

/** Start date is optional: blank fields mean "no start date". */
function toStartParts(iso) {
  if (!iso) return { start_date: '', start_time: '' }
  const d = dayjs(iso)
  return { start_date: d.format('YYYY-MM-DD'), start_time: d.format('HH:mm') }
}

export default function TaskForm({ task, onSubmit, onCancel, submitting }) {
  const initial = task
    ? {
        name: task.name,
        severity: task.severity,
        notes: task.notes || '',
        ...toDateTimeParts(task.due_at),
        ...toStartParts(task.start_at),
        repeat: task.recurrence_frequency || 'none',
        repeat_interval: task.recurrence_interval || 1,
        repeat_end_type: task.recurrence_count ? 'count' : 'until',
        repeat_until: task.recurrence_until ? dayjs(task.recurrence_until).format('YYYY-MM-DD') : '',
        repeat_count: task.recurrence_count || 5,
      }
    : {
        name: '',
        severity: 'low',
        notes: '',
        ...toDateTimeParts(null),
        ...toStartParts(null),
        repeat: 'none',
        repeat_interval: 1,
        repeat_end_type: 'until',
        repeat_until: '',
        repeat_count: 5,
      }

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
  const startDate = watch('start_date')
  const repeat = watch('repeat')
  const repeatEndType = watch('repeat_end_type')

  const submit = (v) => {
    const due_at = dayjs(`${v.date} ${v.time}`).toISOString()
    const start_at = v.start_date
      ? dayjs(`${v.start_date} ${v.start_time || '09:00'}`).toISOString()
      : null
    const payload = { name: v.name.trim(), severity: v.severity, notes: v.notes, start_at, due_at }
    if (v.repeat !== 'none') {
      payload.recurrence_frequency = v.repeat
      payload.recurrence_interval = Number(v.repeat_interval) || 1
      if (v.repeat_end_type === 'until') {
        payload.recurrence_until = dayjs(v.repeat_until).endOf('day').toISOString()
      } else {
        payload.recurrence_count = Number(v.repeat_count) || 1
      }
    } else {
      payload.recurrence_frequency = null
    }
    onSubmit(payload)
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
          <div className="mb-1.5 flex items-center justify-between">
            <label className="label !mb-0" htmlFor="start_date">
              Start Date <span className="font-normal text-slate-400">(optional)</span>
            </label>
            {startDate && (
              <button
                type="button"
                onClick={() => {
                  setValue('start_date', '', { shouldDirty: true, shouldValidate: true })
                  setValue('start_time', '', { shouldDirty: true })
                }}
                className="text-xs text-brand-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <input
            id="start_date"
            type="date"
            className="input"
            {...register('start_date', {
              validate: (v, all) =>
                !v ||
                !dayjs(`${v} ${all.start_time || '09:00'}`).isAfter(
                  dayjs(`${all.date} ${all.time}`)
                ) ||
                'Start must be on or before the due date',
            })}
          />
          {errors.start_date && (
            <p className="mt-1 text-xs text-red-500">{errors.start_date.message}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="start_time">
            Start Time
          </label>
          <input
            id="start_time"
            type="time"
            className="input"
            disabled={!startDate}
            {...register('start_time')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="date">
            Due Date
          </label>
          <input
            id="date"
            type="date"
            className="input"
            {...register('date', { required: true, deps: ['start_date'] })}
          />
        </div>
        <div>
          <label className="label" htmlFor="time">
            Due Time
          </label>
          <input
            id="time"
            type="time"
            className="input"
            {...register('time', { required: true, deps: ['start_date'] })}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Repeat size={16} className="text-slate-400" />
          <span className="label !mb-0">Repeat</span>
        </div>
        {task?.series_id && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This task is part of a recurring series. Changing these settings updates this and all
            later occurrences.
          </p>
        )}
        <select className="input w-auto" {...register('repeat')}>
          <option value="none">Does not repeat</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        {repeat !== 'none' && (
          <>
            <div className="flex items-center gap-2">
              <span className="label !mb-0">Every</span>
              <input
                type="number"
                min={1}
                max={365}
                className="input w-20"
                {...register('repeat_interval', { valueAsNumber: true, min: 1, max: 365 })}
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {REPEAT_UNIT[repeat]}(s)
              </span>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" value="until" {...register('repeat_end_type')} /> Until date
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="radio" value="count" {...register('repeat_end_type')} /> Number of
                times
              </label>
            </div>

            {repeatEndType === 'until' ? (
              <input
                type="date"
                className="input"
                {...register('repeat_until', { required: repeatEndType === 'until' })}
              />
            ) : (
              <input
                type="number"
                min={1}
                max={100}
                className="input w-24"
                {...register('repeat_count', { valueAsNumber: true, min: 1, max: 100 })}
              />
            )}
          </>
        )}
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
