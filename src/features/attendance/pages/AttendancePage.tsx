import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { attendanceService } from '@/services/attendanceService'
import { settingsService } from '@/services/settingsService'
import { useAuth } from '@/features/authentication/AuthContext'
import { Card, Button, EmptyState, useToast } from '@/components'
import { AttendanceHeader } from '../components/AttendanceHeader'
import { AttendanceRow } from '../components/AttendanceRow'
import { CommunityReportModal } from '../components/CommunityReportModal'
import { AddOtherServerModal } from '../components/AddOtherServerModal'
import { UnlockSessionModal } from '../components/UnlockSessionModal'
import { AssignmentModal } from '@/features/schedules/components/AssignmentModal'
import { generateCommunityReport } from '@/utils/communityReport'
import { getFullName } from '@/utils/member'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import { ORDER_GROUPS, ORDER_COLORS, getMemberOrders } from '@/types/member'
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
  const { toast } = useToast()
  const navigate = useNavigate()

  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([])
  const [session, setSession] = useState<AttendanceSession | null>(null)
  const [assignedMembers, setAssignedMembers] = useState<Member[]>([])
  const [otherServers, setOtherServers] = useState<Member[]>([])
  const [allMembersProfiles, setAllMembersProfiles] = useState<Member[]>([])
  const [addOtherServerOpen, setAddOtherServerOpen] = useState(false)
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  
  // Local Form state
  const [formState, setFormState] = useState<FormState>({})
  const [originalState, setOriginalState] = useState<FormState>({})
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([])
  
  // Page state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [template, setTemplate] = useState('')

  // Confirm dialog state
  const [confirmRemoveMember, setConfirmRemoveMember] = useState<{ id: string; name: string } | null>(null)
  const [lockConfirm, setLockConfirm] = useState<{ nextLocked: boolean } | null>(null)
  const [unlockPasswordModalOpen, setUnlockPasswordModalOpen] = useState(false)
  const [backConfirmOpen, setBackConfirmOpen] = useState(false)
  const [pendingNavTarget, setPendingNavTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrderGroup, setSelectedOrderGroup] = useState<string>('all')

  const displayMembers = useMemo(() => {
    const combined = [...assignedMembers, ...otherServers]
    return combined.filter(m => {
      // 1. Group Filter
      if (selectedOrderGroup !== 'all') {
        const orders = getMemberOrders(m.order)
        if (selectedOrderGroup === 'none') {
          if (orders.length > 0) return false
        } else if (!orders.includes(selectedOrderGroup)) {
          return false
        }
      }
      // 2. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matches =
          m.firstName.toLowerCase().includes(query) ||
          m.lastName.toLowerCase().includes(query) ||
          (m.middleName && m.middleName.toLowerCase().includes(query)) ||
          (m.nickname && m.nickname.toLowerCase().includes(query)) ||
          (m.order && m.order.toLowerCase().includes(query))
        if (!matches) return false
      }
      return true
    })
  }, [assignedMembers, otherServers, selectedOrderGroup, searchQuery])

  const orderGroupCounts = useMemo(() => {
    const combined = [...assignedMembers, ...otherServers]
    const counts: Record<string, number> = {
      all: combined.length,
      'Order of San Pedro': 0,
      'Order of San Juan': 0,
      'Order of San Tiago': 0,
      'Order of San Andres': 0,
      'Officers': 0,
      'Squires': 0,
      none: 0
    }
    combined.forEach(m => {
      const orders = getMemberOrders(m.order)
      if (orders.length === 0) {
        counts.none++
      } else {
        orders.forEach(ord => {
          if (counts[ord] !== undefined) {
            counts[ord]++
          } else {
            counts[ord] = (counts[ord] || 0) + 1
          }
        })
      }
    })
    return counts
  }, [assignedMembers, otherServers])

  // Initialize form state
  const isDirty = JSON.stringify(formState) !== JSON.stringify(originalState)
  const isMeetingSchedule = (schedule?.title || '').toLowerCase().includes('meeting')
    || (schedule?.title || '').toLowerCase().includes('assembly')

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

    try {
      // 1. Load target schedule & same-day schedules for conflict validation
      const matchedSchedule = await scheduleService.getScheduleById(scheduleId)
      
      if (!matchedSchedule) {
        setError('Schedule service record not found.')
        setLoading(false)
        return
      }
      setSchedule(matchedSchedule)

      const sameDaySchedules = await scheduleService.getSchedulesByDate(matchedSchedule.date)
      setAllSchedules(sameDaySchedules)

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

      const otherServerProfiles = allMembers.filter(
        (m) => otherServerMemberIds.includes(m.id) && !assignedIds.includes(m.id)
      )
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
        const currentStatus = prev[member.id]?.status
        if (action === 'clear') {
          next[member.id] = {
            ...next[member.id],
            status: undefined
          }
        } else if (currentStatus === undefined) {
          next[member.id] = {
            ...next[member.id],
            status: action
          }
        }
      })
      return next
    })
  }

  const handleAssignAll = async () => {
    if (!schedule) return
    setSaving(true)
    setError(null)
    try {
      const activeIds = allMembersProfiles
        .filter((m) => m.status === 'active')
        .map((m) => m.id)
      await scheduleService.assignMembers(schedule.id, activeIds, user?.email || 'Admin')
      await loadData()
      toast.success('Assigned All Servers', 'All active servers are now assigned to this schedule.')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to assign all active servers.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAssignments = async (targetScheduleId: string, assignedIds: string[]) => {
    setSaving(true)
    setError(null)
    try {
      await scheduleService.assignMembers(targetScheduleId, assignedIds, user?.email || 'Admin')
      setAssignmentOpen(false)
      await loadData()
      toast.success('Updated Assignments', 'Assigned servers updated successfully.')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to update assigned servers.')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveServerConfirmed = async () => {
    if (!confirmRemoveMember) return
    const { id: memberId, name: memberName } = confirmRemoveMember
    setConfirmRemoveMember(null)

    setSaving(true)
    setError(null)

    try {
      const isOther = formState[memberId]?.isOtherServer
      const recordId = formState[memberId]?.id

      // Delete Firestore attendance record immediately if exists
      if (recordId) {
        await attendanceService.deleteAttendanceRecord(recordId)
      }

      if (isOther) {
        setOtherServers((prev) => prev.filter((m) => m.id !== memberId))
      } else {
        setAssignedMembers((prev) => prev.filter((m) => m.id !== memberId))
        if (schedule) {
          const updatedAssigned = (schedule.assignedMembers || []).filter((id) => id !== memberId)
          setSchedule((prev) => (prev ? { ...prev, assignedMembers: updatedAssigned } : null))
          await scheduleService.assignMembers(schedule.id, updatedAssigned, user?.email || 'Admin')
        }
      }

      setFormState((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })

      setOriginalState((prev) => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })

      toast.success('Server Removed', `${memberName} was removed from this attendance list.`)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Failed to remove server. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Row state updates
  const handleRowStatusChange = (memberId: string, status: AttendanceStatus | undefined) => {
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

  // Save changes (Allows saving partial / draft attendance with blank members and without remarks)
  const handleSave = async () => {
    if (!session || !schedule) return

    const allSessionMembers = [...assignedMembers, ...otherServers]

    // Collect all members with a valid marked status
    const markedInputs = allSessionMembers
      .filter(m => formState[m.id] && formState[m.id].status !== undefined)
      .map(m => ({
        id: formState[m.id]?.id,
        memberId: m.id,
        status: formState[m.id].status as AttendanceStatus,
        remarks: formState[m.id].remarks || '',
        isOtherServer: formState[m.id].isOtherServer ?? false
      }))

    // Collect record IDs of members who were previously recorded but now set to blank/unselected
    const unselectedRecordIds = allSessionMembers
      .filter(m => (!formState[m.id] || formState[m.id].status === undefined) && formState[m.id]?.id)
      .map(m => formState[m.id].id!)

    setSaving(true)
    setError(null)

    try {
      if (markedInputs.length > 0) {
        await attendanceService.saveAttendanceRecords(
          session.id,
          schedule.id,
          schedule.date,
          markedInputs,
          user?.email || 'Admin',
          schedule.title
        )
      }

      // Delete removed other servers and any cleared records from Firestore
      const toDelete = [...pendingDeleteIds, ...unselectedRecordIds]
      if (toDelete.length > 0) {
        await Promise.all(
          toDelete.map(recordId => attendanceService.deleteAttendanceRecord(recordId))
        )
        setPendingDeleteIds([])
      }

      const allMarked = markedInputs.length === allSessionMembers.length
      if (allSessionMembers.length === 0) {
        toast.success('Attendance Saved', 'Session has no assigned servers.')
      } else if (allMarked) {
        toast.success('Attendance Saved', 'All attendance records have been successfully saved.')
      } else {
        toast.success('Attendance Draft Saved', `${markedInputs.length} of ${allSessionMembers.length} server(s) recorded. Remaining servers can be marked before finalization.`)
      }
      
      // Re-fetch updated records to refresh document IDs and reset baseline without full page reload
      const records = await attendanceService.getAttendanceForSession(session.id)
      const updatedFormState: FormState = { ...formState }
      allSessionMembers.forEach((m) => {
        const record = records.find(r => r.memberId === m.id)
        if (updatedFormState[m.id]) {
          updatedFormState[m.id].id = record?.id
        }
      })

      setFormState(updatedFormState)
      setOriginalState(JSON.parse(JSON.stringify(updatedFormState)))
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to save attendance records.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle session locked state
  const handleToggleLock = () => {
    if (!session) return
    if (session.locked) {
      // Unlocking requires account password verification!
      setUnlockPasswordModalOpen(true)
    } else {
      // Strict validation before finalizing: Ensure 100% of servers have an attendance status
      const allSessionMembers = [...assignedMembers, ...otherServers]
      const unselectedMembers = allSessionMembers.filter(
        m => !formState[m.id] || formState[m.id].status === undefined
      )
      
      if (unselectedMembers.length > 0) {
        const namesList = unselectedMembers.map(m => getFullName(m)).join(', ')
        setError(`Cannot finalize & lock session. ${unselectedMembers.length} server(s) still have a blank attendance status (${namesList}). Please mark all servers before finalization.`)
        return
      }

      setLockConfirm({ nextLocked: true })
    }
  }

  const handleExecuteUnlock = async () => {
    if (!session || !schedule) return
    setSaving(true)
    setError(null)
    try {
      const adminEmail = user?.email || 'Admin'
      await attendanceService.setSessionLockState(session.id, false, adminEmail, schedule.title)
      toast.success('Session Unlocked', 'Attendance session unlocked successfully.')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to unlock attendance session.')
    } finally {
      setSaving(false)
    }
  }

  const handleLockConfirmed = async () => {
    if (!session || !lockConfirm || !schedule) return
    const { nextLocked } = lockConfirm
    setLockConfirm(null)
    setSaving(true)
    setError(null)
    try {
      const adminEmail = user?.email || 'Admin'
      
      if (nextLocked) {
        // Validation before locking
        const allSessionMembers = [...assignedMembers, ...otherServers]
        const unselectedMembers = allSessionMembers.filter(
          m => !formState[m.id] || formState[m.id].status === undefined
        )
        
        if (unselectedMembers.length > 0) {
          const namesList = unselectedMembers.map(m => getFullName(m)).join(', ')
          setError(`Cannot finalize & lock session. Please select attendance status for: ${namesList}`)
          setSaving(false)
          return
        }

        // Auto-save unsaved changes before locking
        if (isDirty) {
          const inputs = allSessionMembers.map((m) => ({
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
            inputs,
            adminEmail,
            schedule.title
          )
        }
      }

      await attendanceService.setSessionLockState(session.id, nextLocked, adminEmail, schedule.title)
      toast.success(
        nextLocked ? 'Session Finalized & Locked' : 'Session Unlocked',
        nextLocked
          ? 'Attendance session finalized and locked successfully.'
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
    e.preventDefault()
    if (isDirty) {
      setPendingNavTarget(window.history.length > 1 ? '__BACK__' : '/schedules')
      setBackConfirmOpen(true)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/schedules')
    }
  }

  // Live Summary Calculation
  const computedSummary = calculateAttendanceSummary(
    ([...assignedMembers, ...otherServers])
      .map(m => formState[m.id]?.status)
      .filter((status): status is AttendanceStatus => status !== undefined)
      .map(status => ({ status }))
  )
  computedSummary.total = [...assignedMembers, ...otherServers].length

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
        {/* Search & Bulk Assign Actions Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search server name..."
              className="block w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-xs bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Quick Assign Action */}
          {!(session?.locked ?? false) && (
            <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setAssignmentOpen(true)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 px-3.5 py-2 text-xs font-bold text-purple-700 transition-all cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Edit Assigned Servers</span>
              </button>
              <button
                type="button"
                onClick={handleAssignAll}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 px-3.5 py-2 text-xs font-bold text-blue-700 transition-all cursor-pointer shadow-2xs"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Assign All Active Servers</span>
              </button>
            </div>
          )}
        </div>

        {/* Order Group Filter Pills Bar */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-4 py-3 border-b border-gray-100 bg-white">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Filter Order:</span>
          <button
            type="button"
            onClick={() => setSelectedOrderGroup('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedOrderGroup === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Orders ({orderGroupCounts.all})
          </button>

          {ORDER_GROUPS.map((grp) => {
            const count = orderGroupCounts[grp] || 0
            const isSelected = selectedOrderGroup === grp
            const activeStyle = ORDER_COLORS[grp]?.activeTab || 'bg-blue-600 border-blue-600 text-white shadow-xs'
            return (
              <button
                key={grp}
                type="button"
                onClick={() => setSelectedOrderGroup(grp)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${
                  isSelected
                    ? activeStyle
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {grp} ({count})
              </button>
            )
          })}

          {orderGroupCounts.none > 0 && (
            <button
              type="button"
              onClick={() => setSelectedOrderGroup('none')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${
                selectedOrderGroup === 'none'
                  ? 'bg-gray-700 border-gray-700 text-white shadow-xs'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              Unassigned ({orderGroupCounts.none})
            </button>
          )}
        </div>

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
                isMeetingSchedule={isMeetingSchedule}
                onRemove={() => setConfirmRemoveMember({ id: member.id, name: getFullName(member) })}
              />
            ))
          ) : (
            <div className="p-6">
              {searchQuery.trim() ? (
                <EmptyState
                  title="No Matching Servers"
                  description={`No active servers match search query "${searchQuery}".`}
                />
              ) : (
                <EmptyState
                  title="No Servers Assigned Yet"
                  description="No members are assigned to this service schedule. Add or assign servers now to start taking attendance."
                  action={
                    !(session?.locked ?? false)
                      ? {
                          label: 'Add / Assign Servers',
                          onClick: () => setAssignmentOpen(true),
                          icon: (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          ),
                        }
                      : undefined
                  }
                />
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {!(session?.locked ?? false) && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex-wrap gap-4">
            <div>
              {!isMeetingSchedule && (
                <Button
                  type="button"
                  variant="secondary"
                  size="dense"
                  onClick={() => setAddOtherServerOpen(true)}
                  disabled={saving}
                  icon={
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  }
                  className="!border-emerald-200 !bg-emerald-50/70 hover:!bg-emerald-100 !text-emerald-700"
                >
                  Add Other Server
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isDirty && (
                <span className="text-[11px] text-amber-600 font-semibold mr-2">
                  ● You have unsaved changes
                </span>
              )}
              {displayMembers.length > 0 && (
                <Button
                  type="button"
                  variant="primary"
                  size="dense"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  loading={saving}
                  loadingText="Saving changes..."
                  icon={
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                >
                  Save Attendance Records
                </Button>
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

      {schedule && !isMeetingSchedule && (
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

      <AssignmentModal
        isOpen={assignmentOpen}
        onClose={() => setAssignmentOpen(false)}
        schedule={schedule}
        activeMembers={allMembersProfiles.filter((m) => m.status === 'active' || m.status === 'suspended')}
        allSchedules={allSchedules}
        onSave={handleSaveAssignments}
      />

      {/* Confirm Remove Server Modal */}
      <ConfirmModal
        isOpen={!!confirmRemoveMember}
        onClose={() => setConfirmRemoveMember(null)}
        onConfirm={handleRemoveServerConfirmed}
        variant="danger"
        title="Remove Server from Attendance"
        message={`Are you sure you want to remove ${confirmRemoveMember?.name || 'this server'} from this attendance list?`}
        confirmLabel="Remove Server"
        loading={saving}
      />

      {/* Lock Confirm Modal (For Finalizing) */}
      <ConfirmModal
        isOpen={!!lockConfirm}
        onClose={() => setLockConfirm(null)}
        onConfirm={handleLockConfirmed}
        variant="danger"
        title="Finalize & Lock Session"
        message="Are you sure you want to finalize and lock attendance? You will not be able to modify records unless unlocked with your admin password."
        confirmLabel="Finalize & Lock"
        loading={saving}
      />

      {/* Password Required Unlock Modal */}
      {schedule && (
        <UnlockSessionModal
          isOpen={unlockPasswordModalOpen}
          onClose={() => setUnlockPasswordModalOpen(false)}
          onConfirmUnlock={handleExecuteUnlock}
          scheduleTitle={schedule.title}
        />
      )}

      {/* Unsaved Changes — Back Navigation Warning */}
      <ConfirmModal
        isOpen={backConfirmOpen}
        onClose={() => { setBackConfirmOpen(false); setPendingNavTarget(null) }}
        onConfirm={() => {
          setBackConfirmOpen(false)
          if (pendingNavTarget === '__BACK__') {
            navigate(-1)
          } else if (pendingNavTarget) {
            navigate(pendingNavTarget)
          } else {
            navigate('/schedules')
          }
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
    </div>
  )
}
