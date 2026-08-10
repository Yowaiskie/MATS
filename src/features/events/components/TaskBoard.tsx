import React, { useState, useEffect } from 'react'
import { Loading } from '@/components/Loading'
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
  const canManageTasks = isHeadOrCreator || canAction('canAssignTasks')

  const fetchTasks = async () => {
    try {
      const data = await eventTaskService.getTasksByEventId(eventId)
      setTasks(data.filter(t => !t.isArchived))
    } catch (err) {
      console.error('Failed to load tasks:', err)
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
      fetchTasks()
    } catch (err) {
      console.error('Failed to take over task:', err)
    }
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>, taskId: string, newStatus: TaskStatus) => {
    e.stopPropagation()
    const taskToMove = tasks.find(t => t.id === taskId)
    if (taskToMove && taskToMove.status !== newStatus) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
      try {
        await eventTaskService.updateTask(taskId, { status: newStatus }, profile?.email || 'System')
      } catch (err) {
        console.error('Failed to update task status:', err)
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
      } catch (err) {
        console.error('Failed to update task status:', err)
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
      <div className="py-24 bg-white rounded-2xl border border-gray-200 shadow-xs mt-6">
        <Loading variant="spinner" label="Loading tasks..." />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-6 border-y border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-900">Task Board</h2>
        {canManageTasks && (
          <button 
            onClick={openNewTaskModal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            + Add Task
          </button>
        )}
      </div>

      <div className="flex gap-6 overflow-x-auto pb-4 items-start flex-1 min-h-[400px]">
        {STATUS_COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          
          return (
            <div 
              key={col.id} 
              className="flex-shrink-0 w-80 flex flex-col bg-gray-100/50 rounded-xl border border-gray-200"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              <div className="p-3 border-b border-gray-200 bg-gray-100/80 rounded-t-xl flex justify-between items-center">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{col.label}</h3>
                <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              
              <div className="p-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
                {colTasks.length === 0 && (
                  <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-xs font-medium text-gray-400">Drop tasks here</p>
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
