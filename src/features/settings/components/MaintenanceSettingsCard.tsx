import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/Card'
import { maintenanceService } from '@/services/maintenanceService'
import { userService } from '@/services/userService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { MaintenanceSettings } from '@/types/maintenance'
import { DEFAULT_MAINTENANCE_SETTINGS } from '@/types/maintenance'
import type { UserProfile } from '@/types/auth'

interface MaintenanceSettingsCardProps {
  onNotifySuccess?: (msg: string) => void
  onNotifyError?: (msg: string) => void
}

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.83-5.83M11.42 15.17l2.496-3.03c.317-.384.74-.664 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l5.654-4.654m0 0l-3.03 2.496c-.102.468-.382.891-.766 1.208m0 0L3.75 10.5" />
  </svg>
)

const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
)

export const MaintenanceSettingsCard: React.FC<MaintenanceSettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError
}) => {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS)
  const [initialSettings, setInitialSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [fetchedSettings, fetchedUsers] = await Promise.all([
        maintenanceService.getMaintenanceSettings(),
        userService.getUsers().catch(() => [])
      ])
      setSettings(fetchedSettings)
      setInitialSettings(fetchedSettings)
      setUsers(fetchedUsers)
    } catch (err) {
      console.error(err)
      onNotifyError?.('Failed to load maintenance settings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return users
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    )
  }, [users, searchQuery])

  const isUserCoordinator = (u: UserProfile) => {
    return u.role === 'coordinator' || u.email.toLowerCase() === 'coordinator@mas.com'
  }

  const isUserAllowed = (u: UserProfile) => {
    if (isUserCoordinator(u)) return true
    const normalizedEmail = u.email.toLowerCase().trim()
    return settings.allowedUserUids.includes(u.uid) || settings.allowedUserUids.includes(normalizedEmail)
  }

  const toggleUserAllowed = (u: UserProfile) => {
    if (isUserCoordinator(u)) return // Coordinator is always allowed

    const currentAllowed = [...settings.allowedUserUids]
    const normalizedEmail = u.email.toLowerCase().trim()
    const hasUid = currentAllowed.includes(u.uid)
    const hasEmail = currentAllowed.includes(normalizedEmail)

    if (hasUid || hasEmail) {
      const updated = currentAllowed.filter((id) => id !== u.uid && id !== normalizedEmail)
      setSettings((prev) => ({ ...prev, allowedUserUids: updated }))
    } else {
      currentAllowed.push(u.uid)
      if (normalizedEmail) {
        currentAllowed.push(normalizedEmail)
      }
      setSettings((prev) => ({ ...prev, allowedUserUids: Array.from(new Set(currentAllowed)) }))
    }
  }

  const handleSelectAllAdmins = () => {
    const adminUids = users
      .filter((u) => u.role === 'admin' || u.role === 'coordinator')
      .map((u) => u.uid)

    const newAllowed = Array.from(new Set([...settings.allowedUserUids, ...adminUids]))
    setSettings((prev) => ({ ...prev, allowedUserUids: newAllowed }))
  }

  const handleClearSelectedUsers = () => {
    setSettings((prev) => ({ ...prev, allowedUserUids: [] }))
  }

  const isDirty = useMemo(() => {
    return (
      settings.enabled !== initialSettings.enabled ||
      settings.message !== initialSettings.message ||
      settings.expectedEndAt !== initialSettings.expectedEndAt ||
      JSON.stringify(settings.allowedUserUids.sort()) !== JSON.stringify(initialSettings.allowedUserUids.sort())
    )
  }, [settings, initialSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const actor = profile?.displayName || profile?.email || 'Coordinator'
      await maintenanceService.saveMaintenanceSettings(settings, actor)
      setInitialSettings(settings)
      onNotifySuccess?.(`Maintenance Mode successfully updated (${settings.enabled ? 'ON' : 'OFF'})!`)
    } catch (err: any) {
      console.error(err)
      onNotifyError?.(err.message || 'Failed to save maintenance settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (newVal: boolean) => {
    const newSettings = { ...settings, enabled: newVal }
    setSettings(newSettings)
    setSaving(true)
    try {
      const actor = profile?.displayName || profile?.email || 'Coordinator'
      await maintenanceService.saveMaintenanceSettings(newSettings, actor)
      setInitialSettings(newSettings)
      onNotifySuccess?.(`Maintenance Mode is now ${newVal ? 'ACTIVATED (ON)' : 'DEACTIVATED (OFF)'}!`)
    } catch (err: any) {
      console.error(err)
      onNotifyError?.(err.message || 'Failed to toggle maintenance mode.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="p-8">
        <div className="flex flex-col items-center justify-center space-y-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <span className="text-xs text-gray-500">Loading Maintenance Mode settings...</span>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-2xl ${settings.enabled ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
            <WrenchIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Maintenance Mode Control</h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  settings.enabled
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                Maintenance Mode: {settings.enabled ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Temporarily restrict MATS access during system updates, migrations, or database maintenance.
            </p>
          </div>
        </div>

        {/* Global Enable / Disable Toggle Switch */}
        <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-2xl border border-gray-200 self-start sm:self-auto">
          <span className="text-xs font-bold text-gray-700">Enable Maintenance</span>
          <button
            type="button"
            role="switch"
            disabled={saving}
            aria-checked={settings.enabled}
            onClick={() => handleToggleEnabled(!settings.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:opacity-50 ${
              settings.enabled ? 'bg-amber-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Main Configuration Form */}
      <div className="space-y-6">
        
        {/* Custom Maintenance Message */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Custom Maintenance Message <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-2">
            This message will be displayed prominently to users and visitors on the maintenance screen.
          </p>
          <textarea
            rows={3}
            value={settings.message}
            onChange={(e) => setSettings((prev) => ({ ...prev, message: e.target.value }))}
            placeholder="e.g. MATS is currently under maintenance. Please try again later."
            className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:border-amber-500 focus:ring-amber-500 text-gray-900"
          />
        </div>

        {/* Expected End Date / Time */}
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Expected Availability (Optional)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Set an estimated date and time when MATS is expected to be back online.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="datetime-local"
              value={settings.expectedEndAt || ''}
              onChange={(e) => setSettings((prev) => ({ ...prev, expectedEndAt: e.target.value }))}
              className="rounded-xl border border-gray-300 p-2.5 text-sm focus:border-amber-500 focus:ring-amber-500 text-gray-900 bg-white"
            />
            {settings.expectedEndAt && (
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, expectedEndAt: '' }))}
                className="text-xs font-semibold text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        {/* Allowed Users Selection Section */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Allowed Users During Maintenance</h3>
              <p className="text-xs text-gray-500">
                Select additional team members or officers who are permitted to log in and use MATS while maintenance mode is active.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllAdmins}
                className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                + Allow All Admins
              </button>
              <button
                type="button"
                onClick={handleClearSelectedUsers}
                className="text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Clear Selections
              </button>
            </div>
          </div>

          {/* User Search Bar */}
          <div className="relative max-w-md">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search users by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-xs focus:border-amber-500 focus:ring-amber-500 text-gray-900"
            />
          </div>

          {/* User Checkbox List */}
          <div className="border border-gray-200 rounded-2xl max-h-72 overflow-y-auto divide-y divide-gray-100 bg-gray-50/50">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-gray-500">No users found.</div>
            ) : (
              filteredUsers.map((u) => {
                const isCoord = isUserCoordinator(u)
                const checked = isUserAllowed(u)

                return (
                  <label
                    key={u.uid}
                    onClick={() => toggleUserAllowed(u)}
                    className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                      checked ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-gray-100/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isCoord}
                        onChange={() => {}} // handled by label onClick
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-60"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-900">
                            {u.displayName || u.email}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700 uppercase">
                            {u.role}
                          </span>
                          {isCoord && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900">
                              Coordinator (Always Allowed)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">{u.email}</span>
                      </div>
                    </div>

                    <div>
                      {checked && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700">
                          <CheckIcon className="w-3.5 h-3.5" /> Allowed
                        </span>
                      )}
                    </div>
                  </label>
                )
              })
            )}
          </div>
          <p className="text-[11px] text-gray-500 text-right">
            Allowed Users: {settings.allowedUserUids.length + 1} (Coordinator + {settings.allowedUserUids.length} selected)
          </p>
        </div>

      </div>

      {/* Footer / Save Action */}
      <div className="flex items-center justify-between pt-6 border-t border-gray-100">
        <span className="text-xs text-gray-500">
          {isDirty ? 'Unsaved changes pending...' : 'All settings up to date.'}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
          <span>{saving ? 'Saving Changes...' : 'Save Maintenance Settings'}</span>
        </button>
      </div>
    </Card>
  )
}
