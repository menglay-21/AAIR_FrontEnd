import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardPage from './pages/DashboardPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ResultAnalysisPage from './pages/ResultAnalysisPage'
import WorkspaceDataPage from './pages/WorkspaceDataPage'

const roleRoutes = [
  ['/admin', 'ADMIN'],
  ['/manager', 'MANAGER'],
  ['/user/terminology', 'TERMINOLOGY'],
  ['/user/result-analysis', 'RESULT_ANALYST'],
  ['/user/ai-labeling', 'AI_LABELER'],
  ['/user/manual-labeling', 'MANUAL_LABELER'],
  ['/user/manual-review', 'REVIEWER'],
]

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      {roleRoutes.map(([path, role]) => (
        <Route
          element={(
            <ProtectedRoute allowedRoles={[role]}>
              <DashboardPage />
            </ProtectedRoute>
          )}
          key={path}
          path={path}
        />
      ))}
      {roleRoutes.map(([path, role]) => (
        <Route element={<ProtectedRoute allowedRoles={[role]}><WorkspaceDataPage /></ProtectedRoute>} key={`${path}-data`} path={`${path}/data`} />
      ))}
      <Route
        element={<ProtectedRoute allowedRoles={['RESULT_ANALYST']}><ResultAnalysisPage /></ProtectedRoute>}
        path="/user/result-analysis/analysis"
      />
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
