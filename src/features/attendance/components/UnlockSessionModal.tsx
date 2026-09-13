import React, { useState } from 'react'
import { authService } from '@/services/authService'

import { Button } from '@/components'

interface UnlockSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmUnlock: () => Promise<void>
  scheduleTitle: string
}

export const UnlockSessionModal: React.FC<UnlockSessionModalProps> = ({
  isOpen,
  onClose,
  onConfirmUnlock,
  scheduleTitle,
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setPassword('')
    setShowPassword(false)
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) {
      setError('Please enter your account password.')
      return
    }

    setVerifying(true)
    setError(null)

    try {
      // Re-authenticate user with entered password
      await authService.verifyPassword(password.trim())
      
      // Password verified! Proceed with unlocking
      await onConfirmUnlock()
      handleClose()
    } catch (err: any) {
      console.error(err)
      let msg = 'Incorrect password. Verification failed.'
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Incorrect account password. Please try again.'
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Too many failed attempts. Please try again later.'
      }
      setError(msg)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={handleClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 text-slate-800 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 inline-block mb-0.5">
                Security Authorization
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Unlock Attendance Session</h3>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <p className="text-slate-600 font-medium leading-relaxed">
            You are about to unlock attendance for <strong className="text-slate-900">"{scheduleTitle}"</strong>. Please enter your account password to confirm:
          </p>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-800 animate-fade-in">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
              Your Account Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-12 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                disabled={verifying}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 mt-4 bg-white sticky bottom-0">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              onClick={handleClose}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="dense"
              loading={verifying}
              loadingText="Verifying Password..."
              className="!bg-amber-600 hover:!bg-amber-700 !shadow-amber-500/20"
            >
              Confirm & Unlock Session
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
