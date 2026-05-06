import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import QuestionFlow from './pages/QuestionFlow'
import ResultsPreview from './pages/ResultsPreview'
import SuccessPage from './pages/SuccessPage'
import Dashboard from './pages/Dashboard'
import CalendarPage from './pages/CalendarPage'
import NotificationsPage from './pages/NotificationsPage'
import ReferralPage from './pages/ReferralPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminLogin from './pages/AdminLogin'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'

function ReferralCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    if (ref) sessionStorage.setItem('referralCode', ref)
  }, [])
  return null
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ReferralCapture />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/check" element={<QuestionFlow />} />
          <Route path="/results" element={<ResultsPreview />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/referrals" element={<ProtectedRoute><ReferralPage /></ProtectedRoute>} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
