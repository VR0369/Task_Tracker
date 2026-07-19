import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Users, CheckCircle2, AlertTriangle, LogIn, ShieldAlert, Clock } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { useInvitePreview, useAcceptInvite } from '../api/hooks'

const STATUS_MSG = {
  awaiting_approval: 'This invitation was already accepted and is awaiting the admin’s approval.',
  approved: 'This invitation was already approved — you’re a member of the workspace.',
  rejected: 'This invitation was declined.',
  revoked: 'This invitation was revoked by the admin.',
  expired: 'This invitation has expired. Ask the admin to send a new one.',
}

function Shell({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="app-bg" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8"
      >
        {children}
      </motion.div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="max-w-[60%] truncate font-medium">{value}</span>
    </div>
  )
}

function Notice({ icon: Icon, title, text, inline }) {
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${inline ? '' : 'py-6'}`}>
      <Icon size={24} className="text-amber-500" />
      <div className="font-semibold">{title}</div>
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  )
}

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { data: inv, isLoading, isError } = useInvitePreview(token)
  const accept = useAcceptInvite()

  if (!token)
    return (
      <Shell>
        <Notice icon={AlertTriangle} title="Invalid link" text="This invitation link is missing its token." />
      </Shell>
    )
  if (loading || isLoading)
    return (
      <Shell>
        <div className="py-8 text-center text-sm text-slate-500">Loading invitation…</div>
      </Shell>
    )
  if (isError || !inv)
    return (
      <Shell>
        <Notice icon={AlertTriangle} title="Invitation not found" text="This invitation doesn’t exist or was removed." />
      </Shell>
    )

  const notPending = inv.status !== 'pending' || inv.expired
  const emailMismatch = user && user.email?.toLowerCase() !== inv.email?.toLowerCase()

  const onAccept = () => {
    accept.mutate(token, {
      onSuccess: () => {
        toast.success('Request sent — awaiting the admin’s approval')
        navigate('/', { replace: true })
      },
      onError: (e) => toast.error(e?.response?.data?.detail || 'Could not accept invitation'),
    })
  }

  return (
    <Shell>
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-grad-brand text-white">
          <Users size={22} />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold">You’re invited</h1>
          <p className="text-sm text-slate-500">to collaborate on Orbit</p>
        </div>
      </div>

      <div className="space-y-1.5 rounded-xl bg-white/50 p-4 text-sm dark:bg-white/5">
        <Row label="Workspace" value={inv.calendar_name} />
        <Row label="Invited by" value={inv.inviter_name} />
        <Row label="Invited email" value={inv.email} />
        <Row label="Role" value={<span className="capitalize">{inv.role}</span>} />
        {inv.expires_at && !inv.expired && (
          <Row
            label="Expires"
            value={new Date(inv.expires_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          />
        )}
      </div>

      <div className="mt-5">
        {notPending ? (
          <Notice
            inline
            icon={inv.expired ? Clock : CheckCircle2}
            title={inv.expired ? 'Invitation expired' : 'Already handled'}
            text={STATUS_MSG[inv.expired ? 'expired' : inv.status] || 'This invitation is no longer active.'}
          />
        ) : !user ? (
          <>
            <p className="mb-3 text-sm text-slate-500">
              Sign in with Google using <strong>{inv.email}</strong> to accept.
            </p>
            <button
              onClick={() => navigate(`/login?inviteToken=${encodeURIComponent(token)}`)}
              className="btn-primary w-full"
            >
              <LogIn size={16} /> Sign in to accept
            </button>
          </>
        ) : emailMismatch ? (
          <Notice
            inline
            icon={ShieldAlert}
            title="Wrong account"
            text={`This invite is for ${inv.email}, but you’re signed in as ${user.email}. Sign out and sign in with the invited account.`}
          />
        ) : (
          <button onClick={onAccept} disabled={accept.isPending} className="btn-primary w-full">
            {accept.isPending ? 'Joining…' : 'Accept invitation'}
          </button>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link to="/" className="text-xs text-brand-600 hover:underline">
          Back to app
        </Link>
      </div>
    </Shell>
  )
}
