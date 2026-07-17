import { SEVERITY } from '../utils/format'

export default function SeverityBadge({ severity }) {
  const s = SEVERITY[severity] || SEVERITY.low
  return (
    <span className={`chip ${s.bg} ${s.text} ring-1 ${s.ring}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}
