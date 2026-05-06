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
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0722' }}>
      {showNav && (
        <nav
          className="sticky top-0 z-50"
          style={{ background: 'rgba(15,7,34,0.85)', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: '#d4960a' }}
              >
                <span className="text-xs font-extrabold" style={{ color: '#0f0722' }}>CS</span>
              </div>
              <span className="font-bold text-white text-sm">ClaimSmart UK</span>
            </Link>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    className="text-sm font-medium transition-colors"
                    style={{ color: 'rgba(255,255,255,0.6)' }}
                    onMouseEnter={e => e.target.style.color = '#d4960a'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.6)'}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                    onMouseEnter={e => e.target.style.color = 'rgba(255,255,255,0.7)'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.4)'}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: '#d4960a', color: '#0f0722' }}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1">{children}</main>

      <footer style={{ background: '#0f0722', borderTop: '1px solid rgba(255,255,255,0.07)' }} className="py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Results are estimates only, based on DWP rates April 2026/27. Always confirm with DWP or Citizens Advice.
            ClaimSmart UK is not a financial adviser.
          </p>
          <div className="flex justify-center flex-wrap gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <span>·</span>
            <a href="mailto:hello@claimsmart.uk" className="hover:text-white transition-colors">Contact</a>
            <span>·</span>
            <span>© 2026 ClaimSmart UK</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
