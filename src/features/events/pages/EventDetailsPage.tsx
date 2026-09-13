import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { eventService } from '@/services/eventService'
import type { Event } from '@/types/event'
import { TaskBoard } from '../components/TaskBoard'
import { TeamBoard } from '../components/TeamBoard'
import { TimelineView } from '../components/TimelineView'
import { OverviewTab } from '../components/OverviewTab'
import { useAuth } from '@/features/authentication/AuthContext'
import { EventFinanceBoard } from '../components/EventFinanceBoard'
import { EventFormsTab } from '../components/EventFormsTab'
import { EventContributionsBoard } from '../components/EventContributionsBoard'
import { EventFormModal } from '../components/EventFormModal'
import { dashboardService } from '@/services/dashboardService'
import { eventTaskService } from '@/services/eventTaskService'
import { authService } from '@/services/authService'
import { PasswordConfirmModal } from '@/components/Dialog'
import { Button, StatusBadge } from '@/components'
import { useToast } from '@/context/ToastContext'

type TabType = 'overview' | 'team' | 'tasks' | 'timeline' | 'finance' | 'forms' | 'contributions'

export const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const { profile, canAction } = useAuth()

  const fetchEvent = async () => {
    if (!id) return
    try {
      const data = await eventService.getEventById(id)
      if (!data) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      if (!canAction('canManageEvents') && profile) {
        const isCreatorOrHead = data.createdByUid === profile.uid || data.headUid === profile.uid
        if (!isCreatorOrHead) {
          const userName = profile.displayName || profile.email || ''
          const myAssignments = await dashboardService.getMyEventAssignments(userName, profile.uid)
          const isMember = myAssignments.some(a => a.eventId === id)
          if (!isMember) {
            setAccessDenied(true)
            setLoading(false)
            return
          }
        }
      }

      setEvent(data)

      // Mark tasks as read for the user in this event
      if (profile?.displayName) {
        await eventTaskService.markTasksAsReadForEvent(id, profile.displayName)
      }
    } catch (err) {
      console.error('Failed to load event details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEvent = () => {
    if (!id || !event) return
    setIsConfirmDeleteOpen(true)
  }

  const confirmDelete = async (password: string) => {
    if (!id) return
    try {
      await authService.verifyPassword(password)
      await eventService.deleteEvent(id, profile?.email || 'System')
      setIsConfirmDeleteOpen(false)
      toast.success('Workspace Deleted', 'The event workspace has been permanently deleted.')
      navigate('/events')
    } catch (err: any) {
      console.error('Failed to delete event:', err)
      const msg = err.message || 'Verification failed. Password may be incorrect.'
      toast.error('Delete Failed', msg)
      throw new Error(msg)
    }
  }
  
  useEffect(() => {
    fetchEvent()
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading workspace...</div>
  if (accessDenied) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center bg-white p-8 rounded-2xl border border-red-100 shadow-sm max-w-md">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500 text-sm">You are not a member of this event workspace. Please contact the coordinator if you need access.</p>
        <Link to="/events" className="inline-block mt-6 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors">
          Go back to Events
        </Link>
      </div>
    </div>
  )
  if (!event) return <div className="p-8 text-center text-red-500">Event not found.</div>

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs font-medium text-gray-500">
        <Link to="/events" className="hover:text-blue-600 transition-colors">Events</Link>
        <span>/</span>
        <span className="text-gray-900 font-bold">{event.title}</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(canAction('canDeleteEvents') || canAction('canManageEvents') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeleteEvent}
            >
              Delete Workspace
            </Button>
          )}
          {(canAction('canEditProjects') || canAction('canManageEvents') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditModalOpen(true)}
            >
              Edit Event
            </Button>
          )}
          <StatusBadge status={event.stage} />
        </div>
      </div>

      {/* Sleek Modern Segmented Tabs Bar (Mobile Swipeable & Desktop Responsive) */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'team', label: 'Team' },
          { key: 'tasks', label: 'Tasks' },
          { key: 'timeline', label: 'Timeline' },
          ...((canAction('canViewEventFinance') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) ? [{ key: 'finance', label: 'Finance' }] : []),
          { key: 'forms', label: 'Forms' },
          ...((canAction('canViewEventContributions') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) ? [{ key: 'contributions', label: 'Contributions' }] : [])
        ].map((t) => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content Area */}
      {activeTab === 'overview' ? (
        <OverviewTab event={event} />
      ) : activeTab === 'tasks' ? (
        <TaskBoard eventId={event.id!} isHeadOrCreator={event.createdByUid === profile?.uid || event.headUid === profile?.uid} />
      ) : activeTab === 'team' ? (
        <TeamBoard eventId={event.id!} isHeadOrCreator={event.createdByUid === profile?.uid || event.headUid === profile?.uid} />
      ) : activeTab === 'timeline' ? (
        <TimelineView eventId={event.id!} />
      ) : activeTab === 'finance' && (canAction('canViewEventFinance') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) ? (
        <EventFinanceBoard eventId={event.id!} eventName={event.title} isHeadOrCreator={event.createdByUid === profile?.uid || event.headUid === profile?.uid} />
      ) : activeTab === 'forms' ? (
        <EventFormsTab eventId={event.id!} isHeadOrCreator={event.createdByUid === profile?.uid || event.headUid === profile?.uid} />
      ) : activeTab === 'contributions' && (canAction('canViewEventContributions') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) ? (
        <EventContributionsBoard eventId={event.id!} eventName={event.title} isHeadOrCreator={event.createdByUid === profile?.uid || event.headUid === profile?.uid} />
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-8 text-center text-gray-500">
          This tab content is not implemented yet.
        </div>
      )}

      {isEditModalOpen && (
        <EventFormModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={() => {
            setIsEditModalOpen(false)
            fetchEvent()
          }}
          editItem={event}
        />
      )}

      <PasswordConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Workspace"
        message={`Are you sure you want to delete the event workspace "${event.title}"? This cannot be undone. Please enter your password to confirm.`}
        confirmLabel="Delete Workspace"
      />
    </div>
  )
}
