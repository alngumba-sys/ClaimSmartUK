import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children, showNav = true }) {
  const { user, signOut } = useAuth()
  const navigate          = useNavigate()
  const location          = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin = user?.email === (import.meta.env.VITE_ADMIN_EMAIL || 'alngumba@gmail.com')

  function handleSignOut() {
    setMenuOpen(false)
    localStorage.clear()
    sessionStorage.clear()
    signOut().catch(() => {})
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f0722' }}>

      {showNav && (
        <nav
          className="sticky top-0 z-50"
          style={{
            background: 'rgba(15,7,34,0.92)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0">
              <img
                src="/ClaimSmartUK_logo_clear.png"
                alt="ClaimSmart UK"
                className="w-7 h-7"
                style={{ display: 'block' }}
              />
              <span className="font-bold text-white text-sm">ClaimSmart UK</span>
            </Link>

            {/* Desktop links */}
            <div className="hidden sm:flex items-center gap-4">
              {user ? (
                <>
                  {isAdmin ? (
                    <Link
                      to="/admin"
                      className="text-xs font-bold px-2.5 py-1 rounded-lg hover:opacity-80 transition-opacity"
                      style={{
                        background: 'rgba(212,150,10,0.15)',
                        color: '#d4960a',
                        border: '1px solid rgba(212,150,10,0.3)',
                      }}
                    >
                      Admin
                    </Link>
                  ) : (
                    <Link
                      to="/dashboard"
                      className="text-sm font-medium text-white/60 hover:text-white/90 transition-colors"
                    >
                      Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  className="text-sm font-semibold px-4 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
                  style={{ background: '#d4960a', color: '#0f0722' }}
                >
                  Sign in
                </Link>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="sm:hidden flex items-center justify-center w-10 h-10 text-white"
              aria-label="Toggle menu"
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div
              className="sm:hidden px-4 pb-4 space-y-1"
              style={{
                background: 'rgba(15,7,34,0.97)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {user ? (
                <>
                  {isAdmin ? (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="block py-3 text-sm font-bold border-b border-white/5"
                      style={{ color: '#d4960a' }}
                    >
                      Admin
                    </Link>
                  ) : (
                    <Link
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                      className="block py-3 text-sm text-white/70 hover:text-white border-b border-white/5"
                    >
                      Dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="block w-full text-left py-3 text-sm text-white/40 hover:text-white/70 cursor-pointer"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setMenuOpen(false)}
                  className="block text-center py-3 mt-2 rounded-xl text-sm font-semibold"
                  style={{ background: '#d4960a', color: '#0f0722' }}
                >
                  Sign in
                </Link>
              )}
            </div>
          )}
        </nav>
      )}

      <main className="flex-1">{children}</main>

      <footer
        className="py-8"
        style={{ background: '#0f0722', borderTop: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="max-w-5xl mx-auto px-4 text-center">
          <div className="flex justify-center flex-wrap gap-3 sm:gap-4 text-xs text-white/30">
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
