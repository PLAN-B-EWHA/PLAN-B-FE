import { useLocation } from 'react-router-dom'
import { AdminRagDebugPage } from './AdminRagDebugPage'
import { AdminRagSourcePage } from './AdminRagSourcePage'
import { AdminRealtimeConfigPage } from './AdminRealtimeConfigPage'
import { AdminScenarioBatchPage } from './AdminScenarioBatchPage'
import { AdminScenarioReviewPage } from './AdminScenarioReviewPage'
import { AdminUserManagementPage } from './AdminUserManagementPage'
import { ParentDashboardPage } from './ParentDashboardPage'
import { ParentHomePage } from './ParentHomePage'
import { ParentOfflinePage } from './ParentOfflinePage'
import { PendingApprovalPage } from './PendingApprovalPage'
import { NotificationInboxPage } from './NotificationInboxPage'
import { NotificationSettingsPage } from './NotificationSettingsPage'
import { TherapistDashboardPage } from './TherapistDashboardPage'
import { TherapistHomePage } from './TherapistHomePage'
import { TherapistOfflinePage } from './TherapistOfflinePage'
import { TherapistReportPage } from './TherapistReportPage'
import { ParentReportPage } from './ParentReportPage'
import { useAuth } from '../contexts/AuthContext'

export function DashboardPage() {
  const location = useLocation()
  const { jwtPayload, user } = useAuth()
  const roles = user?.roles || jwtPayload?.roles || []
  const status = user?.status || jwtPayload?.status || jwtPayload?.memberStatus || null
  const isAnalysisPage = location.pathname.startsWith('/app/analysis')
  const isOfflinePage = location.pathname.startsWith('/app/offline')
  const isReportsPage = location.pathname.startsWith('/app/reports')
  const isAlertsPage = location.pathname.startsWith('/app/alerts')
  const isSettingsPage = location.pathname.startsWith('/app/settings')
  const isAdminRagSourcePage = location.pathname.startsWith('/app/admin/rag-sources')
  const isAdminScenarioBatchPage = location.pathname.startsWith('/app/admin/scenario-batch')
  const isAdminScenarioReviewPage = location.pathname.startsWith('/app/admin/scenario-review')
  const isAdminRealtimeConfigPage = location.pathname.startsWith('/app/admin/realtime-config')
  const isAdminRagPage = location.pathname.startsWith('/app/admin/rag')
  const isAdminUsersPage = location.pathname.startsWith('/app/admin/users')

  if (roles.includes('ADMIN')) {
    if (isAdminScenarioBatchPage) return <AdminScenarioBatchPage />
    if (isAdminScenarioReviewPage) return <AdminScenarioReviewPage />
    if (isAdminRealtimeConfigPage) return <AdminRealtimeConfigPage />
    if (isAdminRagSourcePage) return <AdminRagSourcePage />
    if (isAdminRagPage) return <AdminRagDebugPage />
    if (isAdminUsersPage || location.pathname === '/app') return <AdminUserManagementPage />
    return <AdminUserManagementPage />
  }

  if (roles.includes('PENDING') || status === 'PENDING') return <PendingApprovalPage />

  if (roles.includes('THERAPIST')) {
    if (isAlertsPage) return <NotificationInboxPage />
    if (isSettingsPage) return <NotificationSettingsPage />
    if (isOfflinePage) return <TherapistOfflinePage />
    if (isReportsPage) return <TherapistReportPage />
    return isAnalysisPage ? <TherapistDashboardPage /> : <TherapistHomePage />
  }

  if (isAlertsPage) return <NotificationInboxPage />
  if (isSettingsPage) return <NotificationSettingsPage />
  if (isOfflinePage) return <ParentOfflinePage />
  if (isReportsPage) return <ParentReportPage />

  return isAnalysisPage ? <ParentDashboardPage /> : <ParentHomePage />
}
