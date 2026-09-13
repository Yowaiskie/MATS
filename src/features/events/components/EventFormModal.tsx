import React, { useState, useEffect } from 'react'
import { eventService } from '@/services/eventService'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import { userService } from '@/services/userService'
import { useAuth } from '@/features/authentication/AuthContext'
import { MemberSearchDropdown } from '@/components/MemberSearchDropdown'
import { Button, CustomSelect } from '@/components'
import { useToast } from '@/context/ToastContext'
import type { EventStage, Priority, Event } from '@/types/event'
import type { UserProfile } from '@/types/auth'

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editItem?: Event
}

export const EventFormModal: React.FC<EventFormModalProps> = ({ isOpen, onClose, onSaved, editItem }) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [stage, setStage] = useState<EventStage>('Planning')
  
  const [headUid, setHeadUid] = useState('')
  const [users, setUsers] = useState<UserProfile[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      userService.getUsers().then(data => setUsers(data)).catch(console.error)
      if (editItem) {
        setTitle(editItem.title)
        setDescription(editItem.description || '')
        setLocation(editItem.location || '')
        setStartDate(editItem.startDate)
        setEndDate(editItem.endDate || '')
        setStartTime(editItem.startTime || '')
        setEndTime(editItem.endTime || '')
        setPriority(editItem.priority)
        setStage(editItem.stage)
        setHeadUid(editItem.headUid || profile?.uid || '')
      } else {
        setTitle('')
        setDescription('')
        setLocation('')
        setStartDate('')
        setEndDate('')
        setStartTime('')
        setEndTime('')
        setPriority('Medium')
        setStage('Planning')
        setHeadUid(profile?.uid || '')
      }
      setError(null)
    }
  }, [isOpen, editItem, profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate) {
      setError('Please fill in Event Title and Start Date.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const selectedHead = users.find(u => u.uid === headUid)
      const selectedHeadName = selectedHead?.displayName || selectedHead?.email || profile?.displayName || profile?.email || 'Unknown'
      const selectedHeadUid = headUid || profile?.uid || ''

      if (editItem) {
        await eventService.updateEvent(
          editItem.id!,
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
            headUid: selectedHeadUid,
            headName: selectedHeadName,
          },
          profile?.email || 'System'
        )
      } else {
        const newEventId = await eventService.createEvent(
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
            headUid: selectedHeadUid,
            headName: selectedHeadName,
            createdByUid: profile?.uid || '',
            createdByName: profile?.displayName || profile?.email || 'Unknown'
          },
          profile?.email || 'System'
        )

        // Automatically assign selected head as an assignment member
        if (newEventId) {
          try {
            await eventAssignmentService.createAssignment(
              {
                eventId: newEventId,
                memberUid: selectedHeadUid,
                memberName: selectedHeadName,
                eventRoleId: 'head',
                eventRoleName: 'Overall Event Head',
                committeeName: 'Executive',
                isHead: true,
                isOverallHead: true,
                isSubLeader: false,
                assignedByUid: profile?.uid || 'system',
                assignedByName: profile?.displayName || profile?.email || 'System'
              },
              profile?.displayName || profile?.email || 'System'
            )
          } catch (assignErr) {
            console.error('Failed to auto-create head assignment:', assignErr)
          }
        }
      }
      toast.success('Event Saved', editItem ? 'Event details updated successfully.' : 'New event workspace created.')
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Failed to save event. Please try again.')
      toast.error('Save Failed', 'Failed to save event. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Glassmorphic Backdrop */}
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md transition-opacity animate-in fade-in duration-200" onClick={submitting ? undefined : onClose} />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{editItem ? 'Edit Event' : 'Create New Event'}</h3>
              <p className="text-xs font-semibold text-slate-400">{editItem ? 'Update event details' : 'Set up event details and timeline'}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="py-4 overflow-y-auto pr-1">
          <form id="eventForm" onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-bold border border-rose-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Event Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="e.g. Grand Feast Mass 2026" required />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Event Head (Leader)</label>
              <MemberSearchDropdown
                options={users.length === 0 ? [
                  { id: profile?.uid || '', name: profile?.displayName || profile?.email || 'Current User', subtitle: profile?.email || undefined }
                ] : users.map(u => ({
                  id: u.uid,
                  name: u.displayName || u.email,
                  subtitle: u.displayName ? u.email : undefined
                }))}
                value={headUid}
                mode="id"
                title="Select Event Head (Leader)"
                placeholder="Choose Event Head..."
                onChange={(val) => setHeadUid(val)}
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none" placeholder="Brief event description..." />
            </div>
            
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Location</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" placeholder="e.g. Main Parish Hall" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Start Date *</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" required />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">End Date</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="block w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Stage</label>
                <CustomSelect
                  value={stage}
                  onChange={(e) => setStage(e.target.value as EventStage)}
                  options={[
                    { value: 'Planning', label: 'Planning' },
                    { value: 'Preparation', label: 'Preparation' },
                    { value: 'Ready', label: 'Ready' },
                    { value: 'Ongoing', label: 'Ongoing' },
                    { value: 'Completed', label: 'Completed' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">Priority</label>
                <CustomSelect
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  options={[
                    { value: 'Low', label: 'Low' },
                    { value: 'Medium', label: 'Medium' },
                    { value: 'High', label: 'High' },
                    { value: 'Critical', label: 'Critical' }
                  ]}
                />
              </div>
            </div>
          </form>
        </div>
        
        <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
          <Button
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="submit"
            form="eventForm"
            loading={submitting}
            disabled={submitting}
          >
            {editItem ? 'Save Changes' : 'Create Event'}
          </Button>
        </div>
      </div>
    </div>
  )
}
