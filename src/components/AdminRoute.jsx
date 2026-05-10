import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'alngumba@gmail.com'

  // Safety timeout — if loading takes more than 3s, stop waiting
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 3000)
    return () => clearTimeout(t)
  }, [])

  if (loading && !timedOut) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0722' }}>
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Admin via Google OAuth — set token for API calls
  if (user && user.email === adminEmail) {
    if (!sessionStorage.getItem('adminToken')) {
      sessionStorage.setItem('adminAuth', 'true')
      sessionStorage.setItem('adminToken', import.meta.env.VITE_ADMIN_PASSWORD || '')
    }
    return children
  }

  // Manual admin login session
  const isAdmin = sessionStorage.getItem('adminAuth') === 'true'
  if (isAdmin) return children

  return <Navigate to="/admin/login" replace />
}
