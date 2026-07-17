import { motion } from 'framer-motion'

export default function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <motion.div
        className="h-12 w-12 rounded-full border-4 border-brand-200 border-t-brand-500"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      />
    </div>
  )
}
