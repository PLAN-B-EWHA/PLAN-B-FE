import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import LandingPage from './pages/LandingPage'
import ForbiddenPage from './pages/ForbiddenPage'
import AdminPage from './pages/AdminPage'
import ParentHomePage from './pages/ParentHomePage'
import TherapistHomePage from './pages/TherapistHomePage'
import HomeRouterPage from './pages/HomeRouterPage'
import PendingHomePage from './pages/PendingHomePage'
import NotificationsPage from './pages/NotificationsPage'
import ReportsPage from './pages/ReportsPage'
import ParentMissionDetailPage from './pages/ParentMissionDetailPage'
import TherapistMissionReviewPage from './pages/TherapistMissionReviewPage'
import NotesPage from './pages/NotesPage'
import TemplateManagementPage from './pages/TemplateManagementPage'
import MissionCalendarPage from './pages/MissionCalendarPage'
import TherapistReviewQueuePage from './pages/TherapistReviewQueuePage'
import UnityMissionFlowTestPage from './pages/UnityMissionFlowTestPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/403" element={<ForbiddenPage />} />
      <Route path="/unity-mission-flow-test" element={<UnityMissionFlowTestPage />} />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomeRouterPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parent"
        element={
          <ProtectedRoute roles={['PARENT']}>
            <ParentHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/parent/missions/:missionId"
        element={
          <ProtectedRoute roles={['PARENT']}>
            <ParentMissionDetailPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/therapist"
        element={
          <ProtectedRoute roles={['THERAPIST', 'TEACHER']}>
            <TherapistHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/therapist/missions/:missionId/review"
        element={
          <ProtectedRoute roles={['THERAPIST', 'TEACHER']}>
            <TherapistMissionReviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/therapist/review-queue"
        element={
          <ProtectedRoute roles={['THERAPIST', 'TEACHER']}>
            <TherapistReviewQueuePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pending"
        element={
          <ProtectedRoute>
            <PendingHomePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute roles={['PARENT', 'THERAPIST']}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute roles={['PARENT', 'THERAPIST']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports/me"
        element={
          <ProtectedRoute roles={['PARENT', 'THERAPIST']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/notes"
        element={
          <ProtectedRoute roles={['PARENT', 'THERAPIST']}>
            <NotesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/therapist/templates"
        element={
          <ProtectedRoute roles={['THERAPIST']}>
            <TemplateManagementPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/missions/calendar"
        element={
          <ProtectedRoute roles={['PARENT', 'THERAPIST', 'TEACHER']}>
            <MissionCalendarPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

