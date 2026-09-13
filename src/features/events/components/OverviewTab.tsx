import React, { useState, useEffect } from 'react'
import { eventTaskService } from '@/services/eventTaskService'
import type { Event, EventTask, EventAssignment } from '@/types/event'
import { Card, Loading, StatusBadge } from '@/components'
import { eventAssignmentService } from '@/services/eventAssignmentService'

interface Props {
  event: Event
}

export const OverviewTab: React.FC<Props> = ({ event }) => {
  const [tasks, setTasks] = useState<EventTask[]>([])
  const [assignments, setAssignments] = useState<EventAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [taskData, teamData] = await Promise.all([
          eventTaskService.getTasksByEventId(event.id),
          eventAssignmentService.getAssignmentsByEventId(event.id)
        ])
        setTasks(taskData)
        setAssignments(teamData)
      } catch (err) {
        console.error('Failed to load overview data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [event.id])

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200 shadow-2xs">
        <Loading variant="spinner" label="Calculating project metrics..." />
      </div>
    )
  }

  const completedTasks = tasks.filter(t => t.status === 'Completed').length
  const totalTasks = tasks.length
  const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Overall Progress</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900">{progressPercent}%</span>
            <span className="text-xs font-semibold text-slate-500 mb-1">completed</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 mt-4 overflow-hidden">
            <div 
              className={`h-2.5 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </Card>

        <Card className="p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tasks Status</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900">{completedTasks}</span>
            <span className="text-xl sm:text-2xl font-black text-slate-400">/ {totalTasks}</span>
            <span className="text-xs font-semibold text-slate-500 mb-1 ml-1">tasks</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-4">
            {tasks.filter(t => t.status === 'In Progress').length} in progress, {tasks.filter(t => t.status === 'Not Started').length} to do
          </p>
        </Card>

        <Card className="p-6 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team Size</h3>
          <div className="flex items-end gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900">{assignments.length}</span>
            <span className="text-xs font-semibold text-slate-500 mb-1">members</span>
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-4">
            Led by {event.headName}
          </p>
        </Card>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border border-slate-200/80 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Event Details</h3>
          <dl className="space-y-3 text-xs sm:text-sm">
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <dt className="font-semibold text-slate-500">Location</dt>
              <dd className="font-bold text-slate-900 text-right">{event.location || 'No location set'}</dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <dt className="font-semibold text-slate-500">Start</dt>
              <dd className="font-bold text-slate-900 text-right">
                {event.startDate} {event.startTime ? `@ ${event.startTime}` : ''}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5">
              <dt className="font-semibold text-slate-500">End</dt>
              <dd className="font-bold text-slate-900 text-right">
                {event.endDate ? `${event.endDate} ${event.endTime ? `@ ${event.endTime}` : ''}` : '-'}
              </dd>
            </div>
            <div className="flex justify-between border-b border-slate-100 pb-2.5 items-center">
              <dt className="font-semibold text-slate-500">Priority</dt>
              <dd className="font-bold text-slate-900 text-right">
                <StatusBadge status={event.priority} size="sm" />
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6 border border-slate-200/80 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Description</h3>
          <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed font-medium">
            {event.description || 'No description provided.'}
          </p>
        </Card>
      </div>
    </div>
  )
}

