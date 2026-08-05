import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { eventService } from '@/services/eventService'
import type { Event } from '@/types/event'
import { Card } from '@/components/Card'
import { EventFormModal } from '../components/EventFormModal'

export const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchEvents = async () => {
    try {
      const data = await eventService.getEvents()
      setEvents(data)
    } catch (err) {
      console.error('Failed to load events:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Ministry Events</h1>
          <p className="text-sm text-gray-500 mt-1">Manage event workspaces, assignments, and tasks.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
        >
          + Create Event
        </button>
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No events found. Create one to get started.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Event Title</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Date</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Stage</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Head</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {events.map(event => (
                  <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link to={`/events/${event.id}`} className="font-bold text-blue-600 hover:underline">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      {event.startDate}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                        {event.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-600 font-medium">
                      {event.headName}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/events/${event.id}`}
                        className="text-xs font-bold text-gray-600 hover:text-blue-600 border border-gray-200 rounded-md px-3 py-1.5 shadow-xs hover:border-blue-200 bg-white hover:bg-blue-50 transition-colors"
                      >
                        Open Workspace
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
