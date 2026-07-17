import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import TaskForm from '../components/TaskForm.jsx'
import { useCreateTask } from '../api/hooks'

export default function CreateTask() {
  const navigate = useNavigate()
  const create = useCreateTask()

  const submit = (payload) =>
    create.mutate(payload, {
      onSuccess: () => navigate('/tasks'),
    })

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-grad-brand text-white shadow-lg shadow-brand-500/30">
          <Plus size={22} />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">Create Task</h1>
          <p className="text-sm text-slate-500">Add something to your orbit.</p>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <TaskForm
          onSubmit={submit}
          onCancel={() => navigate(-1)}
          submitting={create.isPending}
        />
      </motion.div>
    </div>
  )
}
