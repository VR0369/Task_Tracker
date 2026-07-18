import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, Quote as QuoteIcon } from 'lucide-react'
import { useQuote } from '../api/hooks'

export default function QuoteBanner() {
  const { data, isLoading, refetch, isFetching } = useQuote()

  return (
    <div className="glass-card relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute -right-6 -top-6 opacity-10">
        <QuoteIcon size={120} />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-h-[3.5rem] flex-1">
          {isLoading ? (
            <div className="space-y-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/3" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={data?.text}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                <p className="font-display text-xl font-semibold leading-snug md:text-2xl">
                  “{data?.text}”
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  — {data?.author}
                  {data?.category && (
                    <> · <span className="capitalize">{data.category}</span></>
                  )}
                </p>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
        <button
          onClick={() => refetch()}
          aria-label="New quote"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/60 dark:bg-white/5 text-slate-500 hover:text-brand-600"
        >
          <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  )
}
