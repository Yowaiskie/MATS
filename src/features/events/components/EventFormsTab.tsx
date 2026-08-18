import React, { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { EventForm, FormStatus } from '@/types/eventForm'
import { eventFormService } from '@/services/eventFormService'
import { eventFormResponseService } from '@/services/eventFormResponseService'
import { EventFormBuilderModal } from './EventFormBuilderModal'
import { EventFormResponsesModal } from './EventFormResponsesModal'
import { useAuth } from '@/features/authentication/AuthContext'
import { ConfirmModal, AlertModal } from '@/components/Dialog'
import { FormattedText } from '@/components/FormattedText'

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
  const [forms, setForms] = useState<FormWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [responsesForm, setResponsesForm] = useState<EventForm | null>(null)

  // Dialog State
  const [formToDelete, setFormToDelete] = useState<EventForm | null>(null)
  const [formToEdit, setFormToEdit] = useState<EventForm | null>(null)
  const [formStatusPending, setFormStatusPending] = useState<{ form: EventForm; target: FormStatus } | null>(null)
  const [formToDuplicate, setFormToDuplicate] = useState<EventForm | null>(null)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null)

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
    setTimeout(() => setCopiedFormId(null), 2500)
  }

  const handleToggleStatus = async () => {
    if (!formStatusPending) return
    const { form, target } = formStatusPending
    if (!form.id) return
    try {
      await eventFormService.updateFormStatus(form.id, target, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      setFormStatusPending(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to update form status:', err)
      setAlertMessage('Failed to update form status.')
    }
  }

  const handleDuplicate = async () => {
    if (!formToDuplicate?.id) return
    try {
      await eventFormService.duplicateForm(formToDuplicate.id, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      setFormToDuplicate(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to duplicate form:', err)
      setAlertMessage('Failed to duplicate form.')
    }
  }

  const handleDeleteConfirm = async () => {
    if (!formToDelete?.id) return
    try {
      await eventFormService.deleteForm(formToDelete.id, profile?.email || 'User')
      await queryClient.invalidateQueries({ queryKey: ['event-forms', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event-form-response-counts', eventId] })
      setFormToDelete(null)
      fetchForms()
    } catch (err) {
      console.error('Failed to delete form:', err)
      setAlertMessage('Failed to delete form.')
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-500 text-xs font-semibold">Loading forms...</div>

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900">Event Registration & Forms</h2>
          <p className="text-xs text-slate-500 mt-1">Create dynamic custom registration forms, survey questionnaires, and RSVP links.</p>
        </div>

        {canManageForms && (
          <button
            type="button"
            onClick={() => {
              setFormToEdit(null)
              setIsBuilderOpen(true)
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
          >
            <span>+ Create Form</span>
          </button>
        )}
      </div>

      {/* Forms List */}
      {forms.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-bold">
            FORMS
          </div>
          <h3 className="text-base font-bold text-slate-900">No forms created yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Build custom registration forms for pilgrimages, retreats, AGAPE attendance, or training sessions.
          </p>
          {canManageForms && (
            <button
              type="button"
              onClick={() => {
                setFormToEdit(null)
                setIsBuilderOpen(true)
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition cursor-pointer"
            >
              Create First Form
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {forms.map(f => {
            const statusColors: Record<FormStatus, string> = {
              published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
              draft: 'bg-amber-50 text-amber-700 border-amber-200',
              temporary_closed: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',
              closed: 'bg-slate-100 text-slate-600 border-slate-200',
              archived: 'bg-red-50 text-red-700 border-red-200'
            }

            const purposeLabels: Record<string, string> = {
              registration: 'Registration / RSVP',
              survey: 'Survey & Feedback',
              consent: 'Consent Slip',
              order: 'Order Form',
              general: 'General Form'
            }

            return (
              <div key={f.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
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
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border shrink-0 ${statusColors[f.status]}`}>
                      {f.status}
                    </span>
                  </div>

                  {f.description && (
                    <div className="text-xs text-slate-500 line-clamp-2 mb-2">
                      <FormattedText text={f.description} as="span" />
                    </div>
                  )}

                  {f.guidelines && (
                    <div className="p-2 bg-amber-50/50 border border-amber-100 rounded-lg text-[11px] text-amber-900/80 line-clamp-2 mb-3">
                      <span className="font-bold text-amber-950">Guidelines: </span>
                      <FormattedText text={f.guidelines.replace(/\n/g, ' • ')} as="span" />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center space-x-1">
                      <span>Responses:</span>
                      <strong className="text-slate-900">{f.responsesCount || 0}</strong>
                    </span>
                    <span>•</span>
                    <span>Access: <strong>{f.isPublic ? 'Public Share Link' : 'Internal Only'}</strong></span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1">
                    <button
                      type="button"
                      onClick={() => setResponsesForm(f)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                    >
                      View Responses ({f.responsesCount || 0})
                    </button>

                    {f.isPublic && f.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => handleCopyPublicLink(f)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                      >
                        <span>{copiedFormId === f.id ? 'Copied!' : 'Copy Link'}</span>
                      </button>
                    )}
                  </div>

                  {canManageForms && (
                    <div className="flex items-center space-x-1">
                      {f.status === 'published' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setFormStatusPending({ form: f, target: 'temporary_closed' })}
                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            title="Pansamantalang Isara (Temporary Closed)"
                          >
                            Temp Close
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormStatusPending({ form: f, target: 'closed' })}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                            title="Lubusang Isara (Totally Closed)"
                          >
                            Close
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFormStatusPending({ form: f, target: 'published' })}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        >
                          {f.status === 'draft' ? 'Publish' : 'Reopen'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setFormToEdit(f)
                          setIsBuilderOpen(true)
                        }}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormToDuplicate(f)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        title="Duplicate Form"
                      >
                        Duplicate
                      </button>

                      <button
                        type="button"
                        onClick={() => setFormToDelete(f)}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                        title="Delete Form"
                      >
                        Delete
                      </button>
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
      />

      <AlertModal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        title="Form Action"
        message={alertMessage || ''}
      />
    </div>
  )
}
