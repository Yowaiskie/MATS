import React, { useState } from 'react'
import { useAuth } from '../AuthContext'

export const LoginPage: React.FC = () => {
  const { login, error, clearError } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!email || !password) {
      setLocalError('Please fill in all fields.')
      return
    }

    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      let msg = err.message || 'An error occurred during login.'
      if (err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please try again.'
      } else if (err.code === 'auth/user-not-found') {
        msg = 'No administrator account found with this email.'
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Incorrect password.'
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.'
      }
      setLocalError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4 py-12 text-white">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-gray-800 bg-gray-950 p-8 shadow-md">
        
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded bg-indigo-600 font-bold text-lg text-white">
            M
          </div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
            MATS
          </h2>
          <p className="mt-1 text-sm text-gray-400">
            Ministry Attendance Tracking System
          </p>
        </div>

        {/* Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-3">
            {/* Email Field */}
            <div>
              <label htmlFor="email-address" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Email Address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="admin@example.com"
                disabled={loading}
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-gray-400">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
          </div>

          {/* Feedback/Error Panel */}
          {(localError || error) && (
            <div className="rounded border border-red-900 bg-red-950/40 p-3 text-xs text-red-400">
              <div className="flex items-start">
                <svg className="h-4 w-4 mr-2 flex-shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{localError || error}</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
