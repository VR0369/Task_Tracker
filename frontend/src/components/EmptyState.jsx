import { motion } from 'framer-motion'

export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/60 dark:border-white/10 px-6 py-12 text-center"
    >
      {Icon && (
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-grad-brand text-white shadow-lg shadow-brand-500/30">
          <Icon size={28} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {hint && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  )
}
