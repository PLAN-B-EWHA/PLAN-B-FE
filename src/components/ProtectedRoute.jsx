import { Navigate, useLocation } from 'react-router-dom'
import { KO } from '../constants/messages.ko'
import { useAuth } from '../contexts/AuthContext'

function ProtectedRoute({ children, roles = [] }) {
  const { isBootstrapping, isAuthenticated, hasAnyRole } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <div className="p-8 text-sm text-slate-600">{KO.components.protectedRouteChecking}</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!hasAnyRole(roles)) {
    return <Navigate to="/403" replace state={{ from: location.pathname, requiredRoles: roles }} />
  }

  return children
}

export default ProtectedRoute
