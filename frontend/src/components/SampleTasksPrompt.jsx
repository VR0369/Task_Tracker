import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Modal from './Modal.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { api } from '../api/client'

/**
 * One-time prompt shown to brand-new users after their first login:
 * "Do you wish to add sample tasks?" — Yes seeds them, No leaves the account
 * empty. Either answer is persisted (sample_prompt_seen) so it never re-shows.
 */
export default function SampleTasksPrompt() {
  const { user, setUser } = useAuth()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)

  const open = !!user && user.sample_prompt_seen === false

  const resolve = async (add) => {
    if (busy) return
    setBusy(true)
    try {
      const { data } = await api.post('/auth/sample-prompt', { add })
      setUser(data) // has sample_prompt_seen: true → closes the modal
      if (add) {
        await queryClient.invalidateQueries() // refresh dashboard / tasks / activity
        toast.success('Sample tasks added')
      }
    } catch {
      toast.error('Something went wrong — please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={() => resolve(false)} title="Welcome to Orbit 👋">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grad-brand text-white">
            <Sparkles size={20} />
          </div>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Do you wish to add a set of <span className="font-semibold">sample tasks</span>? They
            populate the dashboard, calendar, and analytics so you can explore Orbit right away —
            and you can delete them anytime.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => resolve(false)} disabled={busy} className="btn-ghost flex-1">
            No, thanks
          </button>
          <button onClick={() => resolve(true)} disabled={busy} className="btn-primary flex-1">
            {busy ? 'Adding…' : 'Yes, add them'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
