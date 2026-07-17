import { motion } from 'framer-motion'
import { Landmark, RefreshCw } from 'lucide-react'
import { useOnThisDay } from '../api/hooks'

export default function OnThisDay() {
  const { data, isLoading, refetch, isFetching } = useOnThisDay()
  return (
    <div className="glass-card flex items-center gap-4 p-5">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-grad-blue text-white">
        <Landmark size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">On This Day</div>
        {isLoading ? (
          <div className="skeleton mt-1 h-4 w-2/3" />
        ) : (
          <motion.p
            key={data?.text}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm"
          >
            <span className="font-semibold">{data?.year}</span> — {data?.text}
          </motion.p>
        )}
      </div>
      <button
        onClick={() => refetch()}
        aria-label="Another event"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-brand-600"
      >
        <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
