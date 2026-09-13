import React, { useState } from 'react'
import { eventTaskService } from '@/services/eventTaskService'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal, MemberSearchDropdown, CustomSelect, Button, useToast } from '@/components'
import type { EventTask, Priority, TaskStatus, EventAssignment } from '@/types/event'

interface TaskFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  eventId: string
  existingTask?: EventTask
  isHeadOrCreator?: boolean
}

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'Not Started', label: 'To Do' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Waiting', label: 'Waiting' },
  { value: 'Completed', label: 'Completed' }
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
  { value: 'Critical', label: 'Critical' }
]

export const TaskFormModal: React.FC<TaskFormModalProps> = ({ isOpen, onClose, onSaved, eventId, existingTask, isHeadOrCreator }) => {
  const { profile, canAction } = useAuth()
  const { toast } = useToast()
  
  const canEdit = !existingTask 
    ? true 
    : (isHeadOrCreator || canAction('canUpdateAnyTask'))

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
        toast.success('Task Updated', 'Event task updated successfully.')
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
        toast.success('Task Created', 'New task created successfully.')
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
      toast.success('Task Deleted', 'Task has been deleted successfully.')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={submitting ? undefined : onClose} />
      
      <div className="relative w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Task Management
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">{existingTask ? 'Edit Task' : 'Create New Task'}</h3>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="taskForm" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-800 p-3.5 rounded-2xl text-xs font-bold border border-rose-200 animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Task Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" placeholder="e.g. Coordinate venue setup and logistics" required />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!canEdit || submitting} rows={3} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" placeholder="Task details and instructions..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <CustomSelect
                  label="Status"
                  id="task-status-select"
                  options={STATUS_OPTIONS}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  disabled={!canEdit || submitting}
                />
              </div>
              <div>
                <CustomSelect
                  label="Priority"
                  id="task-priority-select"
                  options={PRIORITY_OPTIONS}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  disabled={!canEdit || submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit || submitting} className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 shadow-2xs" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Assign To</label>
                {canEdit && profile?.displayName && (
                  <button type="button" onClick={() => setAssignedMemberName(profile.displayName!)} className="text-[10px] text-indigo-600 font-extrabold hover:text-indigo-800 cursor-pointer">
                    Assign to me
                  </button>
                )}
              </div>
              <MemberSearchDropdown
                options={assignments.map(a => ({
                  id: a.id,
                  name: a.memberName,
                  subtitle: a.eventRoleName || undefined
                }))}
                value={assignedMemberName}
                mode="name"
                disabled={!canEdit || submitting}
                title="Assign Team Member"
                placeholder="-- Unassigned --"
                onChange={(val: string) => setAssignedMemberName(val)}
              />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-slate-100 flex justify-between gap-2 bg-white sticky bottom-0">
          <div>
            {existingTask && (isHeadOrCreator || canAction('canDeleteTasks')) && (
              <Button
                type="button"
                variant="danger"
                size="dense"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={submitting}
              >
                Delete Task
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              onClick={onClose}
              disabled={submitting}
            >
              {canEdit ? 'Cancel' : 'Close'}
            </Button>
            {canEdit && (
              <Button
                type="submit"
                form="taskForm"
                variant="primary"
                size="dense"
                loading={submitting}
              >
                Save Task
              </Button>
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

