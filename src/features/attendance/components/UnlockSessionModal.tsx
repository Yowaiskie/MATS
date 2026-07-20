import React, { useState } from 'react'
import { authService } from '@/services/authService'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={handleClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Unlock Attendance Session</h3>
              <p className="text-[11px] text-gray-500 font-medium">Security Password Required</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <p className="text-xs text-gray-600">
            You are about to unlock attendance for <strong className="text-gray-900">"{scheduleTitle}"</strong>. Please enter your account password to confirm:
          </p>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
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
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-xs text-gray-800 focus:outline-none focus:border-amber-500 transition-colors"
                disabled={verifying}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end space-x-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={verifying}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              {verifying ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>Verifying Password...</span>
                </>
              ) : (
                <span>Confirm & Unlock Session</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
