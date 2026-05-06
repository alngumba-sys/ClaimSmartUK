import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  function handleLogin(e) {
    e.preventDefault()
    // Simple client-side check — real auth is on server via x-admin-token header
    sessionStorage.setItem('adminAuth', 'true')
    sessionStorage.setItem('adminToken', password)
    navigate('/admin')
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
