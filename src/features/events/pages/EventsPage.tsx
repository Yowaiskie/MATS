import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { eventService } from '@/services/eventService'
import type { Event } from '@/types/event'
import { Card, Pagination, Loading, Button, StatusBadge, EmptyState } from '@/components'
import { EventFormModal } from '../components/EventFormModal'
import { useAuth } from '@/features/authentication/AuthContext'
import { dashboardService } from '@/services/dashboardService'

const PAGE_SIZE = 10

export const EventsPage: React.FC = () => {
  const { profile, canAction } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const data = await eventService.getEvents()
      if (canAction('canManageEvents')) {
        setEvents(data)
      } else if (profile) {
        const userUid = profile.uid
        const userName = profile.displayName || profile.email || ''
        const myAssignments = await dashboardService.getMyEventAssignments(userName, userUid)
        const myEventIds = new Set(myAssignments.map(a => a.eventId))
        setEvents(data.filter(e => e.createdByUid === userUid || e.headUid === userUid || myEventIds.has(e.id)))
      } else {
        setEvents([])
      }
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Ministry Events..." />
      </div>
    )
  }

  const paginatedEvents = events.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Ministry Events</h1>
          <p className="text-sm text-gray-500 mt-1">Manage event workspaces, assignments, and tasks.</p>
        </div>
        {(canAction('canCreateProjects') || canAction('canManageEvents')) && (
          <Button 
            variant="primary"
            size="md"
            onClick={() => setIsModalOpen(true)}
          >
            + Create Event
          </Button>
        )}
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        {events.length === 0 ? (
          <EmptyState
            title="No events found"
            description="Create an event workspace to get started."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="px-6 py-4">Event Title</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Stage</th>
                    <th className="px-6 py-4">Head</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white font-semibold text-slate-800">
                  {paginatedEvents.map(event => (
                    <tr key={event.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <Link to={`/events/${event.id}`} className="font-extrabold text-indigo-600 hover:underline">
                          {event.title}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs font-semibold text-slate-600">
                        <span className="inline-flex items-center gap-1.5 text-slate-600">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {event.startDate}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={event.stage} size="sm" />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 font-semibold">
                        {event.headName}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/events/${event.id}`}
                          className="inline-flex items-center text-xs font-bold text-slate-700 hover:text-indigo-600 border border-slate-200/80 rounded-xl px-3.5 py-1.5 shadow-2xs hover:border-indigo-200 bg-white hover:bg-indigo-50/50 transition-all"
                        >
                          Open Workspace
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={events.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </Card>
      
      <EventFormModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false)
          fetchEvents()
        }}
      />
    </div>
  )
}
