import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid' },
  { path: '/calendar', label: 'Calendar', icon: 'calendar' },
  { path: '/notifications', label: 'Notifications', icon: 'bell' },
  { path: '/referrals', label: 'Referrals', icon: 'share' },
]

function NavIcon({ type }) {
  const icons = {
    grid: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />,
    calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    share: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />,
  }
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[type]}
    </svg>
  )
}

export default function DashboardLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar with hamburger */}
      <header className="lg:hidden sticky top-0 z-50 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
            <span className="text-white text-xs font-bold">CS</span>
          </div>
          <span className="font-medium text-gray-900 text-sm">ClaimSmart</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center justify-center w-10 h-10"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute top-0 left-0 h-full w-64 bg-white shadow-xl flex flex-col animate-[slideIn_0.2s_ease-out]">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2" onClick={() => setDrawerOpen(false)}>
                <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
                  <span className="text-white text-xs font-bold">CS</span>
                </div>
                <span className="font-medium text-gray-900 text-sm">ClaimSmart UK</span>
              </Link>
              <button onClick={() => setDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center" aria-label="Close menu">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {user && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-medium">
                      {(user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 truncate">{profile?.full_name || 'My Account'}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
              </div>
            )}

            <nav className="flex-1 p-3 space-y-1">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setDrawerOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${
                    location.pathname === item.path
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <NavIcon type={item.icon} />
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="p-3 border-t border-gray-200">
              <button
                onClick={() => { handleSignOut(); setDrawerOpen(false) }}
                className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-500 hover:bg-gray-100 w-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200 z-40">
        <div className="p-4 border-b border-gray-200">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">CS</span>
            </div>
            <span className="font-medium text-gray-900 text-sm">ClaimSmart UK</span>
          </Link>
        </div>

        {user && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-8 h-8 rounded-full" alt="" />
              ) : (
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-700 text-xs font-medium">
                  {(user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{profile?.full_name || 'My Account'}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                location.pathname === item.path
                  ? 'bg-teal-50 text-teal-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <NavIcon type={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 w-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-56">
        <main className="p-4 sm:p-6 lg:p-8 pb-8">{children}</main>
      </div>
    </div>
  )
}
