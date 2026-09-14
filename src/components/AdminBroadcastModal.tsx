import React, { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, CustomSelect, useToast } from '@/components'
import { notificationService } from '@/services/notificationService'
import { useAuth } from '@/features/authentication/AuthContext'

interface AdminBroadcastModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const MegaphoneIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.115-1.564-.442a22.25 22.25 0 01-1.332-2.918m2.031-1.314A22.5 22.5 0 0019.5 12a22.5 22.5 0 00-7.16-3.84m0 9.18A22.5 22.5 0 0119.5 12m0 0a22.5 22.5 0 00-7.16-3.84"
    />
  </svg>
)

export const AdminBroadcastModal: React.FC<AdminBroadcastModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'urgent' | 'important' | 'info'>('important')
  const [targetAudience, setTargetAudience] = useState<'all' | 'officers' | 'admins'>('all')
  const [durationHours, setDurationHours] = useState<number>(24)
  const [actionUrl, setActionUrl] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast.warning('Required Fields', 'Please provide a title and message body.')
      return
    }

    setLoading(true)
    try {
      await notificationService.sendBroadcastNotification(
        {
          title,
          message,
          priority,
          targetAudience,
          actionUrl: actionUrl.trim() || undefined,
          durationHours: Number(durationHours)
        },
        profile?.email || 'Admin',
        profile?.displayName || profile?.memberName || 'Administrator'
      )

      toast.success(
        'Broadcast Dispatched',
        'Important notification sent and delivered to active users and PWA devices.'
      )
      setTitle('')
      setMessage('')
      setPriority('important')
      setActionUrl('')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error(err)
      toast.error('Dispatch Failed', err.message || 'Failed to send broadcast.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispatch Ministry Broadcast"
      subtitle="Send a real-time announcement to active users and push-enabled devices"
      icon={<MegaphoneIcon className="w-5 h-5 text-indigo-600" />}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900">
          <MegaphoneIcon className="w-5 h-5 text-indigo-600 shrink-0" />
          <p className="leading-relaxed">
            This announcement will appear in all users&apos; top-nav notification bell and dispatch native push notifications to registered devices.
          </p>
        </div>

        {/* Priority Selector */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
            Priority Level <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'urgent', label: 'Urgent Alert', dot: 'bg-rose-500', activeBg: 'bg-rose-50 border-rose-300 text-rose-800' },
              { key: 'important', label: 'Important Notice', dot: 'bg-amber-500', activeBg: 'bg-amber-50 border-amber-300 text-amber-800' },
              { key: 'info', label: 'General Info', dot: 'bg-blue-500', activeBg: 'bg-blue-50 border-blue-300 text-blue-800' }
            ].map((p) => {
              const isSelected = priority === p.key
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPriority(p.key as any)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? `${p.activeBg} ring-2 ring-blue-500/20 shadow-2xs`
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.dot}`} />
                  <span>{p.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Target Audience & Display Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CustomSelect
            label="Target Audience"
            required
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value as any)}
            options={[
              { value: 'all', label: 'All Users (Everyone)' },
              { value: 'officers', label: 'Officers & Order Leaders' },
              { value: 'admins', label: 'Admins & Coordinators' }
            ]}
          />

          <CustomSelect
            label="Header Banner Duration"
            required
            value={String(durationHours)}
            onChange={(e) => setDurationHours(Number(e.target.value))}
            options={[
              { value: '1', label: '1 Hour' },
              { value: '6', label: '6 Hours' },
              { value: '12', label: '12 Hours' },
              { value: '24', label: '24 Hours (1 Day)' },
              { value: '72', label: '3 Days' },
              { value: '168', label: '7 Days (1 Week)' },
              { value: '0', label: 'Indefinite (Until Cleared)' }
            ]}
          />
        </div>

        {/* Title */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Announcement Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g. Urgent: Emergency General Meeting on Friday"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Message Body <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full p-3 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
            placeholder="Write the complete announcement details here..."
          />
        </div>

        {/* Action URL */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1">
            Action Route / Target Link (Optional)
          </label>
          <input
            type="text"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
            className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-white text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="e.g. /schedules or /attendance or /events"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={loading} icon={<MegaphoneIcon className="w-4 h-4" />}>
            Dispatch Broadcast
          </Button>
        </div>
      </form>
    </Modal>
  )
}
