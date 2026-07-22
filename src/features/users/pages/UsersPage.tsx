import React, { useState, useEffect } from 'react'
import { userService } from '@/services/userService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { UserProfile, UserRole, ModuleKey, UserPermissions } from '@/types/auth'
import type { OrderGroup } from '@/types/member'
import { ORDER_GROUPS } from '@/types/member'
import { Card } from '@/components/Card'
import { ConfirmModal, AlertModal } from '@/components/Dialog'

const ALL_MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'dashboard', label: 'Dashboard Overview', description: 'Access main metrics and overview dashboard' },
  { key: 'schedules', label: 'Schedules', description: 'View or manage ministry schedules and assignments' },
  { key: 'attendance', label: 'Attendance', description: 'Record and track server attendance' },
  { key: 'reports', label: 'Reports & Analytics', description: 'View member metrics and export PDF reports' },
  { key: 'members', label: 'Member Directory', description: 'Manage altar server profiles and records' },
  { key: 'users', label: 'User Management', description: 'Manage system accounts and access permissions' },
  { key: 'settings', label: 'Settings', description: 'Configure system policies and templates' },
  { key: 'audit', label: 'Audit Trail', description: 'View system security and activity logs' },
]

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
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  
  // Permissions state
  const [allowedModules, setAllowedModules] = useState<ModuleKey[]>(['dashboard', 'attendance'])
  const [canTakeAttendance, setCanTakeAttendance] = useState(true)
  const [canFinalizeAttendance, setCanFinalizeAttendance] = useState(false)
  const [canViewSchedules, setCanViewSchedules] = useState(true)
  const [canManageSchedules, setCanManageSchedules] = useState(false)
  const [canViewReports, setCanViewReports] = useState(false)
  const [canExportReports, setCanExportReports] = useState(false)
  const [assignedOrder, setAssignedOrder] = useState<OrderGroup | ''>('')

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

  // Preset role appliers
  const applyPresetRole = (preset: 'admin' | 'attendance_taker' | 'order_leader') => {
    if (preset === 'admin') {
      setRole('admin')
      setAllowedModules(['dashboard', 'schedules', 'attendance', 'reports', 'members', 'users', 'settings', 'audit'])
      setCanTakeAttendance(true)
      setCanFinalizeAttendance(true)
      setCanViewSchedules(true)
      setCanManageSchedules(true)
      setCanViewReports(true)
      setCanExportReports(true)
      setAssignedOrder('')
    } else if (preset === 'attendance_taker') {
      setRole('user')
      setAllowedModules(['dashboard', 'schedules', 'attendance'])
      setCanTakeAttendance(true)
      setCanFinalizeAttendance(false)
      setCanViewSchedules(true)
      setCanManageSchedules(false)
      setCanViewReports(false)
      setCanExportReports(false)
      setAssignedOrder('')
    } else if (preset === 'order_leader') {
      setRole('order_leader')
      setAllowedModules(['dashboard', 'schedules', 'attendance', 'reports'])
      setCanTakeAttendance(true)
      setCanFinalizeAttendance(false)
      setCanViewSchedules(true)
      setCanManageSchedules(false)
      setCanViewReports(true)
      setCanExportReports(true)
    }
  }

  const handleOpenAddModal = () => {
    setEditingUser(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    applyPresetRole('attendance_taker')
    setError(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit)
    setEmail(userToEdit.email)
    setPassword('')
    setConfirmPassword('')
    setDisplayName(userToEdit.displayName || '')
    setRole(userToEdit.role || 'user')
    setAssignedOrder(userToEdit.assignedOrder || '')

    const perms = userToEdit.permissions
    if (userToEdit.role === 'admin') {
      applyPresetRole('admin')
    } else if (perms) {
      setAllowedModules(perms.allowedModules || ['dashboard', 'attendance'])
      setCanTakeAttendance(perms.canTakeAttendance ?? true)
      setCanFinalizeAttendance(perms.canFinalizeAttendance ?? false)
      setCanViewSchedules(perms.canViewSchedules ?? true)
      setCanManageSchedules(perms.canManageSchedules ?? false)
      setCanViewReports(perms.canViewReports ?? false)
      setCanExportReports(perms.canExportReports ?? false)
    } else {
      applyPresetRole('attendance_taker')
    }
    setError(null)
    setIsModalOpen(true)
  }

  const toggleModule = (key: ModuleKey) => {
    setAllowedModules(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
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

    if (role === 'order_leader' && !assignedOrder) {
      setError('Please select an Assigned Order for the Order Leader account.')
      return
    }

    const permissionsPayload: UserPermissions = {
      allowedModules,
      canTakeAttendance,
      canFinalizeAttendance,
      canViewSchedules,
      canManageSchedules,
      canViewReports,
      canExportReports,
      assignedOrder: assignedOrder || undefined
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
            role,
            assignedOrder: role === 'order_leader' ? (assignedOrder as OrderGroup) : undefined,
            permissions: permissionsPayload
          },
          currentAdmin?.email || 'Admin'
        )

        setSuccessMsg(`User profile '${email.trim()}' successfully updated with custom permissions!`)
      } else {
        await userService.registerNewUserWithAuth(
          {
            email: email.trim(),
            password: password.trim(),
            displayName: displayName.trim() || undefined,
            role,
            assignedOrder: role === 'order_leader' ? (assignedOrder as OrderGroup) : undefined,
            permissions: permissionsPayload
          },
          currentAdmin?.email || 'Admin'
        )

        setSuccessMsg(`User account '${email.trim()}' registered in system with dynamic module permissions!`)
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
          <p className="text-sm text-gray-500 mt-1">Manage user accounts and configure custom module permissions.</p>
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
                <th className="px-6 py-3.5">Role / Scope</th>
                <th className="px-6 py-3.5">Allowed Modules</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                      <span className="text-xs text-gray-500">Loading user accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-400 italic">
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
                            : u.role === 'order_leader'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-blue-50 border-blue-200 text-blue-700'
                        }`}>
                          {u.role === 'admin' ? (
                            <span>Admin (Full System)</span>
                          ) : u.role === 'order_leader' ? (
                            <span>Order Leader ({u.assignedOrder || 'All Orders'})</span>
                          ) : (
                            <span>Attendance Taker</span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {u.role === 'admin' ? (
                          <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">All Modules</span>
                        ) : u.permissions?.allowedModules ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {u.permissions.allowedModules.map(m => (
                              <span key={m} className="capitalize text-[10px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                {m}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">Default Access</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap text-xs space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold px-2.5 py-1 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer border border-blue-100"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit Permissions</span>
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
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingUser ? 'Edit Account & Permissions' : 'Register New User Account'}
                  </h3>
                  <p className="text-xs text-gray-500">Configure credentials and fine-tune module access.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="mt-4 space-y-6">
              {/* Account Credentials */}
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account Profile
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">User Email *</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. taker@mas.com"
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Display Name (Optional)</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. San Pedro Leader"
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {editingUser ? 'New Password (Optional)' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingUser ? 'Leave blank to keep...' : '••••••••'}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {editingUser ? 'Confirm Password' : 'Confirm Password *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser || password.length > 0}
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password..."
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Role Presets */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Quick Access Presets</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPresetRole('attendance_taker')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      role === 'user'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">📋 Attendance Taker</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Take & save attendance only</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPresetRole('order_leader')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      role === 'order_leader'
                        ? 'border-amber-500 bg-amber-50/70 text-amber-900 font-semibold ring-1 ring-amber-500'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">👥 Order Leader</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Reports scoped to order</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyPresetRole('admin')}
                    disabled={editingUser?.uid === currentAdmin?.uid}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      role === 'admin'
                        ? 'border-purple-500 bg-purple-50/70 text-purple-900 font-semibold ring-1 ring-purple-500'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1">🛡️ Full Admin</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Full system control</div>
                  </button>
                </div>
              </div>

              {/* Module Access Checkboxes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center justify-between">
                  <span>Module Navigation Access</span>
                  <span className="text-[10px] font-normal text-gray-400">Select allowed sidebar menus</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_MODULES.map((mod) => {
                    const checked = allowedModules.includes(mod.key)
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          checked
                            ? 'border-blue-300 bg-blue-50/40 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(mod.key)}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold">{mod.label}</div>
                          <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{mod.description}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Granular Action Restrictions */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Action Permissions & Scoping</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attendance Controls */}
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Attendance Permissions</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canTakeAttendance}
                        onChange={(e) => setCanTakeAttendance(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Take & Save Attendance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canFinalizeAttendance}
                        onChange={(e) => setCanFinalizeAttendance(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Finalize & Lock Attendance Sessions</span>
                    </label>
                  </div>

                  {/* Schedule Controls */}
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Schedule Permissions</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canViewSchedules}
                        onChange={(e) => setCanViewSchedules(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can View Schedules</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageSchedules}
                        onChange={(e) => setCanManageSchedules(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Add / Edit / Delete Schedules</span>
                    </label>
                  </div>
                </div>

                {/* Reports & Order Scoping */}
                <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-3">
                  <span className="text-xs font-bold text-amber-900 block">Reports & Order Scoping</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canExportReports}
                        onChange={(e) => setCanExportReports(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Download / Export PDF Reports</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">Assigned Order Group (Filter Scope)</label>
                    <select
                      value={assignedOrder}
                      onChange={(e) => setAssignedOrder(e.target.value as OrderGroup)}
                      className="block w-full sm:w-64 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">-- All Orders (Unrestricted Scope) --</option>
                      {ORDER_GROUPS.map((grp) => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-amber-700">If selected, member reports will be filtered exclusively for this Order.</p>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-gray-100 sticky bottom-0 bg-white z-10">
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
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingUser ? 'Save Permissions' : 'Create Account'}</span>
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
