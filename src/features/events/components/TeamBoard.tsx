import React, { useState, useEffect } from 'react'
import { eventAssignmentService } from '@/services/eventAssignmentService'
import type { EventAssignment } from '@/types/event'
import { Card, Loading, ConfirmModal, Button, EmptyState, useToast } from '@/components'
import { AssignmentFormModal } from './AssignmentFormModal'
import { useAuth } from '@/features/authentication/AuthContext'

interface Props {
  eventId: string
  isHeadOrCreator?: boolean
}

export const TeamBoard: React.FC<Props> = ({ eventId, isHeadOrCreator }) => {
  const { canAction } = useAuth()
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<EventAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<EventAssignment | undefined>(undefined)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canManage = isHeadOrCreator || canAction('canManageAssignments') || canAction('canAssignTasks')

  const fetchAssignments = async () => {
    try {
      setLoading(true)
      const data = await eventAssignmentService.getAssignmentsByEventId(eventId)
      setAssignments(data)
    } catch (err) {
      console.error('Failed to load assignments:', err)
      toast.error('Load Failed', 'Failed to load event team assignments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssignments()
  }, [eventId])

  const handleRemove = async (id: string) => {
    try {
      setDeleting(true)
      await eventAssignmentService.removeAssignment(id)
      toast.success('Member Removed', 'Event team assignment has been removed successfully.')
      setDeleteItemId(null)
      fetchAssignments()
    } catch (err) {
      console.error('Failed to remove assignment:', err)
      toast.error('Action Failed', 'Failed to remove member assignment.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Event Team</h2>
          <p className="text-xs text-slate-500 mt-0.5">Manage members assigned to this event and their specific roles.</p>
        </div>
        {canManage && (
          <Button
            variant="primary"
            size="dense"
            onClick={() => {
              setEditItem(undefined)
              setIsModalOpen(true)
            }}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Assign Member
          </Button>
        )}
      </div>

      <Card className="p-0 border border-slate-200/80 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center">
            <Loading variant="spinner" label="Loading team..." />
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            title="No team members assigned yet"
            description="Assign active members to committees and roles to coordinate this event."
            action={
              canManage
                ? {
                    label: 'Assign Member',
                    onClick: () => {
                      setEditItem(undefined)
                      setIsModalOpen(true)
                    },
                    icon: (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )
                  }
                : undefined
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto hidden sm:block">
              <table className="w-full text-left border-collapse whitespace-nowrap text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="px-6 py-3.5">Member</th>
                    <th className="px-6 py-3.5">Committee & Role</th>
                    <th className="px-6 py-3.5">Assigned By</th>
                    {canManage && <th className="px-6 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-slate-800 font-semibold">
                  {assignments.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {a.memberName}
                        {a.isOverallHead ? (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            Overall Head
                          </span>
                        ) : a.isSubLeader ? (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                            Sub-Leader
                          </span>
                        ) : a.isHead ? (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            Head
                          </span>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {a.committeeName && (
                          <div className="text-[11px] font-bold text-slate-500 mb-1">{a.committeeName}</div>
                        )}
                        <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                          {a.eventRoleName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                        {a.assignedByName}
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditItem(a)
                                setIsModalOpen(true)
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-indigo-200/80 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition shadow-2xs cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteItemId(a.id!)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-200/80 bg-rose-50/80 text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition shadow-2xs cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Remove</span>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="block sm:hidden divide-y divide-slate-100 bg-white">
              {assignments.map(a => (
                <div key={a.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {a.memberName}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {a.isOverallHead ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                            Overall Head
                          </span>
                        ) : a.isSubLeader ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
                            Sub-Leader
                          </span>
                        ) : a.isHead ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-800 border border-amber-200">
                            Head
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItem(a)
                            setIsModalOpen(true)
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-indigo-200/80 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 transition shadow-2xs cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteItemId(a.id!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-200/80 bg-rose-50/80 text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition shadow-2xs cursor-pointer"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {a.committeeName && (
                      <span className="text-[11px] font-bold text-slate-500">
                        {a.committeeName} &bull;
                      </span>
                    )}
                    <span className="inline-flex px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/70">
                      {a.eventRoleName}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    Assigned By: <span className="text-slate-700 font-semibold">{a.assignedByName || '—'}</span>
                  </div>
                </div>
              ))}
            </div>
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
        loading={deleting}
      />
    </div>
  )
}

