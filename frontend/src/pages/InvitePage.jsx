import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { UserPlus, Copy, Check, Shield, Users, Mail, Trash2 } from 'lucide-react'
import { SkeletonList } from '../components/Skeletons.jsx'
import Modal from '../components/Modal.jsx'
import {
  useInvites,
  useCreateInvite,
  useInviteAction,
  useCalendars,
  useUpdateMemberRole,
  useRemoveMember,
} from '../api/hooks'
import { fromNow } from '../utils/format'

const STATUS_STYLE = {
  pending: 'bg-slate-400/15 text-slate-500',
  awaiting_approval: 'bg-amber-400/15 text-amber-600',
  approved: 'bg-green-400/15 text-green-600',
  rejected: 'bg-red-400/15 text-red-600',
  revoked: 'bg-red-400/15 text-red-600',
  expired: 'bg-slate-400/15 text-slate-400',
}

export default function InvitePage() {
  const { register, handleSubmit, reset } = useForm({ defaultValues: { role: 'contributor' } })
  const { data: invites, isLoading } = useInvites()
  const { data: calendars } = useCalendars()
  const createInvite = useCreateInvite()
  const action = useInviteAction()
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()
  const [copied, setCopied] = useState(null)
  const [created, setCreated] = useState(null) // { link, email, email_sent }
  const [removing, setRemoving] = useState(null) // member pending removal confirmation

  const adminCal = (calendars || []).find((c) => c.my_role === 'admin')
  const isAdmin = !!adminCal
  const memberName = Object.fromEntries((adminCal?.members || []).map((m) => [m.user_id, m.name]))

  const submit = (v) => {
    createInvite.mutate(
      { email: v.email, role: v.role, calendar_id: adminCal?.id },
      {
        onSuccess: (res) => {
          reset({ email: '', role: 'contributor' })
          setCreated({ link: res.link, email: v.email, email_sent: res.email_sent })
        },
      }
    )
  }

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(link)
      toast.success('Link copied successfully')
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
            {adminCal.members.map((m) => {
              const isOwner = m.user_id === adminCal.owner_id
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-3">
                  <img
                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(m.name)}`}
                    alt=""
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{m.name}</div>
                    <div className="truncate text-xs text-slate-500">{m.email}</div>
                    <div className="truncate text-[11px] text-slate-400">
                      {isOwner
                        ? 'Owner'
                        : m.invited_by
                        ? `Invited by ${memberName[m.invited_by] || 'admin'}${
                            m.joined_at ? ` · joined ${fromNow(m.joined_at)}` : ''
                          }`
                        : 'Member'}
                    </div>
                  </div>
                  {isOwner ? (
                    <span className="chip bg-brand-500/15 capitalize text-brand-600">{m.role}</span>
                  ) : (
                    <>
                      <select
                        className="input w-auto !min-h-0 py-1.5 pl-2.5 pr-7 text-xs capitalize"
                        value={m.role}
                        disabled={updateRole.isPending}
                        onChange={(e) =>
                          updateRole.mutate({
                            memberId: m.user_id,
                            role: e.target.value,
                            calendarId: adminCal.id,
                          })
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="contributor">Contributor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => setRemoving(m)}
                        aria-label="Remove member"
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-red-500/10 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              )
            })}
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
                  <div className="flex gap-2">
                    <button
                      className="btn-ghost !py-1.5"
                      onClick={() =>
                        copy(`${window.location.origin}/invite/accept?token=${inv.token}`)
                      }
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />} Link
                    </button>
                    <button
                      className="btn-ghost !py-1.5 text-red-500"
                      onClick={() => action.mutate({ id: inv.id, action: 'revoke' })}
                    >
                      Revoke
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invitation created — success panel with copy options */}
      <Modal open={!!created} onClose={() => setCreated(null)} title="Invitation created">
        {created && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-grad-brand text-white">
                <Mail size={18} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {created.email_sent ? (
                  <>
                    An invitation email was sent to <strong>{created.email}</strong>. You can also
                    share this link on WhatsApp, Slack, SMS, etc.:
                  </>
                ) : (
                  <>
                    Share this invite link with <strong>{created.email}</strong> (email wasn’t sent):
                  </>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-white/50 bg-white/50 p-2 dark:border-white/10 dark:bg-white/5">
              <input
                readOnly
                value={created.link}
                onFocus={(e) => e.target.select()}
                className="w-full bg-transparent px-2 text-xs outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => copy(created.link)} className="btn-ghost flex-1">
                {copied === created.link ? <Check size={15} /> : <Copy size={15} />} Copy Link
              </button>
              <button
                onClick={async () => {
                  await copy(created.link)
                  setCreated(null)
                }}
                className="btn-primary flex-1"
              >
                Copy &amp; Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Remove member confirm */}
      <Modal open={!!removing} onClose={() => setRemoving(null)} title="Remove member?">
        {removing && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to remove <span className="font-semibold">{removing.name}</span> from
              this calendar? They'll lose access immediately. This can't be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setRemoving(null)}>
                Cancel
              </button>
              <button
                className="btn bg-red-500 text-white hover:bg-red-600"
                onClick={() =>
                  removeMember.mutate(
                    { memberId: removing.user_id, calendarId: adminCal.id },
                    { onSuccess: () => setRemoving(null) }
                  )
                }
                disabled={removeMember.isPending}
              >
                Remove
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
