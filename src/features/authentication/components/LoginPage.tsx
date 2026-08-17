import React, { useState, useEffect } from 'react'
import { useAuth } from '../AuthContext'
import { useMaintenance } from '@/context/MaintenanceContext'

export const LoginPage: React.FC = () => {
  const { login, logout, error, clearError } = useAuth()
  const { isMaintenanceActive, isUserAllowed, maintenanceSettings } = useMaintenance()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showErrorModal, setShowErrorModal] = useState(false)

  const [showPassword, setShowPassword] = useState(false)

  // Listen to AuthContext errors as well
  useEffect(() => {
    if (error) {
      const msg = error.includes('auth/') ? 'Invalid email or password.' : error
      setLocalError(msg)
      setShowErrorModal(true)
    }
  }, [error])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    clearError()

    if (!email || !password) {
      setLocalError('Please enter both email and password.')
      setShowErrorModal(true)
      return
    }

    setLoading(true)
    try {
      await login(email, password)

      // Strict Maintenance Mode Check during login
      if (isMaintenanceActive) {
        const normalizedEmail = email.toLowerCase().trim()
        const isAllowed = isUserAllowed(null, normalizedEmail, null)
        if (!isAllowed) {
          await logout()
          setLocalError('MATS is currently under maintenance. Only the Coordinator and authorized users can log in at this time.')
          setShowErrorModal(true)
          return
        }
      }
    } catch (err: any) {
      const code = err?.code || ''
      const message = err?.message || ''

      if (
        code === 'auth/invalid-email' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/user-not-found' ||
        code === 'auth/wrong-password' ||
        message.includes('auth/invalid-email') ||
        message.includes('auth/invalid-credential') ||
        message.includes('auth/user-not-found') ||
        message.includes('auth/wrong-password')
      ) {
        setLocalError('Invalid email or password.')
      } else if (code === 'auth/user-disabled' || message.includes('auth/user-disabled')) {
        setLocalError('This account has been deactivated. Please contact your coordinator.')
      } else if (code === 'auth/too-many-requests' || message.includes('auth/too-many-requests')) {
        setLocalError('Too many unsuccessful attempts. Please try again later or contact your coordinator.')
      } else if (message.includes('under maintenance')) {
        setLocalError(message)
      } else {
        setLocalError('Invalid email or password.')
      }
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }

  const displayError = localError

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12">
      <div className="w-full max-w-md space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <img
            src="/favicon/favicon.png"
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

        {/* Maintenance Mode Banner */}
        {isMaintenanceActive && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xs text-amber-900 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span>System Maintenance Active</span>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              {maintenanceSettings.message || 'MATS is currently under maintenance. Only authorized users can sign in.'}
            </p>
            {maintenanceSettings.expectedEndAt && (
              <p className="text-[11px] font-semibold text-amber-800 pt-1">
                Expected End: {maintenanceSettings.expectedEndAt}
              </p>
            )}
          </div>
        )}

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
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-3 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    disabled={loading}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      /* Eye Off Icon */
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      /* Eye Icon */
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Feedback/Error Panel */}
            {displayError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <div className="flex items-start gap-2">
                  <svg className="h-4 w-4 flex-shrink-0 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="space-y-1">
                    <p className="font-semibold">{displayError}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-sm mt-2 cursor-pointer"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400">
          For authorized administrators only.
        </p>
      </div>

      {/* Invalid Credentials & Officer Support Popup Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowErrorModal(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl z-10 flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-gray-900">Invalid Email or Password</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-full hover:bg-gray-100 cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-left">
              {/* Error Notice */}
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900">
                <p className="text-sm font-semibold">
                  {localError || 'Invalid email or password.'}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  The email address or password you entered is incorrect. Please check your credentials and try again.
                </p>
              </div>

              {/* Officer Assistance Notice */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-blue-900">
                  <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Officer Account Assistance</span>
                </div>
                <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
                  If you are an officer and forgot your password or account details, please contact the <strong>Coordinator</strong> to assist you with recovering or resetting your account.
                </p>
              </div>

              {/* Close / Action button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowErrorModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Okay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
