import React from 'react'
import type { EventTask } from '@/types/event'

interface TaskCardProps {
  task: EventTask
  onClick: (task: EventTask) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  canAssignToMe?: boolean
  onAssignToMe?: (e: React.MouseEvent, taskId: string) => void
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart, canAssignToMe, onAssignToMe }) => {
  const priorityColors = {
    Low: 'bg-green-100 text-green-800 border border-green-200',
    Medium: 'bg-blue-100 text-blue-800 border border-blue-200',
    High: 'bg-orange-100 text-orange-800 border border-orange-200',
    Critical: 'bg-red-100 text-red-800 border border-red-200'
  }

  const priorityBorders = {
    Low: 'border-l-[4px] border-l-green-400',
    Medium: 'border-l-[4px] border-l-blue-400',
    High: 'border-l-[4px] border-l-orange-400',
    Critical: 'border-l-[4px] border-l-red-500'
  }

  const statusColors: Record<string, string> = {
    'Not Started': 'bg-white border-gray-200',
    'In Progress': 'bg-blue-50 border-blue-200',
    'Waiting': 'bg-orange-50 border-orange-200',
    'Completed': 'bg-green-50 border-green-200',
    'Cancelled': 'bg-gray-50 border-gray-300'
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id!)}
      onClick={() => onClick(task)}
      className={`${statusColors[task.status] || 'bg-white border-gray-200'} ${priorityBorders[task.priority] || ''} p-3 rounded-lg border shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${priorityColors[task.priority] || priorityColors.Medium}`}>
          {task.priority}
        </span>
        {task.dueDate && (
          <span className="text-[10px] text-gray-500 font-medium">
            Due: {task.dueDate}
          </span>
        )}
      </div>
      
      <h4 className="text-sm font-bold text-gray-900 leading-tight mb-1">{task.title}</h4>
      
      {task.description && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3">{task.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <div className="flex -space-x-1 overflow-hidden items-center gap-2">
          {task.assignedMemberName ? (
            <span className="text-[10px] text-gray-700 font-bold bg-gray-100 border border-gray-200 px-2 py-1 rounded-md">
              {task.assignedMemberName}
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium italic">Unassigned</span>
          )}
          {canAssignToMe && onAssignToMe && (
            <button
              onClick={(e) => onAssignToMe(e, task.id!)}
              className="text-[9px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
            >
              + Take Over
            </button>
          )}
        </div>
        
        {/* Progress indicator for checklists if any could go here, for now static icon */}
        <div className="flex items-center text-gray-400 text-xs">
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
      </div>
    </div>
  )
}
