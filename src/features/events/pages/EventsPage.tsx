import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { eventService } from '@/services/eventService'
import type { Event } from '@/types/event'
import { Card } from '@/components/Card'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'
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
      } else if (profile?.displayName) {
        const myAssignments = await dashboardService.getMyEventAssignments(profile.displayName)
        const myEventIds = new Set(myAssignments.map(a => a.eventId))
        setEvents(data.filter(e => myEventIds.has(e.id)))
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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            + Create Event
          </button>
        )}
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-semibold text-xs">No events found. Create one to get started.</div>
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
                        📅 {event.startDate}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                          {event.stage}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-700 font-semibold">
                        {event.headName}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/events/${event.id}`}
                          className="text-xs font-bold text-slate-700 hover:text-indigo-600 border border-slate-200/80 rounded-xl px-3.5 py-1.5 shadow-2xs hover:border-indigo-200 bg-white hover:bg-indigo-50/50 transition-all"
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
