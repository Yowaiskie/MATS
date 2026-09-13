import React, { useState, useRef, useEffect } from 'react'
import type { EventTask, TaskStatus } from '@/types/event'

interface TaskCardProps {
  task: EventTask
  onClick: (task: EventTask) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  canAssignToMe?: boolean
  onAssignToMe?: (e: React.MouseEvent, taskId: string) => void
  onStatusChange?: (e: any, taskId: string, newStatus: TaskStatus) => void
}

const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string; dot: string }[] = [
  { value: 'Not Started', label: 'To Do', dot: 'bg-slate-400' },
  { value: 'In Progress', label: 'In Progress', dot: 'bg-blue-500' },
  { value: 'Waiting', label: 'Waiting', dot: 'bg-amber-500' },
  { value: 'Completed', label: 'Completed', dot: 'bg-emerald-500' },
  { value: 'Cancelled', label: 'Cancelled', dot: 'bg-rose-400' }
]

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart, canAssignToMe, onAssignToMe, onStatusChange }) => {
  const [isStatusOpen, setIsStatusOpen] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setIsStatusOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsStatusOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const priorityColors = {
    Low: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    Medium: 'bg-blue-50 text-blue-700 border-blue-200/80',
    High: 'bg-amber-50 text-amber-700 border-amber-200/80',
    Critical: 'bg-rose-50 text-rose-700 border-rose-200/80'
  }

  const priorityBorders = {
    Low: 'border-l-[4px] border-l-emerald-500',
    Medium: 'border-l-[4px] border-l-blue-500',
    High: 'border-l-[4px] border-l-amber-500',
    Critical: 'border-l-[4px] border-l-rose-500'
  }

  const statusColors: Record<string, string> = {
    'Not Started': 'bg-white border-slate-200/80',
    'In Progress': 'bg-blue-50/30 border-blue-200/80',
    'Waiting': 'bg-amber-50/30 border-amber-200/80',
    'Completed': 'bg-emerald-50/30 border-emerald-200/80',
    'Cancelled': 'bg-slate-50 border-slate-200'
  }

  const currentStatusObj = TASK_STATUS_OPTIONS.find(s => s.value === task.status) || TASK_STATUS_OPTIONS[0]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id!)}
      onClick={() => onClick(task)}
      className={`${statusColors[task.status] || 'bg-white border-slate-200'} ${priorityBorders[task.priority] || ''} p-3.5 rounded-xl border shadow-2xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all select-none`}
    >
      <div className="flex justify-between items-center mb-2 gap-2">
        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${priorityColors[task.priority] || priorityColors.Medium}`}>
          {task.priority}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {onStatusChange && (
            <div className="relative" ref={statusRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setIsStatusOpen(!isStatusOpen)}
                className={`text-[10px] font-bold text-slate-700 bg-white/90 border rounded-lg pl-2 pr-2 py-0.5 cursor-pointer flex items-center gap-1.5 shadow-2xs transition ${
                  isStatusOpen
                    ? 'border-blue-500 ring-2 ring-blue-500/20 text-blue-900 bg-blue-50/40'
                    : 'border-slate-300/80 hover:border-slate-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatusObj.dot}`} />
                <span>{currentStatusObj.label}</span>
                <svg
                  className={`w-3 h-3 text-slate-400 transition-transform ${isStatusOpen ? 'rotate-180 text-blue-600' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {isStatusOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 p-1 min-w-[120px] space-y-0.5 animate-in fade-in zoom-in-95">
                  {TASK_STATUS_OPTIONS.map((opt) => {
                    const isSelected = opt.value === task.status
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={(e) => {
                          setIsStatusOpen(false)
                          onStatusChange(e, task.id!, opt.value)
                        }}
                        className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-950'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${opt.dot}`} />
                          <span>{opt.label}</span>
                        </div>
                        {isSelected && (
                          <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {task.dueDate && (
            <span className="text-[10px] text-slate-500 font-semibold hidden sm:inline">
              Due: {task.dueDate}
            </span>
          )}
        </div>
      </div>
      
      <h4 className="text-xs font-bold text-slate-900 leading-snug mb-1">{task.title}</h4>
      
      {task.description && (
        <p className="text-[11px] text-slate-500 line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
        <div className="flex -space-x-1 overflow-hidden items-center gap-2">
          {task.assignedMemberName ? (
            <span className="text-[10px] text-slate-700 font-bold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
              {task.assignedMemberName}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium italic">Unassigned</span>
          )}
          {canAssignToMe && onAssignToMe && (
            <button
              onClick={(e) => onAssignToMe(e, task.id!)}
              className="text-[9px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-colors cursor-pointer"
            >
              Take Over
            </button>
          )}
        </div>
        
        <div className="flex items-center text-slate-400 text-xs">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
