import { ParentDashboardPage } from './ParentDashboardPage'
import { PendingApprovalPage } from './PendingApprovalPage'
import { TherapistDashboardPage } from './TherapistDashboardPage'
import { useAuth } from '../contexts/AuthContext'

export function DashboardPage() {
  const { jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []
  const status = user?.status || jwtPayload?.status || jwtPayload?.memberStatus || null

  if (roles.includes('PENDING') || status === 'PENDING') {
    return <PendingApprovalPage />
  }

  if (roles.includes('THERAPIST')) {
    return <TherapistDashboardPage />
  }

  return <ParentDashboardPage />
}
