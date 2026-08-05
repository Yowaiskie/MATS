import React from 'react'
import type { EventTask } from '@/types/event'

interface TaskCardProps {
  task: EventTask
  onClick: (task: EventTask) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart }) => {
  const priorityColors = {
    Low: 'bg-gray-100 text-gray-800',
    Medium: 'bg-blue-100 text-blue-800',
    High: 'bg-orange-100 text-orange-800',
    Critical: 'bg-red-100 text-red-800'
  }

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id!)}
      onClick={() => onClick(task)}
      className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition-shadow"
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
        <div className="flex -space-x-1 overflow-hidden">
          {task.assignedMemberName ? (
            <div
              className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-800"
              title={task.assignedMemberName}
            >
              {task.assignedMemberName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium italic">Unassigned</span>
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
