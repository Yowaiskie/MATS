import React, { useState } from 'react'
import type { Schedule } from '@/types/schedule'
import { formatTime12Hour } from '@/utils/scheduleUtils'

interface CollapsibleScheduleListProps {
  scheduleIds: string[]
  schedulesMap: Map<string, Schedule>
  maxInitialDisplay?: number
  compact?: boolean
  className?: string
}

export const CollapsibleScheduleList: React.FC<CollapsibleScheduleListProps> = ({
  scheduleIds,
  schedulesMap,
  maxInitialDisplay = 2,
  compact = false,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!scheduleIds || scheduleIds.length === 0) {
    return (
      <span className="text-xs text-slate-400 italic">No schedules attached</span>
    )
  }

  const hasMore = scheduleIds.length > maxInitialDisplay
  const displayedScheduleIds = isExpanded ? scheduleIds : scheduleIds.slice(0, maxInitialDisplay)
  const remainingCount = scheduleIds.length - maxInitialDisplay

  const renderItem = (scheduleId: string) => {
    const sched = schedulesMap.get(scheduleId)
    if (!sched) {
      return (
        <div 
          key={scheduleId} 
          className={`bg-slate-50 border border-slate-200/80 rounded-xl text-slate-500 italic ${
            compact ? 'p-1.5 text-[11px]' : 'p-2 text-xs'
          }`}
        >
          Schedule #{scheduleId.substring(0, 8)}
        </div>
      )
    }

    const timeStr = sched.startTime ? (
      sched.endTime 
        ? `${formatTime12Hour(sched.startTime)} - ${formatTime12Hour(sched.endTime)}` 
        : formatTime12Hour(sched.startTime)
    ) : ''

    if (compact) {
      return (
        <div key={scheduleId} className="text-xs bg-slate-50 p-2 rounded-xl border border-slate-200/80 space-y-0.5">
          <div className="font-bold text-slate-900 leading-tight truncate">{sched.title || 'Church Service'}</div>
          <div className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1.5 flex-wrap">
            <span>{sched.date}</span>
            {timeStr && <span>• {timeStr}</span>}
          </div>
        </div>
      )
    }

    return (
      <div key={scheduleId} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-1">
        <div className="text-xs font-black text-slate-900">{sched.title || 'Church Service'}</div>
        <div className="text-[11px] font-semibold text-indigo-600 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{sched.date}</span>
          </span>
          {timeStr && (
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{timeStr}</span>
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {displayedScheduleIds.map(sId => renderItem(sId))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-lg border border-indigo-200/60 transition-colors cursor-pointer"
        >
          {isExpanded ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
              </svg>
              <span>Show less</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              <span>See more (+{remainingCount} more)</span>
            </>
          )}
        </button>
      )}
    </div>
  )
}
