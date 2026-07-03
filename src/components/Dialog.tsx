import React, { useEffect } from 'react'

// ─── Shared Types ──────────────────────────────────────────────────────────────

type DialogVariant = 'success' | 'error' | 'warning' | 'info'

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const icons: Record<DialogVariant, React.ReactNode> = {
  success: (
    <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const iconBg: Record<DialogVariant, string> = {
  success: 'bg-green-50 border border-green-100',
  error: 'bg-red-50 border border-red-100',
  warning: 'bg-amber-50 border border-amber-100',
  info: 'bg-blue-50 border border-blue-100',
}

// ─── AlertModal ───────────────────────────────────────────────────────────────
// Use for: success messages, errors, warnings, and info alerts.

export interface AlertModalProps {
  isOpen: boolean
  onClose: () => void
  variant?: DialogVariant
  title: string
  message: string
  closeLabel?: string
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  variant = 'info',
  title,
  message,
  closeLabel = 'OK',
}) => {
  // ESC key support
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="alert-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Icon + Close button row */}
        <div className="flex items-start justify-between gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${iconBg[variant]} shrink-0`}>
            {icons[variant]}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-100 -mr-1 -mt-1"
            aria-label="Close dialog"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4">
          <h3 id="alert-title" className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm ${
              variant === 'success' ? 'bg-green-600 hover:bg-green-700'
              : variant === 'error' ? 'bg-red-600 hover:bg-red-700'
              : variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
            autoFocus
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
// Use for: destructive confirmations (archive, delete, lock, restore, reset).

export interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  variant?: 'danger' | 'warning' | 'info'
  title: string
  message: string
  cancelLabel?: string
  confirmLabel?: string
  loading?: boolean
}

const confirmIcons: Record<'danger' | 'warning' | 'info', React.ReactNode> = {
  danger: (
    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  warning: (
    <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const confirmIconBg: Record<'danger' | 'warning' | 'info', string> = {
  danger: 'bg-red-50 border border-red-100',
  warning: 'bg-amber-50 border border-amber-100',
  info: 'bg-blue-50 border border-blue-100',
}

const confirmBtnClass: Record<'danger' | 'warning' | 'info', string> = {
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white',
  info: 'bg-blue-600 hover:bg-blue-700 text-white',
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  variant = 'danger',
  title,
  message,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  loading = false,
}) => {
  // ESC key support
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, loading])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      {/* Backdrop — no click-to-dismiss for destructive actions */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />

      {/* Modal Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Icon */}
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${confirmIconBg[variant]}`}>
          {confirmIcons[variant]}
        </div>

        {/* Content */}
        <div className="mt-4">
          <h3 id="confirm-title" className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{message}</p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer shadow-sm disabled:opacity-50 ${confirmBtnClass[variant]}`}
            autoFocus
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
