import React, { useState } from 'react'
import type { Member } from '@/types/member'
import type { AttendanceStatus } from '@/types/attendance'
import { getFullName } from '@/utils/member'

interface AttendanceRowProps {
  member: Member
  status: AttendanceStatus | undefined
  remarks: string
  onStatusChange: (status: AttendanceStatus) => void
  onRemarksChange: (remarks: string) => void
  disabled: boolean
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  member,
  status,
  remarks,
  onStatusChange,
  onRemarksChange,
  disabled,
}) => {
  const [showRemarksInput, setShowRemarksInput] = useState(!!remarks)

  const statusOptions: { value: AttendanceStatus; label: string; activeColor: string }[] = [
    { value: 'present', label: 'Present', activeColor: 'bg-green-600 border-green-600 text-white font-bold' },
    { value: 'late', label: 'Late', activeColor: 'bg-yellow-600 border-yellow-600 text-white font-bold' },
    { value: 'absent', label: 'Absent', activeColor: 'bg-red-600 border-red-600 text-white font-bold' },
    { value: 'excused', label: 'Excused', activeColor: 'bg-gray-600 border-gray-600 text-white font-bold' },
  ]

  return (
    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-900/10 transition-colors">
      {/* Member Details */}
      <div className="flex-1 min-w-[200px]">
        <span className="text-sm font-semibold text-white block">
          {getFullName(member)}
        </span>
        <span className="text-xxs text-indigo-400 uppercase tracking-wider">
          {member.rank}
        </span>
      </div>

      {/* Input Options Column */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Toggle Pills */}
        <div className="flex items-center border border-gray-800 bg-gray-950 rounded overflow-hidden">
          {statusOptions.map((opt) => {
            const isActive = status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onStatusChange(opt.value)}
                disabled={disabled}
                className={`px-3 py-1.5 text-xxs font-semibold uppercase tracking-wider border-r border-gray-850 last:border-r-0 transition-colors ${
                  isActive 
                    ? opt.activeColor 
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-900/40 disabled:opacity-50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Remarks Toggle Button */}
        <div>
          <button
            type="button"
            onClick={() => setShowRemarksInput(prev => !prev)}
            className={`px-2.5 py-1.5 rounded border text-xxs font-semibold tracking-wide transition-colors ${
              showRemarksInput || remarks
                ? 'border-indigo-800 bg-indigo-950/20 text-indigo-400'
                : 'border-gray-850 bg-gray-950 text-gray-500 hover:text-gray-300'
            }`}
          >
            {remarks ? 'Has Remarks' : 'Add Remarks'}
          </button>
        </div>
      </div>

      {/* Collapsed Remarks Textfield */}
      {showRemarksInput && (
        <div className="w-full md:w-64 mt-2 md:mt-0">
          <input
            type="text"
            value={remarks}
            onChange={(e) => onRemarksChange(e.target.value)}
            disabled={disabled}
            className="block w-full rounded border border-gray-850 bg-gray-950 px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            placeholder="e.g. Excused due to exam"
          />
        </div>
      )}
    </div>
  )
}
