import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import type { EventAssignment } from '@/types/event'
import { Card } from '@/components/Card'
import { AssignmentFormModal } from './AssignmentFormModal'

interface Props {
  eventId: string
}

export const TeamBoard: React.FC<Props> = ({ eventId }) => {
  const [assignments, setAssignments] = useState<EventAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchAssignments = async () => {
    try {
      setLoading(true)
      const data = await eventAssignmentService.getAssignmentsByEventId(eventId)
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [eventId])

  const handleRemove = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this member from the event?')) return
    try {
      await eventAssignmentService.removeAssignment(id)
      fetchAssignments()
    } catch (err) {
      console.error('Failed to remove assignment:', err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Event Team</h2>
          <p className="text-sm text-gray-500">Manage members assigned to this event and their specific roles.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
        >
          + Assign Member
        </button>
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading team...</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <p className="mb-4">No team members assigned yet.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-blue-600 font-bold hover:underline"
            >
              Assign the first member
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Member</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Role</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Assigned By</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {a.memberName}
                      {a.isHead && (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                          Head
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="inline-flex px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {a.eventRoleName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {a.assignedByName}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleRemove(a.id!)}
                        className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AssignmentFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={() => {
          setIsModalOpen(false)
          fetchAssignments()
        }}
        eventId={eventId}
      />
    </div>
  )
}
