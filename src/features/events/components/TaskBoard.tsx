import React, { useState, useEffect } from 'react'
import { Loading, Button, useToast } from '@/components'
import { eventTaskService } from '@/services/eventTaskService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { EventTask, TaskStatus } from '@/types/event'
import { TaskCard } from './TaskCard'
import { TaskFormModal } from './TaskFormModal'

interface TaskBoardProps {
  eventId: string
  isHeadOrCreator?: boolean
}

const STATUS_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'Not Started', label: 'To Do' },
  { id: 'In Progress', label: 'In Progress' },
  { id: 'Waiting', label: 'Waiting' },
  { id: 'Completed', label: 'Completed' }
]

export const TaskBoard: React.FC<TaskBoardProps> = ({ eventId, isHeadOrCreator }) => {
  const [tasks, setTasks] = useState<EventTask[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<EventTask | undefined>()
  const { canAction, profile } = useAuth()
  const { toast } = useToast()
  const canManageTasks = isHeadOrCreator || canAction('canAssignTasks')

  const fetchTasks = async () => {
    try {
      const data = await eventTaskService.getTasksByEventId(eventId)
      setTasks(data.filter(t => !t.isArchived))
    } catch (err) {
      console.error('Failed to load tasks:', err)
      toast.error('Load Failed', 'Failed to load event tasks.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTasks()
  }, [eventId])

  const handleAssignToMe = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation()
    if (!profile?.displayName) return
    try {
      await eventTaskService.updateTask(taskId, { 
        assignedMemberName: profile.displayName,
        unreadByAssignee: false 
      }, profile?.email || 'System')
      toast.success('Task Claimed', 'You have assigned this task to yourself.')
      fetchTasks()
    } catch (err) {
      console.error('Failed to take over task:', err)
      toast.error('Action Failed', 'Failed to take over task.')
    }
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, taskId: string, newStatus: TaskStatus) => {
    e.stopPropagation()
    const taskToMove = tasks.find(t => t.id === taskId)
    if (taskToMove && taskToMove.status !== newStatus) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      try {
        await eventTaskService.updateTask(taskId, { status: newStatus }, profile?.email || 'System')
        toast.success('Status Updated', `Task status updated to "${newStatus}".`)
      } catch (err) {
        console.error('Failed to update task status:', err)
        toast.error('Update Failed', 'Failed to update task status.')
        fetchTasks()
      }
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const canUpdate = isHeadOrCreator || canAction('canUpdateAnyTask') || (canAction('canUpdateOwnTasks') && task.assignedMemberName === profile?.displayName)
    if (!canUpdate) {
      e.preventDefault()
      return
    }

    e.dataTransfer.setData('text/plain', taskId)
    e.dataTransfer.setData('taskId', taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId') || e.dataTransfer.getData('text/plain')
    if (!taskId) return

    const taskToMove = tasks.find(t => t.id === taskId)
    if (taskToMove && taskToMove.status !== newStatus) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      try {
        await eventTaskService.updateTask(taskId, { status: newStatus }, profile?.displayName || 'User')
        toast.success('Task Moved', `Task moved to "${newStatus}".`)
      } catch (err) {
        console.error('Failed to update task status:', err)
        toast.error('Update Failed', 'Failed to update task status.')
        fetchTasks()
      }
    }
  }

  const openNewTaskModal = () => {
    setSelectedTask(undefined)
    setIsModalOpen(true)
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200 shadow-2xs mt-6">
        <Loading variant="spinner" label="Loading tasks..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/60 -mx-4 sm:-mx-6 px-4 sm:px-6 py-6 border-y border-slate-200">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Task Board</h2>
          <p className="text-xs text-slate-500 mt-0.5">Track deliverables, assignees, and progress across stages.</p>
        </div>
        {canManageTasks && (
          <Button 
            variant="primary"
            size="dense"
            onClick={openNewTaskModal}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Add Task
          </Button>
        )}
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 items-start flex-1 min-h-[400px]">
        {STATUS_COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          
          return (
            <div 
              key={col.id} 
              className="flex-shrink-0 w-80 flex flex-col bg-slate-100/70 rounded-2xl border border-slate-200 shadow-2xs"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="p-3.5 border-b border-slate-200/80 bg-slate-100/90 rounded-t-2xl flex justify-between items-center">
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">{col.label}</h3>
                <span className="text-[10px] font-black text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[160px]">
                {colTasks.length === 0 && (
                  <div className="h-28 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-white/40">
                    <p className="text-xs font-semibold text-slate-400">Drop tasks here</p>
                  </div>
                )}
                {colTasks.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onClick={(t) => { setSelectedTask(t); setIsModalOpen(true) }}
                    onDragStart={handleDragStart}
                    canAssignToMe={!isHeadOrCreator && !canAction('canUpdateAnyTask') && canAction('canUpdateOwnTasks') && task.assignedMemberName !== profile?.displayName}
                    onAssignToMe={handleAssignToMe}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false)
          fetchTasks()
        }}
        eventId={eventId}
        existingTask={selectedTask}
        isHeadOrCreator={isHeadOrCreator}
      />
    </div>
  )
}

