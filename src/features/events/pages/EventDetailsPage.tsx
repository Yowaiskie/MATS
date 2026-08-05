import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { eventService } from '@/services/eventService'
import type { Event } from '@/types/event'
import { TaskBoard } from '../components/TaskBoard'
import { TeamBoard } from '../components/TeamBoard'
import { TimelineView } from '../components/TimelineView'
import { OverviewTab } from '../components/OverviewTab'

type TabType = 'overview' | 'team' | 'tasks' | 'timeline'

export const EventDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('tasks')

  useEffect(() => {
    if (!id) return
    const fetchEvent = async () => {
      try {
        const data = await eventService.getEventById(id)
        setEvent(data)
      } catch (err) {
        console.error('Failed to load event details:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchEvent()
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-500">Loading workspace...</div>
  if (!event) return <div className="p-8 text-center text-red-500">Event not found.</div>

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs font-medium text-gray-500">
        <Link to="/events" className="hover:text-blue-600 transition-colors">Events</Link>
        <span>/</span>
        <span className="text-gray-900 font-bold">{event.title}</span>
      </div>

      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{event.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{event.description}</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
            {event.stage}
          </span>
        </div>
      </div>

      {/* Tabs Placeholder */}
      <div className="border-b border-gray-200 flex space-x-6 px-1">
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
      </div>

      {/* Content Area */}
      {activeTab === 'overview' ? (
        <OverviewTab event={event} />
      ) : activeTab === 'tasks' ? (
        <TaskBoard eventId={event.id!} />
      ) : activeTab === 'team' ? (
        <TeamBoard eventId={event.id!} />
      ) : activeTab === 'timeline' ? (
        <TimelineView eventId={event.id!} />
      ) : (
        <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-8 text-center text-gray-500">
          This tab content is not implemented yet.
        </div>
      )}
    </div>
  )
}
