import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }) {
  const location = useLocation()
  const { isAuthenticated, isHydrating } = useAuth()

  if (isHydrating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#fff4dc,_#f5dfb8_38%,_#d8e8f0_100%)] px-6">
        <div className="rounded-3xl border border-white/60 bg-white/80 px-6 py-5 text-sm font-medium text-stone-700 shadow-lg backdrop-blur">
          세션 상태를 확인하고 있습니다...
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return children
}
