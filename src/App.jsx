import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthPage } from './pages/AuthPage'
import { ChildPage } from './pages/ChildPage'
import { DashboardPage } from './pages/DashboardPage'
import { TherapistChildPage } from './pages/TherapistChildPage'
import { useAuth } from './contexts/AuthContext'

function RoleBasedChildPage() {
  const { jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []

  if (roles.includes('THERAPIST')) return <TherapistChildPage />
  return <ChildPage />
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route path="/app" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/analysis" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/offline" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/reports" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/users" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/rag" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/rag-sources" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/scenario-batch" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/scenario-review" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/admin/realtime-config" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/settings" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/alerts" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/app/children" element={<ProtectedRoute><RoleBasedChildPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
