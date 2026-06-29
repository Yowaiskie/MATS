import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/features/authentication/AuthContext'

export const DashboardLayout: React.FC = () => {
  const { profile, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setLoggingOut(false)
    }
  }

  const navigation = [
    { name: 'Dashboard', href: '/' },
    { name: 'Members', href: '/members' },
    { name: 'Schedules', href: '/schedules' },
    { name: 'Attendance', href: '/attendance' },
    { name: 'Reports', href: '/reports' },
  ]

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Hamburger for Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="sm:hidden text-gray-400 hover:text-white focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>

            <Link to="/" className="flex items-center space-x-2 focus:outline-none">
              <div className="h-9 w-9 rounded bg-indigo-600 flex items-center justify-center font-bold text-white">
                M
              </div>
              <span className="font-bold text-lg tracking-wide text-white">MATS</span>
            </Link>
          </div>

          {/* Top Nav Right Actions */}
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400 hidden md:inline-block">
              User: <strong className="text-gray-200">{profile?.email || 'Admin'}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col sm:flex-row relative">
        {/* Sidebar for Desktop */}
        <aside className="hidden sm:block w-64 border-r border-gray-800 bg-gray-950 p-4 space-y-1.5">
          <div className="px-3 mb-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Navigation
          </div>
          <nav className="space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden fixed inset-0 z-30 flex">
            {/* Overlay */}
            <div 
              className="fixed inset-0 bg-black/60" 
              onClick={() => setMobileMenuOpen(false)}
            ></div>

            {/* Sidebar drawer */}
            <aside className="relative w-64 max-w-xs bg-gray-950 border-r border-gray-800 p-4 space-y-4 flex flex-col z-40">
              <div className="flex items-center justify-between pb-2 border-b border-gray-800">
                <span className="font-bold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block rounded px-3 py-2 text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Pane */}
        <main className="flex-1 bg-gray-900 p-6 sm:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {/* Outlet renders the matched nested route child */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
