import React, { useState } from 'react'
import { eventTaskService } from '@/services/eventTaskService'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal } from '@/components/Dialog'
import type { EventTask, Priority, TaskStatus, EventAssignment } from '@/types/event'

interface TaskFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  existingTask?: EventTask
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, onClose, onSaved, eventId, existingTask }) => {
  const { profile, canAction } = useAuth()
  
  const canEdit = !existingTask 
    ? true 
    : canAction('canUpdateAnyTask')

  const [title, setTitle] = useState(existingTask?.title || '')
  const [description, setDescription] = useState(existingTask?.description || '')
  const [priority, setPriority] = useState<Priority>(existingTask?.priority || 'Medium')
  const [status, setStatus] = useState<TaskStatus>(existingTask?.status || 'Not Started')
  const [startDate, setStartDate] = useState(existingTask?.startDate || '')
  const [dueDate, setDueDate] = useState(existingTask?.dueDate || '')
  const [assignedMemberName, setAssignedMemberName] = useState(existingTask?.assignedMemberName || '')
  const [assignments, setAssignments] = useState<EventAssignment[]>([])
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  React.useEffect(() => {
    if (isOpen) {
      setTitle(existingTask?.title || '')
      setDescription(existingTask?.description || '')
      setPriority(existingTask?.priority || 'Medium')
      setStatus(existingTask?.status || 'Not Started')
      setStartDate(existingTask?.startDate || '')
      setDueDate(existingTask?.dueDate || '')
      setAssignedMemberName(existingTask?.assignedMemberName || '')
      setError(null)
      
      // Clear unread status if it's assigned to the current user
      if (existingTask && existingTask.unreadByAssignee && existingTask.assignedMemberName === profile?.displayName) {
        eventTaskService.updateTask(existingTask.id, { unreadByAssignee: false }, profile?.email || 'System').catch(err => {
          console.error('Failed to mark task as read:', err)
        })
      }
    }
  }, [isOpen, existingTask, profile])

  React.useEffect(() => {
    if (isOpen && eventId) {
      eventAssignmentService.getAssignmentsByEventId(eventId).then(data => {
        setAssignments(data)
      }).catch(err => console.error(err))
    }
  }, [isOpen, eventId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Task title is required.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (existingTask?.id) {
        await eventTaskService.updateTask(existingTask.id, {
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          startDate: startDate || null,
          dueDate: dueDate || null,
          assignedMemberName: assignedMemberName || null
        }, profile?.email || 'System')
      } else {
        await eventTaskService.createTask({
          eventId,
          title: title.trim(),
          description: description.trim(),
          priority,
          status,
          dueDate,
          assignedMemberUid: null,
          assignedMemberName: assignedMemberName || null,
          assignedRoleId: null,
          assignedRoleName: null,
          dependsOnTaskId: null,
          startDate: startDate || null,
          estimatedHours: null,
          completedDate: null,
          progressPercent: 0,
          createdByUid: profile?.uid || 'system',
          createdByName: profile?.displayName || profile?.email || 'System'
        }, profile?.email || 'System')
      }
      
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!existingTask?.id) return
    setSubmitting(true)
    setError(null)
    try {
      await eventTaskService.deleteTask(existingTask.id, profile?.email || 'System')
      setShowDeleteConfirm(false)
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to delete task. Please try again.')
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      
      <div className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-xl z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">{existingTask ? 'Edit Task' : 'Create Task'}</h3>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Task Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" placeholder="e.g. Book the caterer" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit || submitting} rows={3} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-gray-50 disabled:text-gray-500" placeholder="Task details..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500">
                  <option value="Not Started">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Waiting">Waiting</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Assign To</label>
                {canEdit && profile?.displayName && (
                  <button type="button" onClick={() => setAssignedMemberName(profile.displayName!)} className="text-[10px] text-blue-600 font-bold hover:text-blue-800 cursor-pointer">
                    + Assign to me
                  </button>
                )}
              </div>
              <select value={assignedMemberName} onChange={(e) => setAssignedMemberName(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-50 disabled:text-gray-500">
                <option value="">-- Unassigned --</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.memberName}>
                    {a.memberName} {a.eventRoleName ? `(${a.eventRoleName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-100 flex justify-between gap-2 bg-gray-50 rounded-b-2xl">
          <div>
            {existingTask && canAction('canDeleteTasks') && (
              <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={submitting} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 focus:outline-none disabled:opacity-50 shadow-sm transition-colors cursor-pointer">
                Delete Task
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50 shadow-sm transition-colors cursor-pointer">
              {canEdit ? 'Cancel' : 'Close'}
            </button>
            {canEdit && (
              <button type="submit" form="taskForm" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 flex items-center shadow-sm transition-colors cursor-pointer">
                {submitting ? 'Saving...' : 'Save Task'}
              </button>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        message="Are you sure you want to delete this task? This action cannot be undone."
        confirmLabel="Delete Task"
        variant="danger"
        loading={submitting}
      />
    </div>
  )
}
