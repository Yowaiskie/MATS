import React, { useState, useEffect } from 'react'
import { userService } from '@/services/userService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { UserProfile, UserRole } from '@/types/auth'
import { Card } from '@/components/Card'
import { ConfirmModal, AlertModal } from '@/components/Dialog'

export const UsersPage: React.FC = () => {
  const { profile: currentAdmin, isAdmin } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Register / Edit User Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('user')

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await userService.getUsers()
      setUsers(data)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load user accounts list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAddModal = () => {
    setEditingUser(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setDisplayName('')
    setRole('user')
    setError(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit)
    setEmail(userToEdit.email)
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setDisplayName(userToEdit.displayName || '')
    setRole(userToEdit.role || 'user')
    setError(null)
    setIsModalOpen(true)
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email address is required.')
      return
    }

    if (!editingUser && (!password || password.length < 6)) {
      setError('Password is required and must be at least 6 characters.')
      return
    }

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setError('New Password and Confirm New Password do not match. Please verify.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.')
        return
      }
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      if (editingUser) {
        if (editingUser.uid === currentAdmin?.uid && role !== 'admin') {
          setError('You cannot revoke your own admin access.')
          setSaving(false)
          return
        }

        await userService.saveUserProfile(
          {
            uid: editingUser.uid,
            email: email.trim(),
            displayName: displayName.trim() || undefined,
            role
          },
          currentAdmin?.email || 'Admin'
        )

        let msg = `User profile '${email.trim()}' successfully updated!`
        if (password.trim()) {
          msg += ' Password updated successfully.'
        }
        setSuccessMsg(msg)
      } else {
        await userService.registerNewUserWithAuth(
          {
            email: email.trim(),
            password: password.trim(),
            displayName: displayName.trim() || undefined,
            role
          },
          currentAdmin?.email || 'Admin'
        )

        setSuccessMsg(`User account '${email.trim()}' created in Firebase Auth & registered with role '${role === 'admin' ? 'Admin' : 'Attendance Taker'}'!`)
      }

      setIsModalOpen(false)
      await loadData()
    } catch (err: any) {
      console.error(err)
      let msg = err.message || 'Failed to save user profile.'
      if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists in Firebase Auth.'
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.'
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    if (deleteTarget.uid === currentAdmin?.uid) {
      setError('You cannot delete your own account.')
      setDeleteTarget(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await userService.deleteUserProfile(
        deleteTarget.uid,
        deleteTarget.email,
        currentAdmin?.email || 'Admin'
      )
      setSuccessMsg(`User '${deleteTarget.email}' removed from system.`)
      setDeleteTarget(null)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to delete user profile.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center bg-white rounded-xl border border-gray-200 p-8 shadow-xs max-w-md mx-auto font-sans">
        <h3 className="text-base font-bold text-gray-900">Access Restricted</h3>
        <p className="text-xs text-gray-500 mt-2">Only system administrators can access User Management.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage admin and attendance taker accounts and system permissions.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Register New User</span>
        </button>
      </div>

      {/* Success Notification */}
      {successMsg && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-700 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-green-600 hover:text-green-800 font-bold ml-4 cursor-pointer">✕</button>
        </div>
      )}

      {/* Main Users Table */}
      <Card className="p-0 overflow-hidden border border-gray-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="px-6 py-3.5">User Email</th>
                <th className="px-6 py-3.5">Display Name</th>
                <th className="px-6 py-3.5">System Role</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                      <span className="text-xs text-gray-500">Loading user accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-xs text-gray-400 italic">
                    No user accounts found in database.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = u.uid === currentAdmin?.uid

                  return (
                    <tr key={u.uid} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{u.email}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                        {u.displayName || '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                          u.role === 'admin'
                            ? 'bg-purple-50 border-purple-200 text-purple-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          {u.role === 'admin' ? (
                            <>
                              <svg className="h-3.5 w-3.5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              <span>Admin (Full Access)</span>
                            </>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>Attendance Taker (Take & Save Only)</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap text-xs space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer border border-blue-100"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        {!isCurrent && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-md transition-colors cursor-pointer border border-red-100"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Remove</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <h3 className="text-sm font-bold text-gray-900">
                  {editingUser ? 'Edit User Profile & Access' : 'Register New User Account'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">✕</button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="mt-4 space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">User Email *</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. officer@mas.com"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:opacity-75"
                />
              </div>

              {/* Password Field 1 */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  {editingUser ? 'New Password (Optional)' : 'New Password (min. 6 chars) *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? 'Leave blank to keep current password...' : '••••••••'}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                    title={showPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 014.122-.963c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Password Field 2 — Confirm Password */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  {editingUser ? 'Confirm New Password (Optional)' : 'Confirm New Password *'}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required={!editingUser || password.length > 0}
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={editingUser ? 'Re-type new password to confirm...' : 'Confirm new password...'}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                    title={showConfirmPassword ? 'Hide Password' : 'Show Password'}
                  >
                    {showConfirmPassword ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a10.025 10.025 0 014.122-.963c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Display Name (Optional)</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Order of San Pedro"
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">System Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  disabled={editingUser?.uid === currentAdmin?.uid}
                  className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 disabled:opacity-60 cursor-pointer"
                >
                  <option value="user">Attendance Taker (Take & Save Only)</option>
                  <option value="admin">Admin (Full System Access)</option>
                </select>
                {editingUser?.uid === currentAdmin?.uid && (
                  <p className="mt-1 text-[10px] text-amber-600 font-medium">You cannot change your own admin role.</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingUser ? 'Update Profile' : 'Create Account & Save'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Remove User Account Profile"
        message={`Are you sure you want to remove '${deleteTarget?.email}' from system user profiles?`}
        confirmLabel="Remove Profile"
        loading={saving}
      />

      {/* Alert Dialog */}
      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="User Management Error"
        message={error || ''}
      />
    </div>
  )
}
