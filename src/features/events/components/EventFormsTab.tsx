import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EventForm, FormStatus } from '@/types/eventForm'
import { eventFormService } from '@/services/eventFormService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { EventFormBuilderModal } from './EventFormBuilderModal'
import { EventFormResponsesModal } from './EventFormResponsesModal'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal, FormattedText, Button, EmptyState, StatusBadge, useToast } from '@/components'

interface EventFormsTabProps {
  eventId: string
  isHeadOrCreator?: boolean
}

interface FormWithCount extends EventForm {
  responsesCount?: number
}

export const EventFormsTab: React.FC<EventFormsTabProps> = ({ eventId, isHeadOrCreator }) => {
  const { profile, canAction } = useAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [forms, setForms] = useState<FormWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [responsesForm, setResponsesForm] = useState<EventForm | null>(null)

  // Dialog State
  const [formToDelete, setFormToDelete] = useState<EventForm | null>(null)
  const [formToEdit, setFormToEdit] = useState<EventForm | null>(null)
  const [formStatusPending, setFormStatusPending] = useState<{ form: EventForm; target: FormStatus } | null>(null)
  const [formToDuplicate, setFormToDuplicate] = useState<EventForm | null>(null)
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const canManageForms =
    canAction('canManageEvents') ||
    canAction('canCreateEventForms') ||
    canAction('canEditEventForms') ||
    !!isHeadOrCreator

  const fetchForms = async () => {
    setLoading(true)
    try {
      const data = await queryClient.fetchQuery({
        queryKey: ['event-forms', eventId],
        queryFn: () => eventFormService.getFormsByEventId(eventId),
        staleTime: 1000 * 60 * 2
      })
      const formIds = data.map(f => f.id).filter((id): id is string => !!id)
      const responseCounts = await queryClient.fetchQuery({
        queryKey: ['event-form-response-counts', eventId, formIds.join(',')],
        queryFn: () => eventFormResponseService.getResponseCountsByFormIds(formIds),
        staleTime: 1000 * 30
      })

      const formsWithCounts = data.map(f => ({
        ...f,
        responsesCount: f.id ? (responseCounts[f.id] || 0) : 0
      }))

      setForms(formsWithCounts)
    } catch (err) {
      console.error('Failed to load event forms:', err)
      toast.error('Load Failed', 'Failed to load event forms.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchForms()
  }, [eventId, queryClient])

  const handleCopyPublicLink = (form: EventForm) => {
    if (!form.id) return
    const targetSlug = form.slug || form.id
    const publicUrl = `${window.location.origin}/public/forms/${targetSlug}`
    navigator.clipboard.writeText(publicUrl)
    setCopiedFormId(form.id)
    toast.success('Link Copied', 'Public form registration link copied to clipboard.')
    setTimeout(() => setCopiedFormId(null), 2500)
  }

  const handleToggleStatus = async () => {
    if (!formStatusPending) return
    const { form, target } = formStatusPending
    if (!form.id) return
    try {
      setActionLoading(true)
      await eventFormService.updateFormStatus(form.id, target, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      toast.success('Status Updated', `Form "${form.title}" status changed to ${target}.`)
      setFormStatusPending(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to update form status:', err)
      toast.error('Update Failed', 'Failed to update form status.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDuplicate = async () => {
    if (!formToDuplicate?.id) return
    try {
      setActionLoading(true)
      await eventFormService.duplicateForm(formToDuplicate.id, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      toast.success('Form Duplicated', `A copy of "${formToDuplicate.title}" was created as a draft.`)
      setFormToDuplicate(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to duplicate form:', err)
      toast.error('Action Failed', 'Failed to duplicate form.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!formToDelete?.id) return
    try {
      setActionLoading(true)
      await eventFormService.deleteForm(formToDelete.id, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      toast.success('Form Deleted', `Form "${formToDelete.title}" was deleted.`)
      setFormToDelete(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to delete form:', err)
      toast.error('Delete Failed', 'Failed to delete form.')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 text-xs font-semibold">Loading forms...</div>

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h2 className="text-xl font-black text-slate-900">Event Registration & Forms</h2>
          <p className="text-xs text-slate-500 mt-0.5">Create dynamic custom registration forms, survey questionnaires, and RSVP links.</p>
        </div>

        {canManageForms && (
          <Button
            variant="primary"
            size="dense"
            onClick={() => {
              setFormToEdit(null)
              setIsBuilderOpen(true)
            }}
            icon={
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            }
          >
            Create Form
          </Button>
        )}
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <EmptyState
          title="No forms created yet"
          description="Build custom registration forms for pilgrimages, retreats, AGAPE attendance, or training sessions."
          action={
            canManageForms
              ? {
                  label: 'Create First Form',
                  onClick: () => {
                    setFormToEdit(null)
                    setIsBuilderOpen(true)
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(f => {
            const purposeLabels: Record<string, string> = {
              registration: 'Registration / RSVP',
              survey: 'Survey & Feedback',
              consent: 'Consent Slip',
              order: 'Order Form',
              general: 'General Form'
            }

            return (
              <div key={f.id} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      {f.purposeTag && (
                        <span className="inline-block text-[9px] font-extrabold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 mb-1">
                          {purposeLabels[f.purposeTag] || f.purposeTag}
                        </span>
                      )}
                      <h3 className="text-base font-black text-slate-900 line-clamp-1">{f.title}</h3>
                    </div>
                    <StatusBadge status={f.status} size="sm" />
                  </div>

                  {f.description && (
                    <div className="text-xs text-slate-500 line-clamp-2 mb-2 font-medium">
                      <FormattedText text={f.description} as="span" />
                    </div>
                  )}

                  {f.guidelines && (
                    <div className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded-xl text-[11px] text-amber-900/90 line-clamp-2 mb-3">
                      <span className="font-bold text-amber-950">Guidelines: </span>
                      <FormattedText text={f.guidelines.replace(/\n/g, ' • ')} as="span" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center space-x-1">
                      <span>Responses:</span>
                      <strong className="text-slate-900 font-bold">{f.responsesCount || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>Access: <strong className="text-slate-900 font-bold">{f.isPublic ? 'Public Share Link' : 'Internal Only'}</strong></span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <Button
                      variant="secondary"
                      size="dense"
                      onClick={() => setResponsesForm(f)}
                    >
                      View Responses ({f.responsesCount || 0})
                    </Button>

                    {f.isPublic && f.status === 'published' && (
                      <Button
                        variant="ghost"
                        size="dense"
                        onClick={() => handleCopyPublicLink(f)}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/60"
                      >
                        {copiedFormId === f.id ? 'Copied!' : 'Copy Link'}
                      </Button>
                    )}
                  </div>

                  {canManageForms && (
                    <div className="flex items-center space-x-1">
                      {f.status === 'published' ? (
                        <>
                          <Button
                            variant="ghost"
                            size="dense"
                            onClick={() => setFormStatusPending({ form: f, target: 'temporary_closed' })}
                            className="text-amber-800 bg-amber-50 hover:bg-amber-100"
                            title="Temporary Close"
                          >
                            Temp Close
                          </Button>
                          <Button
                            variant="ghost"
                            size="dense"
                            onClick={() => setFormStatusPending({ form: f, target: 'closed' })}
                            className="text-rose-700 bg-rose-50 hover:bg-rose-100"
                            title="Totally Close"
                          >
                            Close
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="dense"
                          onClick={() => setFormStatusPending({ form: f, target: 'published' })}
                          className="text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                        >
                          {f.status === 'draft' ? 'Publish' : 'Reopen'}
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="dense"
                        onClick={() => {
                          setFormToEdit(f)
                          setIsBuilderOpen(true)
                        }}
                      >
                        Edit
                      </Button>

                      <Button
                        variant="ghost"
                        size="dense"
                        onClick={() => setFormToDuplicate(f)}
                        title="Duplicate Form"
                      >
                        Duplicate
                      </Button>

                      <Button
                        variant="ghost"
                        size="dense"
                        onClick={() => setFormToDelete(f)}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        title="Delete Form"
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form Builder Modal */}
      {isBuilderOpen && (
        <EventFormBuilderModal
          isOpen={isBuilderOpen}
          onClose={() => {
            setIsBuilderOpen(false)
            setFormToEdit(null)
          }}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
            await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
            fetchForms()
          }}
          eventId={eventId}
          formToEdit={formToEdit}
        />
      )}

      {/* Responses Modal */}
      {responsesForm && (
        <EventFormResponsesModal
          isOpen={!!responsesForm}
          onClose={() => setResponsesForm(null)}
          form={responsesForm}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        isOpen={!!formToDelete}
        onClose={() => setFormToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Event Form"
        message={`Are you sure you want to delete "${formToDelete?.title}"? All questions will be permanently removed.`}
        confirmLabel="Delete Form"
        variant="danger"
        loading={actionLoading}
      />

      {/* Confirm Status Change */}
      <ConfirmModal
        isOpen={!!formStatusPending}
        onClose={() => setFormStatusPending(null)}
        onConfirm={handleToggleStatus}
        title={
          formStatusPending?.target === 'published'
            ? (formStatusPending.form.status === 'draft' ? 'Publish Form' : 'Reopen Form')
            : formStatusPending?.target === 'temporary_closed'
            ? 'Pansamantalang Isara ang Form'
            : 'Lubusang Isara ang Form (Totally Closed)'
        }
        message={
          formStatusPending?.target === 'published'
            ? formStatusPending?.form.status === 'draft'
              ? `Publish "${formStatusPending?.form.title}"? It will become accessible to respondents via its public link.`
              : `Reopen "${formStatusPending?.form.title}"? It will accept new submissions again.`
            : formStatusPending?.target === 'temporary_closed'
            ? `Pansamantalang isasara ang "${formStatusPending?.form.title}". Magpapakita ito ng Temporary Closed badge at notice sa mga magbubukas ng link.`
            : `Lubusang isasara ang "${formStatusPending?.form.title}". Hindi na makakapag-submit ang sinuman sa form na ito.`
        }
        confirmLabel={
          formStatusPending?.target === 'published'
            ? (formStatusPending.form.status === 'draft' ? 'Publish' : 'Reopen')
            : formStatusPending?.target === 'temporary_closed'
            ? 'Temp Close'
            : 'Totally Close'
        }
        variant={formStatusPending?.target === 'closed' ? 'danger' : undefined}
        loading={actionLoading}
      />

      {/* Confirm Duplicate */}
      <ConfirmModal
        isOpen={!!formToDuplicate}
        onClose={() => setFormToDuplicate(null)}
        onConfirm={handleDuplicate}
        title="Duplicate Form"
        message={`Duplicate "${formToDuplicate?.title}"? A copy will be created as a draft.`}
        confirmLabel="Duplicate"
        variant="primary"
        loading={actionLoading}
      />
    </div>
  )
}

