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
import { ConfirmModal, AlertModal } from '@/components/Dialog'

type TabType = 'overview' | 'team' | 'tasks' | 'timeline' | 'finance' | 'forms' | 'contributions'

export const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('tasks')
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)
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

  const confirmDelete = async () => {
    if (!id) return
    try {
      await eventService.deleteEvent(id, profile?.email || 'System')
      navigate('/events')
    } catch (err) {
      console.error('Failed to delete event:', err)
      setIsAlertOpen(true)
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
            <button
              onClick={handleDeleteEvent}
              className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors cursor-pointer"
            >
              Delete Workspace
            </button>
          )}
          {(canAction('canEditProjects') || canAction('canManageEvents') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) && (
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer"
            >
              Edit Event
            </button>
          )}
          <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            {event.stage}
          </span>
        </div>
      </div>

      {/* Tabs Placeholder */}
      <div className="border-b border-gray-200 flex space-x-6 px-1 overflow-x-auto whitespace-nowrap hide-scrollbar">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('team')}
          className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'team' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Team
        </button>
        <button 
          onClick={() => setActiveTab('tasks')}
          className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Tasks
        </button>
        <button 
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'timeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Timeline
        </button>
        {(canAction('canViewEventFinance') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) && (
          <button 
            onClick={() => setActiveTab('finance')}
            className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'finance' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Finance
          </button>
        )}
        <button 
          onClick={() => setActiveTab('forms')}
          className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'forms' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Forms
        </button>
        {(canAction('canViewEventContributions') || event.createdByUid === profile?.uid || event.headUid === profile?.uid) && (
          <button 
            onClick={() => setActiveTab('contributions')}
            className={`pb-3 border-b-2 text-sm font-bold px-1 transition-colors ${activeTab === 'contributions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Contributions
          </button>
        )}
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

      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Workspace"
        message={`Are you sure you want to delete the event workspace "${event.title}"? This cannot be undone.`}
        confirmLabel="Delete Workspace"
        variant="danger"
      />

      <AlertModal
        isOpen={isAlertOpen}
        onClose={() => setIsAlertOpen(false)}
        title="Delete Failed"
        message="Failed to delete event. Please try again."
      />
    </div>
  )
}
