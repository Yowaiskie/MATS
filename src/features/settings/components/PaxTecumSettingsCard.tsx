import React, { useState, useEffect } from 'react'
import { Card } from '@/components/Card'
import { Button, Loading } from '@/components'
import {
  settingsService,
  DEFAULT_PAX_TECUM_LANDING_SETTINGS,
  type PaxTecumLandingSettings
} from '@/services/settingsService'
import { eventFormService } from '@/services/eventFormService'
import type { EventForm } from '@/types/eventForm'
import { useAuth } from '@/features/authentication/AuthContext'

interface PaxTecumSettingsCardProps {
  onNotifySuccess: (msg: string) => void
  onNotifyError: (msg: string) => void
}

export const PaxTecumSettingsCard: React.FC<PaxTecumSettingsCardProps> = ({
  onNotifySuccess,
  onNotifyError
}) => {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [forms, setForms] = useState<EventForm[]>([])
  const [settings, setSettings] = useState<PaxTecumLandingSettings>(DEFAULT_PAX_TECUM_LANDING_SETTINGS)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      try {
        const [savedSettings, allForms] = await Promise.all([
          settingsService.getPaxTecumLandingSettings(),
          eventFormService.getAllForms()
        ])
        if (!active) return
        setSettings(savedSettings)
        setForms(allForms.filter(f => f.status !== 'archived'))
      } catch (err) {
        console.error('Failed to load Pax Tecum settings:', err)
        if (active) onNotifyError('Failed to load Pax Tecum landing page configuration.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [onNotifyError])

  const selectedForm = forms.find(f => f.id === settings.linkedFormId)
  const landingUrl = `${window.location.origin}/pax-tecum`

  const handleFormSelect = (formId: string) => {
    const matched = forms.find(f => f.id === formId)
    setSettings(prev => ({
      ...prev,
      linkedFormId: formId,
      linkedFormSlug: matched?.slug || '',
      linkedFormTitle: matched?.title || ''
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await settingsService.savePaxTecumLandingSettings(
        {
          enabled: settings.enabled,
          linkedFormId: settings.linkedFormId,
          linkedFormSlug: selectedForm?.slug || settings.linkedFormSlug || '',
          linkedFormTitle: selectedForm?.title || settings.linkedFormTitle || ''
        },
        profile?.email || 'Admin'
      )
      onNotifySuccess('Pax Tecum landing page settings saved.')
    } catch (err) {
      console.error('Failed to save Pax Tecum settings:', err)
      onNotifyError(err instanceof Error ? err.message : 'Failed to save Pax Tecum settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(landingUrl)
      setCopied(true)
      onNotifySuccess('Copied /pax-tecum landing page link.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onNotifyError('Could not copy the landing page link.')
    }
  }

  if (loading) {
    return (
      <Card>
        <div className="py-12">
          <Loading variant="spinner" label="Loading Pax Tecum landing settings..." />
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">Pax Tecum Public Landing Page</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect your public <code className="px-1.5 py-0.5 bg-slate-100 rounded text-indigo-700 font-semibold">/pax-tecum</code> page to an Event Form for live schedule and slot availability.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="dense"
            className="min-h-10"
            onClick={handleCopyUrl}
          >
            {copied ? 'Link Copied!' : 'Copy /pax-tecum Link'}
          </Button>
          <a
            href="/pax-tecum"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 min-h-10 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition"
          >
            <span>Open Preview</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </a>
        </div>
      </div>

      {/* Visibility Toggle */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
        <div>
          <div className="text-sm font-bold text-slate-900">Landing Page Status</div>
          <p className="text-xs text-slate-500 mt-0.5">
            When disabled, visitors to <span className="font-semibold text-slate-700">/pax-tecum</span> will see a Coming Soon notice instead of live registration slots.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => setSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
            settings.enabled ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition duration-200 ${
              settings.enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Linked Event Form Selector */}
      <div className="space-y-2">
        <label htmlFor="pax-tecum-form-select" className="block text-xs font-black uppercase tracking-wider text-slate-700">
          Linked Registration Event Form
        </label>
        <select
          id="pax-tecum-form-select"
          value={settings.linkedFormId}
          onChange={e => handleFormSelect(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500 focus:outline-hidden"
        >
          <option value="">— No form linked yet —</option>
          {forms.map(f => (
            <option key={f.id} value={f.id}>
              {f.title} ({f.status.toUpperCase()}{f.isPublic ? ' · Public' : ' · Internal'})
            </option>
          ))}
        </select>

        {selectedForm && selectedForm.status !== 'published' && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900">
            Heads up: <strong>{selectedForm.title}</strong> is currently <strong>{selectedForm.status}</strong>. Publish it under Events &rarr; Forms so visitors can submit registrations.
          </div>
        )}

        {selectedForm && !selectedForm.isPublic && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
            Warning: <strong>{selectedForm.title}</strong> is marked Internal Only. Enable Public Access on the form so parishioners can register without logging in.
          </div>
        )}
      </div>

      {/* Static Content Reminder */}
      <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-700 space-y-1">
        <div className="font-black text-indigo-950">Zero-Read Static Photos & Copy</div>
        <p className="leading-relaxed">
          Gallery photos live in <code className="px-1 py-0.5 bg-white rounded border border-indigo-100">public/pax-tecum/</code> and page copy lives in <code className="px-1 py-0.5 bg-white rounded border border-indigo-100">src/features/events/data/paxTecumContent.ts</code> so visitors never consume Firestore reads for images or story text.
        </p>
      </div>

      <div className="flex justify-end pt-2 border-t border-slate-100">
        <Button
          type="button"
          variant="primary"
          size="dense"
          className="min-h-11 px-5"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving...' : 'Save Pax Tecum Settings'}
        </Button>
      </div>
    </Card>
  )
}
