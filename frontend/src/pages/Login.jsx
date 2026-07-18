import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Sparkles, ArrowRight } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { api } from '../api/client'

export default function Login() {
  const { user, devLogin, googleLogin } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [cfg, setCfg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    api.get('/auth/config').then((r) => setCfg(r.data)).catch(() => {})
  }, [])

  // Real Google Sign-In (Google Identity Services) — active once the backend
  // reports a configured Client ID (MOCK_AUTH=false + GOOGLE_CLIENT_ID set).
  useEffect(() => {
    const clientId = cfg?.google_client_id
    if (!clientId || cfg?.mock_auth) return
    const onLoad = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          setBusy(true)
          try {
            await googleLogin(resp.credential)
            navigate('/', { replace: true })
          } catch {
            toast.error('Google login failed')
          } finally {
            setBusy(false)
          }
        },
      })
      const el = document.getElementById('google-btn')
      if (el) {
        el.innerHTML = ''
        window.google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        })
      }
    }
    if (document.getElementById('gsi-script')) {
      onLoad()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.id = 'gsi-script'
    s.onload = onLoad
    document.body.appendChild(s)
  }, [cfg, googleLogin, navigate])

  const handleDemo = async () => {
    setBusy(true)
    try {
      await googleLogin('mock:demo@example.com:Demo User')
      navigate('/', { replace: true })
    } catch {
      toast.error('Login failed')
    } finally {
      setBusy(false)
    }
  }

  const handleEmail = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true)
    try {
      await devLogin(email.trim())
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="app-bg" aria-hidden="true" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-grad-brand text-white shadow-lg shadow-brand-500/30">
            <motion.span
              className="block h-5 w-5 rounded-full border-2 border-white"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
            />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Orbit</h1>
            <p className="text-sm text-slate-500">Your tasks, in perfect orbit.</p>
          </div>
        </div>

        {cfg?.google_client_id && !cfg?.mock_auth ? (
          <div id="google-btn" className="flex justify-center" />
        ) : (
          <button
            onClick={handleDemo}
            disabled={busy}
            className="btn w-full gap-3 border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
          >
            <GoogleIcon />
            Continue with Google
          </button>
        )}

        {cfg?.mock_auth && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              or use a dev login
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <form onSubmit={handleEmail} className="space-y-3">
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" disabled={busy} className="btn-primary w-full">
                Sign in <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-4 rounded-xl bg-brand-500/10 p-3 text-xs text-brand-700 dark:text-brand-300">
              <Sparkles size={14} className="mb-1 inline" /> Tip: sign in as{' '}
              <button className="font-semibold underline" onClick={handleDemo}>
                demo@example.com
              </button>{' '}
              to explore pre-seeded tasks.
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
