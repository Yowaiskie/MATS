import React, { useState, useEffect } from 'react'
import { eventTaskService } from '@/services/eventTaskService'
import type { EventTask } from '@/types/event'
import { Card } from '@/components/Card'

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
      <Card className="p-8 text-center text-gray-500 border border-gray-200 shadow-xs">
        Loading timeline...
      </Card>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center text-gray-500 border border-gray-200 shadow-xs">
        No tasks exist yet. Add tasks with dates to see them on the timeline.
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Project Timeline</h2>
          <p className="text-sm text-gray-500">A chronological view of all scheduled tasks.</p>
        </div>
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        <div className="relative border-l-2 border-blue-100 ml-6 my-8 space-y-8">
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
                <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-sm ${
                  isDone ? 'bg-green-500' : 'bg-blue-500'
                }`} />

                <div className={`p-4 rounded-xl border ${isDone ? 'bg-gray-50 border-gray-100 opacity-75' : 'bg-white border-gray-200 shadow-xs'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className={`font-bold ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col sm:items-end text-sm">
                      <span className={`font-semibold ${hasDate ? 'text-blue-600' : 'text-gray-400'}`}>
                        {dateDisplay}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 mt-2 rounded-full text-[10px] font-bold uppercase w-fit ${
                        task.status === 'Completed' ? 'bg-green-100 text-green-700'
                        : task.status === 'In Progress' ? 'bg-blue-100 text-blue-700'
                        : task.status === 'Waiting' ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-700'
                      }`}>
                        {task.status}
                      </span>
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
