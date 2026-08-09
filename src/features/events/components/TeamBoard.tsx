import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import type { EventAssignment } from '@/types/event'
import { Card } from '@/components/Card'
import { Loading } from '@/components/Loading'
import { ConfirmModal } from '@/components/Dialog'
import { AssignmentFormModal } from './AssignmentFormModal'
import { useAuth } from '@/features/authentication/AuthContext'

interface Props {
  eventId: string
}

export const TeamBoard: React.FC<Props> = ({ eventId }) => {
  const { canAction } = useAuth()
  const [assignments, setAssignments] = useState<EventAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<EventAssignment | undefined>(undefined)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)

  const canManage = canAction('canManageAssignments') || canAction('canAssignTasks')

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
    try {
      await eventAssignmentService.removeAssignment(id)
      fetchAssignments()
      setDeleteItemId(null)
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
        {canManage && (
          <button
            onClick={() => {
              setEditItem(undefined)
              setIsModalOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors cursor-pointer"
          >
            + Assign Member
          </button>
        )}
      </div>

      <Card className="p-0 border border-gray-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loading variant="spinner" label="Loading team..." />
          </div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 flex flex-col items-center">
            <p className="mb-4">No team members assigned yet.</p>
            {canManage && (
              <button
                onClick={() => {
                  setEditItem(undefined)
                  setIsModalOpen(true)
                }}
                className="text-blue-600 font-bold hover:underline"
              >
                Assign the first member
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Member</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Committee & Role</th>
                  <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider">Assigned By</th>
                  {canManage && <th className="px-6 py-3 text-[10px] uppercase font-bold text-gray-500 tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {a.memberName}
                      {a.isOverallHead ? (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                          Overall Head
                        </span>
                      ) : a.isSubLeader ? (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Sub-Leader
                        </span>
                      ) : a.isHead ? (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                          Head
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {a.committeeName && (
                        <div className="text-xs font-bold text-gray-500 mb-1">{a.committeeName}</div>
                      )}
                      <span className="inline-flex px-2 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                        {a.eventRoleName}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {a.assignedByName}
                    </td>
                    {canManage && (
                      <td className="px-6 py-4 text-right space-x-3">
                        <button
                          onClick={() => {
                            setEditItem(a)
                            setIsModalOpen(true)
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteItemId(a.id!)}
                          className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline transition-colors"
                        >
                          Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {canManage && (
        <AssignmentFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={() => {
            setIsModalOpen(false)
            setEditItem(undefined)
            fetchAssignments()
          }}
          eventId={eventId}
          editItem={editItem}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteItemId}
        onClose={() => setDeleteItemId(null)}
        onConfirm={() => {
          if (deleteItemId) handleRemove(deleteItemId)
        }}
        title="Remove Member"
        message="Are you sure you want to remove this member from the event?"
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  )
}
