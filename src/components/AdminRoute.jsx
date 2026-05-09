import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || ''

  // Wait for auth to resolve before deciding
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0722' }}>
        <div
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // If logged in via Google and email matches admin — let them through directly
  if (user && user.email === adminEmail) {
    return children
  }

  // Otherwise check the manual admin login session
  const isAdmin = sessionStorage.getItem('adminAuth') === 'true'
  if (!isAdmin) return <Navigate to="/admin/login" replace />

  return children
}
