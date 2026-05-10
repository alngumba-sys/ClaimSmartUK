import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLogin() {
  const { user, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'alngumba@gmail.com'

  // If already logged in as admin via Google OAuth — skip login form
  if (!loading && user && adminEmail && user.email === adminEmail) {
    return <Navigate to="/admin" replace />
  }

  function handleLogin(e) {
    e.preventDefault()
    sessionStorage.setItem('adminAuth', 'true')
    sessionStorage.setItem('adminToken', password)
    navigate('/admin')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0722' }}>
        <div
          className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#d4960a', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 w-full max-w-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-teal-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">CS</span>
          </div>
          <span className="font-medium text-gray-900">ClaimSmart UK — Admin</span>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm"
              required
            />
          </div>
          {error && <p className="text-red-600 text-xs">{error}</p>}
          <button type="submit" className="w-full bg-teal-600 text-white font-medium py-3 rounded-xl hover:bg-teal-800 transition-colors">
            Sign in
          </button>
        </form>
      </div>
    </div>
  )
}
