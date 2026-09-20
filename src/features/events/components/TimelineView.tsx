import React, { useState, useEffect } from 'react'
import { eventTaskService } from '@/services/eventTaskService'
import type { EventTask } from '@/types/event'
import { Card, Loading, EmptyState, StatusBadge } from '@/components'

interface Props {
  eventId: string
}

export const TimelineView: React.FC<Props> = ({ eventId }) => {
  const [tasks, setTasks] = useState<EventTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = async () => {
    try {
      setLoading(true)
      const data = await eventTaskService.getTasksByEventId(eventId)
      
      // Sort tasks primarily by start date, then due date
      const sorted = data.sort((a, b) => {
        const dateA = a.startDate || a.dueDate || '9999-12-31'
        const dateB = b.startDate || b.dueDate || '9999-12-31'
        return dateA.localeCompare(dateB)
      })
      
      setTasks(sorted)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [eventId])

  if (loading) {
    return (
      <Card className="p-8 text-center text-slate-500 border border-slate-200/80 shadow-2xs">
        <div className="py-16">
          <Loading variant="spinner" label="Loading timeline..." />
        </div>
      </Card>
    )
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No scheduled tasks yet"
        description="Add tasks with start and due dates to visualize your event milestone schedule."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Project Timeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">A chronological schedule of all scheduled event tasks and milestones.</p>
        </div>
      </div>

      <Card className="p-0 border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="relative border-l-2 border-blue-200 ml-6 my-8 space-y-8">
          {tasks.map(task => {
            const hasDate = task.startDate || task.dueDate
            const dateDisplay = task.startDate && task.dueDate 
              ? `${task.startDate} to ${task.dueDate}`
              : task.startDate 
                ? `Starts ${task.startDate}`
                : task.dueDate 
                  ? `Due ${task.dueDate}`
                  : 'No dates set'

            const isDone = task.status === 'Completed'

            return (
              <div key={task.id} className="relative pl-6 pr-6">
                {/* Timeline Dot */}
                <span className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-2xs ${
                  isDone ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-blue-600 ring-2 ring-blue-500/20'
                }`} />

                <div className={`p-4 rounded-2xl border transition-all ${isDone ? 'bg-slate-50/60 border-slate-200/60 opacity-80' : 'bg-white border-slate-200 shadow-2xs'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className={`text-sm font-bold ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end text-xs shrink-0">
                      <span className={`font-bold ${hasDate ? 'text-blue-600' : 'text-slate-400'}`}>
                        {dateDisplay}
                      </span>
                      <div className="mt-1.5">
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

