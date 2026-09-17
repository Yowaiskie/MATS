import React from 'react'
import { Card } from '@/components/Card'
import { Button, StatusBadge } from '@/components'
import { useNotifications } from '@/hooks/useNotifications'

const BellIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
    />
  </svg>
)

const DevicePhoneMobileIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
    />
  </svg>
)

const InformationCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
    />
  </svg>
)

const SparklesIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
    />
  </svg>
)

export const NotificationSettingsCard: React.FC = () => {
  const {
    isSupported,
    isNative,
    permission,
    isSubscribed,
    token,
    loading,
    enableNotifications,
    disableNotifications,
    sendTestNotification
  } = useNotifications()

  return (
    <div className="space-y-6">
      {/* Overview & Status Card */}
      <Card className="p-6 border border-slate-200/80 bg-white rounded-3xl shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <BellIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Push Notifications & Alerts</h2>
                {isSubscribed ? (
                  <StatusBadge status="active" />
                ) : permission === 'denied' ? (
                  <StatusBadge status="cancelled" />
                ) : (
                  <StatusBadge status="pending" />
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Receive real-time alerts for schedule assignments, service reminders, and attendance locks on this device.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isSubscribed ? (
              <>
                <Button
                  variant="outline"
                  size="dense"
                  onClick={sendTestNotification}
                  icon={<SparklesIcon className="w-4 h-4 text-blue-600" />}
                >
                  Send Test
                </Button>
                <Button
                  variant="secondary"
                  size="dense"
                  onClick={disableNotifications}
                  loading={loading}
                >
                  Disable
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="dense"
                onClick={enableNotifications}
                loading={loading}
                disabled={!isSupported}
                icon={<BellIcon className="w-4 h-4" />}
              >
                Enable Notifications
              </Button>
            )}
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Schedule Assignments
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Get notified immediately when assigned or updated in upcoming Sunday or weekday Masses.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Service Reminders
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Timely reminders before your scheduled mass to ensure prompt preparation and attendance.
            </p>
          </div>

          <div className="p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              Ministry Announcements
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Receive broadcast notices and urgent ministry circulars directly from administrators.
            </p>
          </div>
        </div>

        {/* Technical Device Status */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">
              {isNative ? 'Platform Mode:' : 'Browser / PWA Web Push Support:'}
            </span>
            <span className={`font-bold ${isSupported ? 'text-emerald-600' : 'text-rose-600'}`}>
              {isNative ? 'Native Android App (FCM Enabled)' : (isSupported ? 'Supported' : 'Not Supported in this Browser')}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Permission Status:</span>
            <span className="font-mono text-[11px] text-slate-700 uppercase">{permission}</span>
          </div>

          {token && (
            <div className="pt-2 border-t border-slate-200/60">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Device Registration Token (Active)
              </span>
              <div className="p-2 rounded-xl bg-white border border-slate-200 text-[10px] font-mono text-slate-600 truncate select-all">
                {token}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* PWA / Mobile Compatibility Guide */}
      <Card className="p-5 border border-indigo-100 bg-indigo-50/40 rounded-3xl shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-950">
          <DevicePhoneMobileIcon className="w-4 h-4 text-indigo-600" />
          <span>Using MATS on Mobile or iPhone (PWA)?</span>
        </div>

        <div className="space-y-2 text-xs text-indigo-900/80 leading-relaxed">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p>
              <strong>Android:</strong> Open MATS in Chrome or Edge, click &ldquo;Add to Home screen&rdquo; or install the PWA. Push notifications work natively.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <p>
              <strong>iPhone / iPad (iOS 16.4+):</strong> Tap the <strong>Share</strong> button in Safari, select <strong>&ldquo;Add to Home Screen&rdquo;</strong>, then open the installed MATS app from your Home Screen to enable notifications.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
