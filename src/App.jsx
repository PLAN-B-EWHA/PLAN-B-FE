import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthPage } from './pages/AuthPage'
import { ChildPage } from './pages/ChildPage'
import { DashboardPage } from './pages/DashboardPage'
import { ParentMemoPage } from './pages/ParentMemoPage'
import { TherapistChildPage } from './pages/TherapistChildPage'
import { TherapistMemoPage } from './pages/TherapistMemoPage'
import { useAuth } from './contexts/AuthContext'

function RoleBasedChildPage() {
  const { jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []

  if (roles.includes('THERAPIST')) {
    return <TherapistChildPage />
  }

  return <ChildPage />
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AuthPage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/app/children"
              element={
                <ProtectedRoute>
                  <RoleBasedChildPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/parent/memo"
              element={
                <ProtectedRoute>
                  <ParentMemoPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/therapist/patients/:childId/memo"
              element={
                <ProtectedRoute>
                  <TherapistMemoPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
