import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './auth/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import PageLoader from './components/PageLoader.jsx'

// Route-based lazy loading (code splitting).
const Login = lazy(() => import('./pages/Login.jsx'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const CreateTask = lazy(() => import('./pages/CreateTask.jsx'))
const ViewTasks = lazy(() => import('./pages/ViewTasks.jsx'))
const CalendarPage = lazy(() => import('./pages/CalendarPage.jsx'))
const InvitePage = lazy(() => import('./pages/InvitePage.jsx'))
const ActivityLogPage = lazy(() => import('./pages/ActivityLogPage.jsx'))
const Settings = lazy(() => import('./pages/Settings.jsx'))

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/invite/accept" element={<AcceptInvite />} />
          <Route
            element={
              <Protected>
                <Layout />
              </Protected>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<CreateTask />} />
            <Route path="/tasks" element={<ViewTasks />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/invite" element={<InvitePage />} />
            <Route path="/activity" element={<ActivityLogPage />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
