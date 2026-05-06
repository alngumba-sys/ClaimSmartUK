import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children, showNav = true }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {showNav && (
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">CS</span>
              </div>
              <span className="font-medium text-gray-900 text-sm">ClaimSmart UK</span>
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link to="/dashboard" className="text-sm text-gray-600 hover:text-teal-600">Dashboard</Link>
                  <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">Sign out</button>
                </>
              ) : (
                <Link to="/auth" className="text-sm border border-teal-600 text-teal-600 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}
      <main className="flex-1">{children}</main>
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 mb-2">
            Results are estimates only, based on DWP rates April 2026/27. Always confirm with DWP or Citizens Advice.
            ClaimSmart UK is not a financial adviser.
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <Link to="/privacy" className="hover:text-gray-600">Privacy</Link>
            <span>·</span>
            <a href="mailto:hello@claimsmart.uk" className="hover:text-gray-600">Contact</a>
            <span>·</span>
            <span>© 2026 ClaimSmart UK</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
