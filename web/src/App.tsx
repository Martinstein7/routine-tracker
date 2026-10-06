import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { InvitePage } from './pages/Invite'
import { LoginPage } from './pages/Login'

export function App() {
  const { me, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/convite/:token" element={me ? <Navigate to="/" replace /> : <InvitePage />} />
      {!me ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <Route path="*" element={<main className="p-8 text-sm text-muted">Olá, {me.name}.</main>} />
      )}
    </Routes>
  )
}
