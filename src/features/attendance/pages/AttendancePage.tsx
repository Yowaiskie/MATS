import React, { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { attendanceService } from '@/services/attendanceService'
import { settingsService } from '@/services/settingsService'
import { useAuth } from '@/features/authentication/AuthContext'
import { Card } from '@/components/Card'
import { AttendanceHeader } from '../components/AttendanceHeader'
import { AttendanceRow } from '../components/AttendanceRow'
import { CommunityReportModal } from '../components/CommunityReportModal'
import { AddOtherServerModal } from '../components/AddOtherServerModal'
import { generateCommunityReport } from '@/utils/communityReport'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceSession, AttendanceStatus } from '@/types/attendance'
import { calculateAttendanceSummary } from '@/utils/attendance'
import { AlertModal, ConfirmModal } from '@/components/Dialog'

interface RowState {
  id?: string
  status: AttendanceStatus | undefined
  remarks: string
  isOtherServer?: boolean
}

interface FormState {
  [memberId: string]: RowState
}

export const AttendancePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')
  const { user } = useAuth()
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [assignedMembers, setAssignedMembers] = useState<Member[]>([])
  const [otherServers, setOtherServers] = useState<Member[]>([])
  const [allMembersProfiles, setAllMembersProfiles] = useState<Member[]>([])
  const [addOtherServerOpen, setAddOtherServerOpen] = useState(false)
  
  // Local Form state
  const [formState, setFormState] = useState<FormState>({})
  const [originalState, setOriginalState] = useState<FormState>({})
  
  // Page state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [template, setTemplate] = useState('')

  // Confirm dialog state
  const [lockConfirm, setLockConfirm] = useState<{ nextLocked: boolean } | null>(null)
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null)

  const displayMembers = [...assignedMembers, ...otherServers]

  // Initialize form state
  const isDirty = JSON.stringify(formState) !== JSON.stringify(originalState)

  // Trigger unload prompt warning if forms are dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = 'You have unsaved changes. Are you sure you want to discard them?'
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  const loadData = async () => {
    if (!scheduleId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    setSuccessMsg(null)

    try {
      // 1. Load schedules & verify match
      const schedulesList = await scheduleService.getSchedules()
      const matchedSchedule = schedulesList.find(s => s.id === scheduleId)
      
      if (!matchedSchedule) {
        setError('Schedule service record not found.')
        setLoading(false)
        return
      }
      setSchedule(matchedSchedule)

      // 2. Fetch or create Session lifecycle document
      const sessionDoc = await attendanceService.getOrCreateSession(scheduleId)
      setSession(sessionDoc)

      // 3. Load all member profiles to map full names
      const allMembers = await memberService.getMembers(true) // include archived to support old records
      setAllMembersProfiles(allMembers)
      const assignedIds = matchedSchedule.assignedMembers || []
      const assignedProfiles = allMembers.filter(m => assignedIds.includes(m.id))
      setAssignedMembers(assignedProfiles)

      // 4. Fetch existing attendance records
      const records = await attendanceService.getAttendanceForSession(sessionDoc.id)

      // Get member IDs that have an attendance record for this session where isOtherServer is true
      const otherServerRecords = records.filter(r => r.isOtherServer === true)
      const otherServerMemberIds = otherServerRecords.map(r => r.memberId)

      const otherServerProfiles = allMembers.filter(m => otherServerMemberIds.includes(m.id))
      otherServerProfiles.sort((a, b) => {
        const lastA = a.lastName.toLowerCase()
        const lastB = b.lastName.toLowerCase()
        if (lastA !== lastB) return lastA.localeCompare(lastB)
        return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase())
      })
      setOtherServers(otherServerProfiles)

      // Fetch customized report template from Firestore
      const fetchedTemplate = await settingsService.getReportTemplate()
      setTemplate(fetchedTemplate)
      
      // 5. Initialize form state
      const initialFormState: FormState = {}
      assignedProfiles.forEach((m) => {
        const record = records.find(r => r.memberId === m.id)
        initialFormState[m.id] = {
          id: record?.id,
          status: record?.status || undefined,
          remarks: record?.remarks || '',
          isOtherServer: false
        }
      })
      otherServerProfiles.forEach((m) => {
        const record = records.find(r => r.memberId === m.id)
        initialFormState[m.id] = {
          id: record?.id,
          status: record?.status || undefined,
          remarks: record?.remarks || '',
          isOtherServer: true
        }
      })

      setFormState(initialFormState)
      setOriginalState(JSON.parse(JSON.stringify(initialFormState)))
    } catch (err: any) {
      console.error(err)
      setError('Failed to load attendance session.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [scheduleId])

  // Bulk Actions callback
  const handleBulkAction = (action: 'present' | 'absent' | 'clear') => {
    if (!schedule) return
    
    setFormState((prev) => {
      const next = { ...prev }
      displayMembers.forEach((member) => {
        next[member.id] = {
          ...next[member.id],
          status: action === 'clear' ? undefined : action
        }
      })
      return next
    })
  }

  // Row state updates
  const handleRowStatusChange = (memberId: string, status: AttendanceStatus) => {
    setFormState(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        status
      }
    }))
  }

  const handleRowRemarksChange = (memberId: string, remarks: string) => {
    setFormState(prev => ({
      ...prev,
      [memberId]: {
        ...prev[memberId],
        remarks
      }
    }))
  }

  // Save changes
  const handleSave = async () => {
    if (!session || !schedule) return

    // Ensure all displayed members have a status marked
    const unselectedMembers = displayMembers.filter(
      m => !formState[m.id] || formState[m.id].status === undefined
    )
    
    if (unselectedMembers.length > 0) {
      setError('Please select attendance status for all servers before saving.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const inputs = displayMembers.map((m) => ({
        id: formState[m.id]?.id,
        memberId: m.id,
        status: formState[m.id].status as AttendanceStatus,
        remarks: formState[m.id].remarks || '',
        isOtherServer: formState[m.id].isOtherServer ?? false
      }))

      await attendanceService.saveAttendanceRecords(
        session.id,
        schedule.id,
        schedule.date,
        inputs
      )

      setSuccessMsg('Attendance records successfully updated!')
      
      // Reload records to refresh IDs and local baseline
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save attendance records.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle session locked state — opens confirm modal first
  const handleToggleLock = () => {
    if (!session) return
    setLockConfirm({ nextLocked: !session.locked })
  }

  const handleLockConfirmed = async () => {
    if (!session || !lockConfirm) return
    const { nextLocked } = lockConfirm
    setLockConfirm(null)
    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const adminEmail = user?.email || 'admin'
      await attendanceService.setSessionLockState(session.id, nextLocked, adminEmail)
      setSuccessMsg(
        nextLocked
          ? 'Attendance session finalized and locked successfully!'
          : 'Attendance session unlocked successfully.'
      )
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError('Failed to update session lock state.')
    } finally {
      setSaving(false)
    }
  }

  // Intercept back action to check dirty state — shows modal instead of browser confirm
  const handleBackNavigation = (e: React.MouseEvent) => {
    if (isDirty) {
      e.preventDefault()
      setPendingNavTarget('/schedules')
      setBackConfirmOpen(true)
    }
  }

  // Live Summary Calculation
  const computedSummary = calculateAttendanceSummary(
    displayMembers
      .map(m => formState[m.id]?.status)
      .filter((status): status is AttendanceStatus => status !== undefined)
      .map(status => ({ status }))
  )
  computedSummary.total = displayMembers.length

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        <span className="text-xs text-gray-500">Loading attendance data...</span>
      </div>
    )
  }

  if (!scheduleId || error === 'Schedule service record not found.') {
    return (
      <div className="py-16 text-center rounded-xl border border-gray-200 bg-white shadow-sm max-w-lg mx-auto">
        <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="mt-3 text-sm font-bold text-gray-900">No schedule selected</h3>
        <p className="mt-1 text-xs text-gray-500">Please select an active schedule from the panel to record attendance.</p>
        <div className="mt-4">
          <Link
            to="/schedules"
            className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors shadow-sm"
          >
            Go to Schedules
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button shortcut */}
      <div>
        <Link
          to="/schedules"
          onClick={handleBackNavigation}
          className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Back to Schedules</span>
        </Link>
      </div>

      {schedule && session && (
        <AttendanceHeader
          schedule={schedule}
          session={session}
          summary={computedSummary}
          onBulkAction={handleBulkAction}
          onToggleLock={handleToggleLock}
          onGenerateReport={() => setReportModalOpen(true)}
          isSaving={saving}
          isDirty={isDirty}
        />
      )}

      {/* Form Area */}
      <Card>
        <div className="divide-y divide-gray-100">
          {displayMembers.length > 0 ? (
            displayMembers.map((member) => (
              <AttendanceRow
                key={member.id}
                member={member}
                status={formState[member.id]?.status}
                remarks={formState[member.id]?.remarks || ''}
                onStatusChange={(status) => handleRowStatusChange(member.id, status)}
                onRemarksChange={(remarks) => handleRowRemarksChange(member.id, remarks)}
                disabled={saving || (session?.locked ?? false)}
                isOtherServer={formState[member.id]?.isOtherServer}
              />
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-400">
              No members are assigned to this service schedule. Select "Assign Servers" or click "+ Add Other Server" to populate.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!(session?.locked ?? false) && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-wrap gap-4">
            <div>
              <button
                type="button"
                onClick={() => setAddOtherServerOpen(true)}
                disabled={saving}
                className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-700 transition-colors disabled:opacity-40 cursor-pointer shadow-sm"
              >
                + Add Other Server
              </button>
            </div>

            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-[11px] text-amber-600 font-semibold mr-2">
                  ● You have unsaved changes
                </span>
              )}
              {displayMembers.length > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50 shadow-sm cursor-pointer"
                >
                  {saving ? 'Saving changes...' : 'Save Attendance Records'}
                </button>
              )}
            </div>
          </div>
        )}
      </Card>

      {schedule && (
        <CommunityReportModal
          isOpen={reportModalOpen}
          onClose={() => setReportModalOpen(false)}
          reportText={generateCommunityReport(template, schedule, assignedMembers, formState, otherServers)}
        />
      )}

      {schedule && (
        <AddOtherServerModal
          isOpen={addOtherServerOpen}
          onClose={() => setAddOtherServerOpen(false)}
          onAdd={(newMembers) => {
            // Update formState
            setFormState((prev) => {
              const updated = { ...prev }
              newMembers.forEach((m) => {
                updated[m.id] = {
                  status: 'present',
                  remarks: '',
                  isOtherServer: true
                }
              })
              return updated
            })
            
            // Add to otherServers list
            setOtherServers((prev) => {
              const updated = [...prev, ...newMembers]
              // Sort alphabetically
              updated.sort((a, b) => {
                const lastA = a.lastName.toLowerCase()
                const lastB = b.lastName.toLowerCase()
                if (lastA !== lastB) return lastA.localeCompare(lastB)
                return a.firstName.toLowerCase().localeCompare(b.firstName.toLowerCase())
              })
              return updated
            })
          }}
          allMembers={allMembersProfiles}
          assignedIds={schedule.assignedMembers || []}
          currentOtherServerIds={otherServers.map(m => m.id)}
        />
      )}

      {/* Lock / Unlock Confirm Modal */}
      <ConfirmModal
        isOpen={!!lockConfirm}
        onClose={() => setLockConfirm(null)}
        onConfirm={handleLockConfirmed}
        variant={lockConfirm?.nextLocked ? 'danger' : 'warning'}
        title={lockConfirm?.nextLocked ? 'Finalize & Lock Session' : 'Unlock Attendance Session'}
        message={
          lockConfirm?.nextLocked
            ? 'Are you sure you want to finalize and lock attendance? You will not be able to modify records unless unlocked.'
            : 'Are you sure you want to unlock this session for edits?'
        }
        confirmLabel={lockConfirm?.nextLocked ? 'Finalize & Lock' : 'Unlock'}
        loading={saving}
      />

      {/* Unsaved Changes — Back Navigation Warning */}
      <ConfirmModal
        isOpen={backConfirmOpen}
        onClose={() => { setBackConfirmOpen(false); setPendingNavTarget(null) }}
        onConfirm={() => {
          setBackConfirmOpen(false)
          if (pendingNavTarget) navigate(pendingNavTarget)
        }}
        variant="warning"
        title="Unsaved Changes"
        message="You have unsaved attendance changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave Page"
      />

      {/* Error Alert Modal */}
      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="Error"
        message={error ?? ''}
      />

      {/* Success Alert Modal */}
      <AlertModal
        isOpen={!!successMsg}
        onClose={() => setSuccessMsg(null)}
        variant="success"
        title="Success"
        message={successMsg ?? ''}
      />
    </div>
  )
}
