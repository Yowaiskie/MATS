import React, { useState, useEffect } from 'react'
import { Modal, Button } from '@/components'
import { eventService } from '@/services/eventService'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/context/ToastContext'
import type { Event, EventOptionalModule } from '@/types/event'
import {
  getEventModuleLabel,
  getNewlyDisabledModules,
  getResolvedEventModules
} from '@/utils/eventModules'
import { EventModuleSelector } from './EventModuleSelector'

interface EventModulesModalProps {
  isOpen: boolean
  onClose: () => void
  event: Event
  onSaved: (nextModules: EventOptionalModule[]) => void
}

export const EventModulesModal: React.FC<EventModulesModalProps> = ({
  isOpen,
  onClose,
  event,
  onSaved
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [selectedModules, setSelectedModules] = useState<EventOptionalModule[]>([])
  const [saving, setSaving] = useState(false)
  const [warningModules, setWarningModules] = useState<EventOptionalModule[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setSelectedModules(getResolvedEventModules(event))
      setWarningModules(null)
      setError(null)
    }
  }, [isOpen, event])

  const commitSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await eventService.updateEvent(
        event.id,
        { enabledModules: selectedModules },
        profile?.email || 'System'
      )
      toast.success('Features Updated', 'Event workspace tabs have been updated.')
      onSaved(selectedModules)
    } catch (err) {
      console.error('Failed to update event features:', err)
      setError('Failed to save workspace features. Please try again.')
      toast.error('Update Failed', 'Could not update workspace features.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveClick = async () => {
    if (saving) return
    const previous = getResolvedEventModules(event)
    const disabled = getNewlyDisabledModules(previous, selectedModules)

    if (disabled.length > 0 && !warningModules) {
      setSaving(true)
      setError(null)
      try {
        const modulesWithData = await eventService.getModulesWithExistingData(event.id, disabled)
        if (modulesWithData.length > 0) {
          setWarningModules(modulesWithData)
          setSaving(false)
          return
        }
      } catch (err) {
        console.error('Failed to check existing module data:', err)
        // Non-blocking fallback: proceed to warn conservatively if check fails
        setWarningModules(disabled)
        setSaving(false)
        return
      }
      setSaving(false)
    }

    await commitSave()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Event Features"
      subtitle={`Choose which optional tabs appear in ${event.title}`}
      maxWidth="xl"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => {
              if (warningModules) {
                setWarningModules(null)
              } else {
                onClose()
              }
            }}
            disabled={saving}
          >
            {warningModules ? 'Back' : 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={warningModules ? 'primary' : 'primary'}
            size="sm"
            className="w-full sm:w-auto"
            loading={saving}
            disabled={saving}
            onClick={handleSaveClick}
          >
            {warningModules ? 'Hide Tabs Anyway (Keep Data)' : 'Save Features'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-bold border border-rose-200">
            {error}
          </div>
        )}

        <EventModuleSelector
          selected={selectedModules}
          onChange={(next) => {
            setSelectedModules(next)
            if (warningModules) setWarningModules(null)
          }}
          disabled={saving}
        />

        {warningModules && warningModules.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-950 space-y-1.5">
            <div className="font-extrabold flex items-center gap-2 text-amber-900">
              <svg className="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Existing records found in hidden tabs
            </div>
            <p className="font-medium text-amber-900/90 leading-relaxed">
              The following features already have saved data in this event:{' '}
              <span className="font-extrabold">
                {warningModules.map(getEventModuleLabel).join(', ')}
              </span>
              . Hiding these tabs will NOT delete any data. You can turn them back on anytime to view all records again.
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
