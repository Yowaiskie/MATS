import React, { useState } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { useMaintenance } from '@/context/MaintenanceContext'

interface MaintenanceScreenProps {
  isPublicRoute?: boolean
}

export const MaintenanceScreen: React.FC<MaintenanceScreenProps> = ({ isPublicRoute = false }) => {
  const { user, profile, login, logout } = useAuth()
  const { maintenanceSettings } = useMaintenance()

  const [showLoginForm, setShowLoginForm] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)

  const formatExpectedEnd = (dateStr?: string) => {
    if (!dateStr) return null
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
      }).format(d)
    } catch {
      return dateStr
    }
  }

  const formattedEndTime = formatExpectedEnd(maintenanceSettings.expectedEndAt)

  const [showErrorModal, setShowErrorModal] = useState(false)

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError(null)

    if (!email || !password) {
      setLoginError('Please enter both email and password.')
      setShowErrorModal(true)
      return
    }

    setLoggingIn(true)
    try {
      await login(email, password)
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
        setLoginError('Invalid email or password.')
      } else if (code === 'auth/user-disabled' || message.includes('auth/user-disabled')) {
        setLoginError('This account has been deactivated. Please contact your coordinator.')
      } else if (code === 'auth/too-many-requests' || message.includes('auth/too-many-requests')) {
        setLoginError('Too many unsuccessful attempts. Please try again later.')
      } else if (message.includes('under maintenance')) {
        setLoginError(message)
      } else {
        setLoginError('Invalid email or password.')
      }
      setShowErrorModal(true)
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 font-sans relative overflow-hidden">
      {/* Background glow accents */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 sm:p-10 border border-slate-200/80 text-center relative z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Logo Header */}
        <div className="w-20 h-20 rounded-3xl overflow-hidden border-2 border-amber-100 shadow-md flex items-center justify-center bg-white mx-auto mb-6 p-1">
          <img 
            src="/favicon/favicon.png" 
            alt="MATS Logo" 
            className="w-full h-full object-cover rounded-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/ministy_logo.jpg'
            }}
          />
        </div>

        {/* Status Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-4 border shadow-xs bg-amber-50 text-amber-800 border-amber-200">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {isPublicRoute ? 'Public Portal Under Maintenance' : 'System Maintenance Active'}
        </div>

        {!showLoginForm ? (
          /* ========================================================
             VIEW 1: Maintenance Notice (Default)
             ======================================================== */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              MATS Under Maintenance
            </h2>

            {/* Logged in User indicator */}
            {user && (
              <p className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 inline-block">
                Signed in as <strong className="text-slate-800">{profile?.displayName || user.email}</strong> ({profile?.role || 'user'})
              </p>
            )}

            {/* Description / Coordinator Notice Box */}
            <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl text-left space-y-2">
              <div className="text-xs font-black text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Coordinator Notice
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                {maintenanceSettings.message || 'MATS is currently under maintenance for database optimization and routine system updates. Please try again later.'}
              </p>
            </div>

            {/* Expected Availability Card */}
            {formattedEndTime && (
              <div className="bg-amber-50/70 border border-amber-200/80 p-4 rounded-2xl text-left flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                    Expected Availability
                  </div>
                  <div className="text-sm font-bold text-amber-950 mt-0.5">
                    {formattedEndTime}
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 text-amber-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full space-y-3 pt-2">
              {user ? (
                <button
                  onClick={() => logout()}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out / Switch Account</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setLoginError(null)
                    setShowLoginForm(true)
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Continue to Admin Login</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* ========================================================
             VIEW 2: Admin Login Form (On Demand)
             ======================================================== */
          <div className="space-y-6 animate-in fade-in zoom-in-95 duration-150 text-left">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight text-center">
                Admin / Staff Login
              </h2>
              <p className="text-xs text-slate-500 text-center mt-1">
                Enter your authorized credentials to access MATS.
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5">
                <svg className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1 leading-relaxed">{loginError}</div>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. coordinator@mas.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-slate-50/50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="submit"
                  disabled={loggingIn}
                  className="w-full py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loggingIn ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Verifying Access...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLoginForm(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-slate-500 hover:text-slate-800 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Maintenance Notice</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Footer Note */}
        <p className="text-[11px] font-medium text-slate-400 mt-6">
          Ministry of Altar Servers (MATS)
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
                  {loginError || 'Invalid email or password.'}
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
