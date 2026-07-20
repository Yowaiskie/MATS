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
  isOtherServer?: boolean
  onRemove?: () => void
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
  member,
  status,
  remarks,
  onStatusChange,
  onRemarksChange,
  disabled,
  isOtherServer = false,
  onRemove,
}) => {
  const [showRemarksInput, setShowRemarksInput] = useState(!!remarks)

  const statusOptions: { value: AttendanceStatus; label: string; activeColor: string }[] = [
    { value: 'present', label: 'Present', activeColor: 'bg-green-600 border-green-600 text-white font-bold' },
    { value: 'late', label: 'Late', activeColor: 'bg-yellow-500 border-yellow-500 text-white font-bold' },
    { value: 'absent', label: 'Absent', activeColor: 'bg-red-600 border-red-600 text-white font-bold' },
    { value: 'excused', label: 'Excused', activeColor: 'bg-gray-500 border-gray-500 text-white font-bold' },
    { value: 'observer', label: 'Observer', activeColor: 'bg-purple-600 border-purple-600 text-white font-bold' },
    { value: 'alumni', label: 'Alumni', activeColor: 'bg-teal-600 border-teal-600 text-white font-bold' },
  ]

  return (
    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-blue-50/40 transition-colors">
      {/* Member Details */}
      <div className="flex-1 min-w-[200px]">
        <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          {getFullName(member)}
          {isOtherServer && (
            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 border border-amber-200 text-amber-600">
              Other Server
            </span>
          )}
        </span>
        <span className="text-[11px] text-blue-600 uppercase tracking-wider font-medium">
          {member.rank}
        </span>
      </div>

      {/* Input Options Column */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
        {/* Toggle Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {statusOptions.map((opt) => {
            const isActive = status === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => !disabled && onStatusChange(opt.value)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                  isActive 
                    ? opt.activeColor + ' shadow-sm' 
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-gray-50 disabled:opacity-50'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Remarks Toggle Button */}
          <div>
            <button
              type="button"
              onClick={() => setShowRemarksInput(prev => !prev)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold tracking-wide transition-colors cursor-pointer ${
                showRemarksInput || remarks
                  ? 'border-blue-200 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {remarks ? 'Has Remarks' : 'Add Remarks'}
            </button>
          </div>

          {/* Remove Button for Other Server */}
          {isOtherServer && !disabled && onRemove && (
            <div>
              <button
                type="button"
                onClick={onRemove}
                className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[11px] font-bold tracking-wide text-red-600 transition-all cursor-pointer shadow-sm"
                title="Remove this server from attendance list"
              >
                Remove
              </button>
            </div>
          )}
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
            className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            placeholder="e.g. Excused due to exam"
          />
        </div>
      )}
    </div>
  )
}
