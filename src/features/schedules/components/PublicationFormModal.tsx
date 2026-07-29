import React, { useState, useEffect } from 'react'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import type { ScheduleTemplate } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: SchedulePublicationInput, generateSchedules: boolean, selectedTemplateIds: string[]) => Promise<void>
  publication: SchedulePublication | null
}

export const PublicationFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  publication
}) => {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [maxSundaysPerServer, setMaxSundaysPerServer] = useState<number>(4)
  const [maxWeekdaysPerServer, setMaxWeekdaysPerServer] = useState<number>(8)
  const [generateSchedules, setGenerateSchedules] = useState<boolean>(true)
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (publication) {
        setName(publication.name)
        setStartDate(publication.startDate)
        setEndDate(publication.endDate)
        setDescription(publication.description || '')
        setStatus(publication.status)
        setMaxSundaysPerServer(publication.maxSundaysPerServer ?? 4)
        setMaxWeekdaysPerServer(publication.maxWeekdaysPerServer ?? 8)
        setGenerateSchedules(false) // Default to false when editing
      } else {
        setName('')
        setStartDate('')
        setEndDate('')
        setDescription('')
        setStatus('draft')
        setMaxSundaysPerServer(4)
        setMaxWeekdaysPerServer(8)
        setGenerateSchedules(true) // Default to true when creating
      }
      const loadTemplates = async () => {
        try {
          const fetched = await recurringService.getTemplates()
          const active = fetched.filter(t => t.active)
          setTemplates(active)
          setSelectedTemplateIds(active.map(t => t.id))
        } catch (err) {
          console.error('Failed to load templates', err)
        }
      }
      loadTemplates()

      setError('')
    }
  }, [isOpen, publication])

  const toggleTemplateSelection = (id: string) => {
    setSelectedTemplateIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (startDate > endDate) {
      setError('Start date cannot be after end date.')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await onSubmit({ 
        name, startDate, endDate, description, status,
        maxSundaysPerServer, maxWeekdaysPerServer
      }, generateSchedules, selectedTemplateIds)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save publication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-lg font-black text-gray-900">
            {publication ? 'Edit Publication' : 'Create Publication'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <form id="pub-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Publication Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. September 2026 Schedule"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  Max Sundays / Server
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxSundaysPerServer}
                  onChange={(e) => setMaxSundaysPerServer(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                  Max Weekdays / Server
                </label>
                <input
                  type="number"
                  min="0"
                  value={maxWeekdaysPerServer}
                  onChange={(e) => setMaxWeekdaysPerServer(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {!publication && (
              <div className="space-y-3 p-4 border border-blue-100 bg-blue-50/30 rounded-xl">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateSchedules}
                    onChange={(e) => setGenerateSchedules(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-blue-900">Generate Schedules from Templates</span>
                    <span className="text-[10px] text-blue-700 leading-relaxed mt-0.5">
                      Automatically create schedule slots between the Start and End dates using selected active Schedule Templates.
                    </span>
                  </div>
                </label>

                {generateSchedules && templates.length > 0 && (
                  <div className="ml-6 space-y-2">
                    <div className="text-[10px] font-bold text-gray-500 uppercase flex justify-between">
                      <span>Select Templates to Include</span>
                      <div className="space-x-2">
                        <button type="button" onClick={() => setSelectedTemplateIds(templates.map(t => t.id))} className="text-blue-600 hover:underline cursor-pointer">All</button>
                        <span>•</span>
                        <button type="button" onClick={() => setSelectedTemplateIds([])} className="text-gray-500 hover:underline cursor-pointer">None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {templates.map(t => (
                        <label key={t.id} className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={selectedTemplateIds.includes(t.id)}
                            onChange={() => toggleTemplateSelection(t.id)}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-800">{t.title}</span>
                            <span className="text-[10px] text-gray-500">{t.dayOfWeek} • {t.startTime}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add details about this publication..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="pub-form"
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Save Publication'}
          </button>
        </div>
      </div>
    </div>
  )
}
