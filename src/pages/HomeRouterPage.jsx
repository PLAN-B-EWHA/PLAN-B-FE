import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function HomeRouterPage() {
  const { user } = useAuth()
  const roles = (user?.roles || []).map((role) => String(role).toUpperCase())

  if (roles.includes('ADMIN')) {
    return <Navigate to="/admin" replace />
  }

  if (roles.includes('PARENT')) {
    return <Navigate to="/parent" replace />
  }

  if (roles.includes('THERAPIST') || roles.includes('TEACHER')) {
    return <Navigate to="/therapist" replace />
  }

  return <Navigate to="/pending" replace />
}

export default HomeRouterPage
