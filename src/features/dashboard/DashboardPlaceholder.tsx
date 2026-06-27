import React, { useState } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'

export const DashboardPlaceholder: React.FC = () => {
  const { profile, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch (err) {
      console.error('Logout failed:', err)
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-gray-800 bg-gray-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white">
              M
            </div>
            <span className="font-bold text-lg tracking-wide text-white">MATS</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-400 hidden sm:inline-block">
              Logged in as: <strong className="text-gray-200">{profile?.email || 'Admin'}</strong>
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg bg-gray-800 hover:bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
            >
              {loggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-8 backdrop-blur-md max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
            Welcome to MATS
          </h1>
          <p className="text-gray-400 mb-6 leading-relaxed">
            You are successfully authenticated as an Administrator. This dashboard shell is protected and ready for Phase 2 implementation.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800/60">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Role</span>
              <span className="text-lg font-bold text-gray-200 capitalize">{profile?.role || 'admin'}</span>
            </div>
            <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800/60">
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">Status</span>
              <span className="text-lg font-bold text-green-400">Authenticated</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
