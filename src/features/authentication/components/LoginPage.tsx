import { FormInput } from '@/components/FormInput'
import { ValidatedForm } from '@/components/ValidatedForm'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Listen to AuthContext errors
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

    if (!email.trim() || !password) {
      setLocalError('Please enter both username/email and password.')
      setShowErrorModal(true)
      return
    }

    setLoading(true)
    try {
      await login(email.trim(), password)

      // Strict Maintenance Mode Check during login
      if (isMaintenanceActive) {
        const clean = email.toLowerCase().trim()
        const normalizedEmail = clean.includes('@') ? clean : `${clean}@mas.com`
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
    <div className="relative min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden font-sans">
      {/* Sacred Ambient Mesh Glow Halos */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[550px] h-[350px] sm:h-[550px] bg-gradient-to-tr from-indigo-600/25 via-blue-500/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />

      {/* Floating Glassmorphic Container Card */}
      <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl p-6 sm:p-9 space-y-6 ring-1 ring-slate-900/5">
        {/* Brand Halo Header */}
        <div className="text-center space-y-3">
          <div className="relative inline-block">
            <div className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-lg" />
            <img
              src="/favicon/favicon.png"
              alt="MATS Logo"
              className="relative w-16 h-16 rounded-2xl border border-indigo-100 shadow-md mx-auto object-cover"
            />
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-700">
                Official Ministry System
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">MATS Officer Portal</h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">Ministry Attendance Tracking System</p>
          </div>
        </div>

        {/* Maintenance Notice */}
        {isMaintenanceActive && (
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-900">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
              </span>
              <span>System Maintenance Active</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {maintenanceSettings.message || 'Only authorized accounts may sign in at this time.'}
            </p>
            {maintenanceSettings.expectedEndAt && (
              <p className="text-[10px] font-bold text-amber-900 pt-0.5">
                Expected End: {maintenanceSettings.expectedEndAt}
              </p>
            )}
          </div>
        )}

        {/* Form */}
        <ValidatedForm onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email / Username Address */}
          <div className="space-y-1.5">
            <label htmlFor="email-address" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
              Officer Username or Email
            </label>
            <div className="relative">
              <FormInput
                id="email-address"
                name="email"
                type="text"
                autoComplete="username email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordinator or officer@mas.com"
                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition"
                disabled={loading}
              />
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <FormInput
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition"
                disabled={loading}
              />
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Inline Error Notice */}
          {displayError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{displayError}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In to MATS</span>
            )}
          </button>
        </ValidatedForm>

        {/* Bottom Shortcuts Drawer for Altar Server Excuses */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-indigo-950 block">Altar Server Excuse</span>
            <span className="text-[10px] text-indigo-700">Self-Service Portal</span>
          </div>
          <Link
            to="/public/excuse"
            className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-extrabold shadow-2xs hover:bg-indigo-50 text-[11px] transition"
          >
            Open Portal
          </Link>
        </div>
      </div>

      {/* Footer System Caption */}
      <div className="relative z-10 text-center mt-6 text-slate-500 text-xs font-medium">
        <span>Sacred Heart of Jesus Parish - MBS  · Ministry of Altar Servers</span>
      </div>

      {/* Invalid Credentials & Officer Support Popup Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setShowErrorModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-900">Sign In Assistance</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900">
                <p className="text-xs font-bold">
                  {localError || 'Invalid email or password.'}
                </p>
                <p className="text-[11px] text-rose-700 mt-1">
                  The credentials entered could not be verified. Please verify your email and password.
                </p>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-950 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Officer Account Support</span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  If you are an officer needing password reset or account recovery, please reach out to your <strong>Coordinator</strong>.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowErrorModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Understood
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password / Officer Support Help Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setShowSupportModal(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl z-10 flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h2 className="text-sm font-bold text-slate-900">Account Recovery</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-full hover:bg-slate-100 cursor-pointer"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4 text-left">
              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-indigo-900">
                  <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Officer Password Reset</span>
                </div>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  For security and ministry governance, passwords for Officer and Administrator accounts are managed centrally.
                </p>
                <p className="text-xs text-indigo-800 leading-relaxed">
                  Please contact the <strong>Coordinator</strong> or parish administrator to have your password reset or your linked profile updated.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(false)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

