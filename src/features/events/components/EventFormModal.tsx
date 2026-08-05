import React, { useState } from 'react'
import { eventService } from '@/services/eventService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { EventStage, Priority } from '@/types/event'

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, onClose, onSaved }) => {
  const { profile } = useAuth()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [stage, setStage] = useState<EventStage>('Planning')
  
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate || !startTime || !endTime) {
      setError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await eventService.createEvent(
        {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          startDate,
          endDate,
          startTime,
          endTime,
          priority,
          stage,
          headUid: profile?.uid || '',
          headName: profile?.displayName || profile?.email || 'Unknown',
          createdByUid: profile?.uid || '',
          createdByName: profile?.displayName || profile?.email || 'Unknown'
        },
        profile?.email || 'System'
      )
      
      setTitle('')
      setDescription('')
      setLocation('')
      setStartDate('')
      setEndDate('')
      setStartTime('')
      setEndTime('')
      setPriority('Medium')
      setStage('Planning')
      
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to create event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      
      <div className="relative w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl z-10 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">Create New Event</h3>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 disabled:opacity-50">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="eventForm" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Event Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Annual General Assembly" required />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" placeholder="Brief description of the event..." />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="e.g. Main Parish Hall" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">End Date *</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Start Time *</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">End Time *</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Stage</label>
                <select value={stage} onChange={(e) => setStage(e.target.value as EventStage)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="Planning">Planning</option>
                  <option value="Preparation">Preparation</option>
                  <option value="Ready">Ready</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={submitting} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none disabled:opacity-50 shadow-sm transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" form="eventForm" disabled={submitting} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none disabled:opacity-50 flex items-center shadow-sm transition-colors cursor-pointer">
            {submitting ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  )
}
