import React, { useState } from 'react'
import { Link } from 'react-router-dom'

type ProposalTab = 'proposal_a' | 'proposal_b' | 'proposal_c' | 'proposal_d'
type DeviceMode = 'desktop' | 'mobile' | 'tablet'

export const LoginPageShowcasePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ProposalTab>('proposal_a')
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop')
  const [email, setEmail] = useState('officer@mas.com')
  const [password, setPassword] = useState('password123')
  const [showPassword, setShowPassword] = useState(false)
  const [isMaintenanceActive, setIsMaintenanceActive] = useState(false)
  const [simulatedError, setSimulatedError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSimulateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSimulatedError(null)

    setTimeout(() => {
      setIsLoading(false)
      if (!password || password.length < 6) {
        setSimulatedError('Invalid email or password. Please verify your credentials.')
      } else {
        alert('Simulation: Sign-in credentials verified successfully!')
      }
    }, 600)
  }

  // Device container styling
  const getDeviceContainerClass = () => {
    if (deviceMode === 'mobile') {
      return 'max-w-[390px] min-h-[780px] my-6 mx-auto rounded-[40px] shadow-2xl border-[10px] border-slate-800 overflow-hidden ring-1 ring-slate-700/50'
    }
    if (deviceMode === 'tablet') {
      return 'max-w-[768px] min-h-[900px] my-6 mx-auto rounded-[32px] shadow-2xl border-[8px] border-slate-800 overflow-hidden ring-1 ring-slate-700/50'
    }
    return 'w-full min-h-screen'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* TOP DOCKED SHOWCASE CONTROL BAR */}
      <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 py-3 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand & Title */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                MATS Login Page Design Lab
              </span>
            </div>
            <Link
              to="/login"
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              Current Active Login
            </Link>
          </div>

          {/* Proposal Selectors */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('proposal_a')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === 'proposal_a'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Proposal A: Split Hero
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('proposal_b')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === 'proposal_b'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Proposal B: Glassmorphic
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('proposal_c')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === 'proposal_c'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Proposal C: Launchpad
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('proposal_d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                activeTab === 'proposal_d'
                  ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Proposal D: Minimalist
            </button>
          </div>

          {/* Device & Interactive Test Toggles */}
          <div className="flex items-center gap-2">
            {/* Device Viewport Selector */}
            <div className="flex items-center p-0.5 bg-slate-800 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setDeviceMode('desktop')}
                title="Desktop View"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  deviceMode === 'desktop' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode('tablet')}
                title="Tablet Frame (768px)"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  deviceMode === 'tablet' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setDeviceMode('mobile')}
                title="Mobile Frame (390px)"
                className={`p-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  deviceMode === 'mobile' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
              </button>
            </div>

            {/* Test Toggle: Maintenance Mode */}
            <button
              type="button"
              onClick={() => setIsMaintenanceActive(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                isMaintenanceActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {isMaintenanceActive ? 'Maintenance ON' : 'Test Maint. Mode'}
            </button>

            {/* Test Toggle: Simulate Error */}
            <button
              type="button"
              onClick={() => setSimulatedError(prev => prev ? null : 'Invalid email or password.')}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                simulatedError
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {simulatedError ? 'Clear Error' : 'Test Error'}
            </button>
          </div>
        </div>
      </header>

      {/* SHOWCASE WRAPPER */}
      <main className="flex items-center justify-center p-0 md:p-6 bg-slate-900/60 min-h-[calc(100vh-65px)]">
        <div className={getDeviceContainerClass()}>
          {/* ========================================================================= */}
          {/* PROPOSAL A: THE LITURGICAL SPLIT HERO */}
          {/* ========================================================================= */}
          {activeTab === 'proposal_a' && (
            <div className="w-full min-h-full bg-slate-950 text-slate-900 flex flex-col md:grid md:grid-cols-12 font-sans">
              {/* LEFT SIDE: Brand & Heritage Hero */}
              <div className="md:col-span-6 lg:col-span-7 bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-950 text-white p-8 md:p-12 lg:p-16 flex flex-col justify-between relative overflow-hidden">
                {/* Ambient Decorative Orbs */}
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600/15 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none" />

                {/* Top Badge & Liturgical Tag */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src="/favicon/favicon.png"
                      alt="MATS Logo"
                      className="w-12 h-12 rounded-2xl border-2 border-indigo-400/40 shadow-lg object-cover ring-4 ring-indigo-500/20"
                    />
                    <div>
                      <span className="text-xs font-black tracking-widest text-indigo-300 uppercase block">
                        Archdiocese of Lipa
                      </span>
                      <span className="text-base font-black text-white tracking-tight">
                        Ministry of Altar Servers
                      </span>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-900/60 border border-indigo-700/50 text-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    v2.2 Stable
                  </span>
                </div>

                {/* Center Hero Message */}
                <div className="relative z-10 my-10 md:my-14 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-xs font-bold text-indigo-200">
                    <svg className="w-4 h-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>Ad Majorem Dei Gloriam</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                    Serving at the Altar of the Lord.
                  </h1>
                  <p className="text-slate-300 text-sm md:text-base font-normal max-w-lg leading-relaxed">
                    Integrated Attendance Management, Liturgical Mass Scheduling, Officer Collaboration, and Youth Ministry Portal.
                  </p>
                </div>

                {/* Bottom Altar Server Public Link Callout */}
                <div className="relative z-10 p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">Not an officer or administrator?</span>
                    <span className="text-[11px] text-indigo-300 font-medium">
                      Altar servers and parents can file absence requests directly.
                    </span>
                  </div>
                  <Link
                    to="/public/excuse"
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-sm transition whitespace-nowrap"
                  >
                    Public Excuse Portal
                  </Link>
                </div>
              </div>

              {/* RIGHT SIDE: Clean Modern Auth Form */}
              <div className="md:col-span-6 lg:col-span-5 bg-white p-8 md:p-12 flex flex-col justify-center">
                <div className="max-w-sm w-full mx-auto space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Officer Portal Login</h2>
                    <p className="text-xs font-semibold text-slate-500 mt-1">
                      Enter your parish credentials to manage ministry schedules and attendance.
                    </p>
                  </div>

                  {/* Maintenance Notice */}
                  {isMaintenanceActive && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs space-y-1">
                      <div className="font-bold text-amber-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        <span>System Maintenance Active</span>
                      </div>
                      <p className="text-amber-800 text-[11px]">
                        Only the Coordinator and authorized accounts may sign in during this maintenance window.
                      </p>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSimulateSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-black uppercase text-slate-700 tracking-wider">
                        Email Address
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="officer@parish.org"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                          required
                        />
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-black uppercase text-slate-700 tracking-wider">
                          Password
                        </label>
                        <span className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer">
                          Forgot Password?
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 shadow-2xs transition"
                          required
                        />
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPassword(p => !p)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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

                    {/* Error Banner */}
                    {simulatedError && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>{simulatedError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Signing in...</span>
                        </>
                      ) : (
                        <span>Sign In to MATS</span>
                      )}
                    </button>
                  </form>

                  <div className="pt-4 border-t border-slate-100 text-center">
                    <p className="text-[11px] text-slate-400 font-medium">
                      Need account assistance? Contact your Parish Coordinator.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PROPOSAL B: THE GLASSMORPHIC CATHEDRAL */}
          {/* ========================================================================= */}
          {activeTab === 'proposal_b' && (
            <div className="w-full min-h-full bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
              {/* Sacred Ambient Mesh Glow */}
              <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-indigo-600/25 via-blue-500/20 to-amber-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Floating Glassmorphic Container Card */}
              <div className="relative z-10 w-full max-w-md bg-white/95 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl p-8 sm:p-10 space-y-7">
                {/* Brand Halo Header */}
                <div className="text-center space-y-3">
                  <div className="relative inline-block">
                    <div className="absolute inset-0 rounded-2xl bg-indigo-500/30 blur-lg" />
                    <img
                      src="/favicon/favicon.png"
                      alt="MATS"
                      className="relative w-16 h-16 rounded-2xl border border-indigo-100 shadow-md mx-auto object-cover"
                    />
                  </div>
                  <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">MATS Officer Portal</h1>
                    <p className="text-xs font-bold text-indigo-700 mt-0.5">Ministry Attendance Tracking System</p>
                  </div>
                </div>

                {/* Maintenance Notice */}
                {isMaintenanceActive && (
                  <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-2xl text-xs space-y-1">
                    <span className="font-bold text-amber-900 block">System Maintenance Active</span>
                    <p className="text-[11px] text-amber-800">Only authorized accounts may sign in at this time.</p>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSimulateSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Officer Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@parish.org"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Password
                      </label>
                      <span className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer">
                        Forgot Password?
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full h-11 pl-3.5 pr-10 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-2xs transition"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(p => !p)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
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

                  {simulatedError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                      {simulatedError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Authenticating...' : 'Sign In to Account'}
                  </button>
                </form>

                {/* Bottom Shortcuts Drawer */}
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-indigo-950 block">Altar Server Excuse</span>
                    <span className="text-[10px] text-indigo-700">Self-Service Portal</span>
                  </div>
                  <Link
                    to="/public/excuse"
                    className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 font-extrabold shadow-2xs hover:bg-indigo-50 text-[11px]"
                  >
                    Open Portal
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PROPOSAL C: THE MINISTRY PORTAL LAUNCHPAD */}
          {/* ========================================================================= */}
          {activeTab === 'proposal_c' && (
            <div className="w-full min-h-full bg-slate-100 p-6 md:p-12 flex items-center justify-center font-sans text-slate-800">
              <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                {/* Primary Sign-In Card (7 cols) */}
                <div className="md:col-span-7 bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xl flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-5">
                      <img
                        src="/favicon/favicon.png"
                        alt="MATS"
                        className="w-12 h-12 rounded-2xl border border-slate-200 shadow-sm object-cover"
                      />
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">MATS Authentication</h2>
                        <span className="text-xs font-semibold text-slate-500">Ministry Coordinator & Officer Console</span>
                      </div>
                    </div>

                    <form onSubmit={handleSimulateSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="officer@parish.org"
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-2xs"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                            Password
                          </label>
                          <span className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer">
                            Forgot Password?
                          </span>
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-2xs"
                          required
                        />
                      </div>

                      {simulatedError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                          {simulatedError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer"
                      >
                        {isLoading ? 'Signing in...' : 'Sign In to Dashboard'}
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>System Status: <strong className="text-emerald-600">Operational</strong></span>
                    <span>v2.2</span>
                  </div>
                </div>

                {/* Secondary Public Services Launchpad (5 cols) */}
                <div className="md:col-span-5 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 border border-indigo-800/50 shadow-xl flex flex-col justify-between space-y-6">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
                      Public Services
                    </span>
                    <h3 className="text-xl font-black text-white tracking-tight">
                      Altar Server Launchpad
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Direct access tools for altar servers, parents, and parish volunteers.
                    </p>

                    <div className="mt-6 space-y-3">
                      {/* Shortcut 1 */}
                      <Link
                        to="/public/excuse"
                        className="p-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 transition flex items-center justify-between gap-3 block"
                      >
                        <div>
                          <div className="text-xs font-black text-white">File Member Excuse</div>
                          <div className="text-[11px] text-indigo-200">Submit an excuse request online</div>
                        </div>
                        <svg className="w-4 h-4 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </Link>

                      {/* Shortcut 2 */}
                      <div className="p-3.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-white">Officer Account Recovery</div>
                          <div className="text-[11px] text-indigo-200">Contact Coordinator for credentials</div>
                        </div>
                        <svg className="w-4 h-4 text-indigo-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-indigo-300 font-medium text-center">
                    Ministry of Altar Servers • Archdiocese of Lipa
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PROPOSAL D: THE NEO-SACRED MINIMALIST */}
          {/* ========================================================================= */}
          {activeTab === 'proposal_d' && (
            <div className="w-full min-h-full bg-white flex flex-col items-center justify-center p-6 font-sans text-slate-900">
              <div className="max-w-sm w-full space-y-8">
                {/* Header */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src="/favicon/favicon.png"
                      alt="MATS"
                      className="w-10 h-10 rounded-xl border border-slate-200 object-cover"
                    />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        MATS ARCHDIOCESE
                      </span>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight">
                        Sign in to account
                      </h1>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSimulateSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="officer@domain.com"
                      className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 focus:border-indigo-600 text-xs font-bold text-slate-900 focus:outline-none transition shadow-2xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                        Password
                      </label>
                      <span className="text-[10px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer">
                        Forgot?
                      </span>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 px-3.5 rounded-xl border-2 border-slate-200 focus:border-indigo-600 text-xs font-bold text-slate-900 focus:outline-none transition shadow-2xs"
                      required
                    />
                  </div>

                  {simulatedError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                      {simulatedError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-11 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-xl transition shadow-md cursor-pointer"
                  >
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                {/* Bottom Minimalist Links */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <Link to="/public/excuse" className="hover:text-slate-900 font-bold">
                    Public Excuse Portal →
                  </Link>
                  <span className="text-[10px] font-mono">v2.2</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
