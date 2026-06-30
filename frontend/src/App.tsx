import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from './store/authStore'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import DataUpload from './pages/DataUpload'
import DatasetExplorer from './pages/DatasetExplorer'
import Predictions from './pages/Predictions'
import Forecasting from './pages/Forecasting'
import AIChat from './pages/AIChat'
import Reports from './pages/Reports'
import Charts from './pages/Charts'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import AdminDashboard from './pages/AdminDashboard'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { fetchMe, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (localStorage.getItem('access_token')) {
      fetchMe()
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="upload" element={<DataUpload />} />
          <Route path="datasets" element={<DatasetExplorer />} />
          <Route path="predictions" element={<Predictions />} />
          <Route path="forecasting" element={<Forecasting />} />
          <Route path="chat" element={<AIChat />} />
          <Route path="reports" element={<Reports />} />
          <Route path="charts" element={<Charts />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
