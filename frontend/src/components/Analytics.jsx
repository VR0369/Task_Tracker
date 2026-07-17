import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { dayjs, SEVERITY } from '../utils/format'
import { useTasks } from '../api/hooks'

export default function Analytics() {
  const { data } = useTasks({ page_size: 500 })
  const items = data?.items || []

  const weekly = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day'))
    return days.map((d) => {
      const key = d.format('YYYY-MM-DD')
      const completed = items.filter(
        (t) => t.completed_at && dayjs(t.completed_at).format('YYYY-MM-DD') === key
      ).length
      const created = items.filter(
        (t) => t.created_at && dayjs(t.created_at).format('YYYY-MM-DD') === key
      ).length
      return { day: d.format('dd'), completed, created }
    })
  }, [items])

  const mix = useMemo(() => {
    const counts = { critical: 0, high: 0, low: 0 }
    items.forEach((t) => {
      if (t.status !== 'completed') counts[t.severity] = (counts[t.severity] || 0) + 1
    })
    return Object.entries(counts).map(([k, v]) => ({ name: SEVERITY[k].label, value: v, color: SEVERITY[k].color }))
  }, [items])

  const hasMix = mix.some((m) => m.value > 0)

  return (
    <div className="glass-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold">
        <BarChart3 size={18} /> Analytics
      </h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Last 7 days
          </p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} barGap={2}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip
                  cursor={{ fill: 'rgba(124,92,255,0.08)' }}
                  contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }}
                />
                <Bar dataKey="created" fill="#c4b5fd" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#7c5cff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#c4b5fd]" /> Created
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[#7c5cff]" /> Completed
            </span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Open by severity
          </p>
          <div className="h-44">
            {hasMix ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mix} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={3}>
                    {mix.map((m) => (
                      <Cell key={m.name} fill={m.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-400">
                All caught up 🎉
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
