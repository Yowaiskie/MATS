import React, { useState } from 'react'
import type { Schedule } from '@/types/schedule'
import type { Member } from '@/types/member'
import type { AttendanceStatus } from '@/types/attendance'
import { getFullName } from '@/utils/member'
import { calculateAttendanceSummary, calculateAttendanceRate } from '@/utils/attendance'

interface RowState {
  id?: string
  status: AttendanceStatus | undefined
  remarks: string
}

interface FormState {
  [memberId: string]: RowState
}

interface CommunityPostModalProps {
  isOpen: boolean
  onClose: () => void
  schedule: Schedule
  assignedMembers: Member[]
  formState: FormState
}

export const CommunityPostModal: React.FC<CommunityPostModalProps> = ({
  isOpen,
  onClose,
  schedule,
  assignedMembers,
  formState,
}) => {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  // Calculate totals
  const activeRecords = assignedMembers
    .map(m => formState[m.id]?.status)
    .filter((status): status is AttendanceStatus => status !== undefined)
    .map(status => ({ status }))
  
  const summary = calculateAttendanceSummary(activeRecords)
  summary.total = assignedMembers.length
  const rate = calculateAttendanceRate(summary)

  // Segment members by attendance status
  const presentList: string[] = []
  const lateList: string[] = []
  const absentList: string[] = []
  const excusedList: string[] = []

  assignedMembers.forEach((member) => {
    const state = formState[member.id]
    const status = state?.status
    const nameStr = `${getFullName(member)} (${member.rank})`

    if (status === 'present') {
      presentList.push(`• ${nameStr}`)
    } else if (status === 'late') {
      lateList.push(`• ${nameStr}`)
    } else if (status === 'absent') {
      absentList.push(`• ${nameStr}`)
    } else if (status === 'excused') {
      const remarksStr = state.remarks ? ` - Reason: ${state.remarks}` : ''
      excusedList.push(`• ${nameStr}${remarksStr}`)
    }
  })

  // Build the text message block
  const postText = `⛪ MINISTRY OF ALTAR SERVERS (MATS)
Attendance Report: ${schedule.title}
Date: ${schedule.date} (${schedule.startTime} - ${schedule.endTime})

📊 ATTENDANCE SUMMARY:
• Total Assigned: ${summary.total}
• Present: ${summary.present}
• Late: ${summary.late}
• Absent: ${summary.absent}
• Excused: ${summary.excused}
• Attendance Rate: ${summary.total > 0 ? `${rate}%` : '0%'}

✅ PRESENT (${summary.present}):
${presentList.length > 0 ? presentList.join('\n') : 'None'}

⚠️ LATE (${summary.late}):
${lateList.length > 0 ? lateList.join('\n') : 'None'}

❌ ABSENT (${summary.absent}):
${absentList.length > 0 ? absentList.join('\n') : 'None'}

ℹ️ EXCUSED (${summary.excused}):
${excusedList.length > 0 ? excusedList.join('\n') : 'None'}
`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(postText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-lg rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-850">
          <div>
            <h3 className="text-base font-bold text-white">Generate Facebook Post</h3>
            <p className="text-xs text-gray-400 mt-0.5">Copy formatted attendance text for group chat sharing.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Text Area Content */}
        <div className="mt-4 flex-1 overflow-hidden flex flex-col">
          <textarea
            readOnly
            value={postText}
            className="flex-1 w-full rounded border border-gray-850 bg-gray-900 p-4 text-xs font-mono text-gray-250 focus:outline-none resize-none min-h-[300px] overflow-y-auto"
          />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-850 mt-4">
          <button
            onClick={onClose}
            className="rounded border border-gray-850 bg-transparent px-4 py-2 text-xs font-semibold hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleCopy}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  )
}
