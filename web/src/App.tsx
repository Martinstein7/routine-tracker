import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { useAuth } from './lib/auth'
import { OwnerProvider } from './lib/owner'
import { CalendarPage } from './pages/Calendar'
import { HistoryPage } from './pages/History'
import { InvitePage } from './pages/Invite'
import { LoginPage } from './pages/Login'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import { TasksPage } from './pages/Tasks'
import { TodayPage } from './pages/Today'

export function App() {
  const { me, loading } = useAuth()

  if (loading) return null

  return (
    <Routes>
      <Route path="/convite/:token" element={me ? <Navigate to="/" replace /> : <InvitePage />} />
      {!me ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <Route
          element={
            <OwnerProvider>
              <Layout />
            </OwnerProvider>
          }
        >
          <Route index element={<TodayPage />} />
          <Route path="calendario" element={<CalendarPage />} />
          <Route path="tarefas" element={<TasksPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="relatorios" element={<ReportsPage />} />
          <Route path="configuracoes" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  )
}
