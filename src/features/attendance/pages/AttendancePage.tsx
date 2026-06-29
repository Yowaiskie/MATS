import React, { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { attendanceService } from '@/services/attendanceService'
import { useAuth } from '@/features/authentication/AuthContext'
import { Card } from '@/components/Card'
import { AttendanceHeader } from '../components/AttendanceHeader'
import { AttendanceRow } from '../components/AttendanceRow'
import { CommunityPostModal } from '../components/CommunityPostModal'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceSession, AttendanceStatus } from '@/types/attendance'
import { calculateAttendanceSummary } from '@/utils/attendance'

interface RowState {
  id?: string
  status: AttendanceStatus | undefined
  remarks: string
}

interface FormState {
  [memberId: string]: RowState
}

export const AttendancePage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const scheduleId = searchParams.get('scheduleId')
  const { user } = useAuth()

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [assignedMembers, setAssignedMembers] = useState<Member[]>([])
  
  // Local Form state
  const [formState, setFormState] = useState<FormState>({})
  const [originalState, setOriginalState] = useState<FormState>({})
  
  // Page state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [postModalOpen, setPostModalOpen] = useState(false)

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
      const assignedIds = matchedSchedule.assignedMembers || []
      const assignedProfiles = allMembers.filter(m => assignedIds.includes(m.id))
      setAssignedMembers(assignedProfiles)

      // 4. Fetch existing attendance records
      const records = await attendanceService.getAttendanceForSession(sessionDoc.id)
      
      // 5. Initialize form state
      const initialFormState: FormState = {}
      assignedProfiles.forEach((m) => {
        const record = records.find(r => r.memberId === m.id)
        initialFormState[m.id] = {
          id: record?.id,
          status: record?.status || undefined,
          remarks: record?.remarks || ''
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
      schedule.assignedMembers.forEach((memberId) => {
        if (next[memberId]) {
          next[memberId] = {
            ...next[memberId],
            status: action === 'clear' ? undefined : action
          }
        } else {
          next[memberId] = {
            status: action === 'clear' ? undefined : action,
            remarks: ''
          }
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

    // Ensure all assigned members have a status marked
    const unselectedMembers = assignedMembers.filter(
      m => !formState[m.id] || formState[m.id].status === undefined
    )
    
    if (unselectedMembers.length > 0) {
      setError('Please select attendance status for all assigned servers before saving.')
      return
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const inputs = assignedMembers.map((m) => ({
        id: formState[m.id]?.id,
        memberId: m.id,
        status: formState[m.id].status as AttendanceStatus,
        remarks: formState[m.id].remarks
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

  // Toggle session locked state
  const handleToggleLock = async () => {
    if (!session) return

    const nextLocked = !session.locked
    const promptMessage = nextLocked
      ? 'Are you sure you want to finalize and lock attendance? You will not be able to modify records unless unlocked.'
      : 'Are you sure you want to unlock this session for edits?'

    if (!window.confirm(promptMessage)) return

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
      
      // Reload session
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError('Failed to update session lock state.')
    } finally {
      setSaving(false)
    }
  }

  // Intercept back action to check dirty state
  const handleBackNavigation = (e: React.MouseEvent) => {
    if (isDirty) {
      const discard = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!discard) {
        e.preventDefault()
      }
    }
  }

  // Live Summary Calculation

  const computedSummary = calculateAttendanceSummary(
    assignedMembers
      .map(m => formState[m.id]?.status)
      .filter((status): status is AttendanceStatus => status !== undefined)
      .map(status => ({ status }))
  )
  computedSummary.total = assignedMembers.length // keep assigned count as baseline

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3 bg-gray-950/10 rounded-lg border border-gray-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
        <span className="text-xs text-gray-500">Loading attendance data...</span>
      </div>
    )
  }

  if (!scheduleId || error === 'Schedule service record not found.') {
    return (
      <div className="py-16 text-center rounded-lg border border-gray-800 bg-gray-950/20 max-w-lg mx-auto">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <h3 className="mt-2 text-sm font-bold text-white">No schedule selected</h3>
        <p className="mt-1 text-xs text-gray-500">Please select an active schedule from the panel to record attendance.</p>
        <div className="mt-4">
          <Link
            to="/schedules"
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
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
          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1"
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
          onGeneratePost={() => setPostModalOpen(true)}
          isSaving={saving}
        />
      )}

      {/* Notifications */}
      {error && (
        <div className="rounded border border-red-900 bg-red-950/40 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded border border-green-900 bg-green-950/40 p-4 text-sm text-green-400">
          {successMsg}
        </div>
      )}

      {/* Form Area */}
      <Card>
        <div className="divide-y divide-gray-900">
          {assignedMembers.length > 0 ? (
            assignedMembers.map((member) => (
              <AttendanceRow
                key={member.id}
                member={member}
                status={formState[member.id]?.status}
                remarks={formState[member.id]?.remarks || ''}
                onStatusChange={(status) => handleRowStatusChange(member.id, status)}
                onRemarksChange={(remarks) => handleRowRemarksChange(member.id, remarks)}
                disabled={saving || (session?.locked ?? false)}
              />
            ))
          ) : (
            <div className="py-12 text-center text-sm text-gray-500">
              No members are assigned to this service schedule. Select "Assign Servers" in the schedules page to populate.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {assignedMembers.length > 0 && !(session?.locked ?? false) && (
          <div className="flex items-center justify-end p-4 border-t border-gray-900 bg-gray-950/20">
            {isDirty && (
              <span className="text-xxs text-yellow-500 font-semibold mr-4 animate-pulse">
                ● You have unsaved changes
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving changes...' : 'Save Attendance Records'}
            </button>
          </div>
        )}
      </Card>

      {schedule && (
        <CommunityPostModal
          isOpen={postModalOpen}
          onClose={() => setPostModalOpen(false)}
          schedule={schedule}
          assignedMembers={assignedMembers}
          formState={formState}
        />
      )}
    </div>
  )
}
