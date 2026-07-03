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
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <img
            src="/ministy_logo.jpg"
            alt="MATS Logo"
            className="mx-auto h-20 w-20 rounded-2xl border border-gray-200 object-cover shadow-md"
          />
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-gray-900">
            MATS
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Ministry Attendance Tracking System
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Sign in to your account</h2>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit} noValidate>
            <div className="space-y-3">
              {/* Email Field */}
              <div>
                <label htmlFor="email-address" className="block text-xs font-semibold text-gray-600 mb-1.5">
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
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="admin@example.com"
                  disabled={loading}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-600 mb-1.5">
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
                  className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="••••••••"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Feedback/Error Panel */}
            {(localError || error) && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          For authorized administrators only.
        </p>
      </div>
    </div>
  )
}
