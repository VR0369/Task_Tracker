import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { UserPlus, Copy, Check, Shield, Users } from 'lucide-react'
import { SkeletonList } from '../components/Skeletons.jsx'
import { useInvites, useCreateInvite, useInviteAction, useCalendars } from '../api/hooks'
import { fromNow } from '../utils/format'

const STATUS_STYLE = {
  pending: 'bg-slate-400/15 text-slate-500',
  awaiting_approval: 'bg-amber-400/15 text-amber-600',
  approved: 'bg-green-400/15 text-green-600',
  rejected: 'bg-red-400/15 text-red-600',
}

export default function InvitePage() {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { role: 'contributor' } })
  const { data: invites, isLoading } = useInvites()
  const { data: calendars } = useCalendars()
  const createInvite = useCreateInvite()
  const action = useInviteAction()
  const [copied, setCopied] = useState(null)

  const adminCal = (calendars || []).find((c) => c.my_role === 'admin')
  const isAdmin = !!adminCal

  const submit = (v) => {
    createInvite.mutate(
      { email: v.email, role: v.role, calendar_id: adminCal?.id },
      {
        onSuccess: (res) => {
          reset({ email: '', role: 'contributor' })
          if (res?.link) copy(res.link)
        },
      }
    )
  }

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(link)
      toast.success('Invite link copied')
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast('Copy this link: ' + link)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Invite Members</h1>
        <p className="text-sm text-slate-500">Collaborate on your calendar with roles.</p>
      </div>

      {!isAdmin ? (
        <div className="glass-card p-6 text-sm text-slate-500">
          <Shield size={18} className="mb-2 text-amber-500" />
          Only a calendar <span className="font-semibold">admin</span> can invite members.
        </div>
      ) : (
        <div className="glass-card p-5">
          <form onSubmit={handleSubmit(submit)} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="teammate@gmail.com"
                {...register('email', { required: true })}
              />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input w-auto" {...register('role')}>
                <option value="admin">Admin</option>
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={createInvite.isPending}>
              <UserPlus size={16} /> Invite
            </button>
          </form>
        </div>
      )}

      {/* Members */}
      {adminCal && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-semibold">
            <Users size={18} /> Members
          </h2>
          <div className="glass-card divide-y divide-white/40 dark:divide-white/10">
            {adminCal.members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-3">
                <img
                  src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{m.name}</div>
                  <div className="truncate text-xs text-slate-500">{m.email}</div>
                </div>
                <span className="chip bg-brand-500/15 capitalize text-brand-600">{m.role}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invitations */}
      <div>
        <h2 className="mb-3 font-display text-lg font-semibold">Invitations</h2>
        {isLoading ? (
          <SkeletonList count={3} />
        ) : (invites || []).length === 0 ? (
          <p className="text-sm text-slate-500">No invitations yet.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.id} className="glass-card flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{inv.email}</div>
                  <div className="text-xs text-slate-500">
                    {inv.role} · {fromNow(inv.created_at)}
                  </div>
                </div>
                <span className={`chip capitalize ${STATUS_STYLE[inv.status] || ''}`}>
                  {inv.status.replace('_', ' ')}
                </span>
                {inv.status === 'awaiting_approval' && (
                  <div className="flex gap-2">
                    <button
                      className="btn bg-green-500 !py-1.5 text-white hover:bg-green-600"
                      onClick={() => action.mutate({ id: inv.id, action: 'approve' })}
                    >
                      Approve
                    </button>
                    <button
                      className="btn-ghost !py-1.5"
                      onClick={() => action.mutate({ id: inv.id, action: 'reject' })}
                    >
                      Reject
                    </button>
                  </div>
                )}
                {inv.status === 'pending' && (
                  <button
                    className="btn-ghost !py-1.5"
                    onClick={() =>
                      copy(`${window.location.origin}/invite/accept?token=${inv.token}`)
                    }
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} Link
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
