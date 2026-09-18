import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import { useAuth } from '@/features/authentication/AuthContext'
import { useToast } from '@/context/ToastContext'
import { 
  notificationService, 
  type UntakenScheduleInfo 
} from '@/services/notificationService'
import type { Schedule } from '@/types/schedule'
import { formatTime12Hour } from '@/utils/scheduleUtils'
import { formatReadableDate, getDayOfWeek } from '@/utils/communityReport'
import { generateUntakenScheduleReminderText } from '@/utils/untakenScheduleReport'
import { settingsService } from '@/services/settingsService'

interface RemindAttendanceModalProps {
  isOpen: boolean
  onClose: () => void
}

export type ScheduleCategoryFilter = 'all' | 'sunday' | 'weekdays' | 'meeting' | 'formation' | 'special_events'
export type DatePresetFilter = 'all' | 'today' | 'yesterday' | 'this_week' | 'custom'

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
  </svg>
)

interface RecipientAccountOption {
  key: string
  userId?: string
  memberId: string
  memberName: string
  email?: string
  scheduleTitles: string[]
}

const matchesCategory = (schedule: Schedule, filter: ScheduleCategoryFilter): boolean => {
  if (filter === 'all') return true
  
  const cat = schedule.category || ''
  const title = (schedule.title || '').toLowerCase()
  
  let dayOfWeek = -1
  if (schedule.date) {
    const parts = schedule.date.split('-')
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      dayOfWeek = d.getDay()
    }
  }

  if (filter === 'sunday') {
    return (
      cat === 'mass_sunday' ||
      dayOfWeek === 0 ||
      title.includes('sunday') ||
      title.includes('anticipated')
    )
  }

  if (filter === 'weekdays') {
    return (
      cat === 'mass_weekday' ||
      (dayOfWeek >= 1 && dayOfWeek <= 6 && !title.includes('anticipated') && !title.includes('meeting') && !title.includes('formation') && !title.includes('special')) ||
      title.includes('weekday') ||
      title.includes('daily')
    )
  }

  if (filter === 'meeting') {
    return (
      cat === 'meeting' ||
      cat === 'meeting_and_formation' ||
      title.includes('meeting') ||
      title.includes('assembly') ||
      title.includes('pulong')
    )
  }

  if (filter === 'formation') {
    return (
      cat === 'formation' ||
      cat === 'meeting_and_formation' ||
      title.includes('formation') ||
      title.includes('ogf') ||
      title.includes('seminar') ||
      title.includes('recollection') ||
      title.includes('workshop')
    )
  }

  if (filter === 'special_events') {
    return (
      cat === 'special_event' ||
      cat === 'holy_hour' ||
      cat === 'practice' ||
      title.includes('special') ||
      title.includes('fiesta') ||
      title.includes('pyesta') ||
      title.includes('solemnity') ||
      title.includes('procession') ||
      title.includes('holy hour') ||
      title.includes('practice') ||
      title.includes('rehearsal')
    )
  }

  return true
}

const formatDateToYMD = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const RemindAttendanceModal: React.FC<RemindAttendanceModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [untakenSchedules, setUntakenSchedules] = useState<UntakenScheduleInfo[]>([])

  // Selection & Filter states
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([])
  const [selectedRecipientKeys, setSelectedRecipientKeys] = useState<string[]>([])
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<ScheduleCategoryFilter>('all')
  const [datePreset, setDatePreset] = useState<DatePresetFilter>('all')
  const [customDate, setCustomDate] = useState<string>('')
  const [customNote, setCustomNote] = useState('')
  const [reminderTemplate, setReminderTemplate] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isSendingNotifications, setIsSendingNotifications] = useState(false)
  const [sendProgress, setSendProgress] = useState<{
    active: boolean
    current: number
    total: number
    percentage: number
    statusLabel: string
  } | null>(null)

  // Collapsible section toggles for seamless mobile navigation
  const [isSchedulesSectionOpen, setIsSchedulesSectionOpen] = useState(true)
  const [isRecipientsSectionOpen, setIsRecipientsSectionOpen] = useState(true)
  const [isPreviewSectionOpen, setIsPreviewSectionOpen] = useState(true)

  // Load untaken schedules & reminder template
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    setLoading(true)

    settingsService.getReminderTemplate()
      .then(t => {
        if (isMounted) setReminderTemplate(t)
      })
      .catch(err => {
        console.error('Failed to load reminder template:', err)
      })

    notificationService.getUntakenSchedules()
      .then((schedulesData) => {
        if (!isMounted) return
        setUntakenSchedules(schedulesData)
        // Default: select all untaken schedules
        setSelectedScheduleIds(schedulesData.map((s: UntakenScheduleInfo) => s.schedule.id))
      })
      .catch((err) => {
        console.error('Failed to load untaken schedules:', err)
        toast.error('Load Error', 'Could not fetch untaken schedules.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen])

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<ScheduleCategoryFilter, number> = {
      all: untakenSchedules.length,
      sunday: 0,
      weekdays: 0,
      meeting: 0,
      formation: 0,
      special_events: 0
    }
    untakenSchedules.forEach(item => {
      if (matchesCategory(item.schedule, 'sunday')) counts.sunday++
      if (matchesCategory(item.schedule, 'weekdays')) counts.weekdays++
      if (matchesCategory(item.schedule, 'meeting')) counts.meeting++
      if (matchesCategory(item.schedule, 'formation')) counts.formation++
      if (matchesCategory(item.schedule, 'special_events')) counts.special_events++
    })
    return counts
  }, [untakenSchedules])

  // Date filtering calculation
  const filteredSchedules = useMemo(() => {
    const now = new Date()
    const todayStr = formatDateToYMD(now)

    const yesterdayDate = new Date(now)
    yesterdayDate.setDate(now.getDate() - 1)
    const yesterdayStr = formatDateToYMD(yesterdayDate)

    const dayOfWeek = now.getDay() // 0 = Sunday
    const weekStartDate = new Date(now)
    weekStartDate.setDate(now.getDate() - dayOfWeek)
    const weekStartStr = formatDateToYMD(weekStartDate)

    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekStartDate.getDate() + 6)
    const weekEndStr = formatDateToYMD(weekEndDate)

    return untakenSchedules.filter(item => {
      const s = item.schedule

      // 1. Category match
      if (!matchesCategory(s, categoryFilter)) return false

      // 2. Date match
      if (datePreset === 'today') {
        if (s.date !== todayStr) return false
      } else if (datePreset === 'yesterday') {
        if (s.date !== yesterdayStr) return false
      } else if (datePreset === 'this_week') {
        if (s.date < weekStartStr || s.date > weekEndStr) return false
      } else if (datePreset === 'custom' && customDate) {
        if (s.date !== customDate) return false
      }

      // 3. Search match
      if (scheduleSearch.trim()) {
        const q = scheduleSearch.toLowerCase().trim()
        const matches =
          s.title.toLowerCase().includes(q) ||
          (s.date && s.date.toLowerCase().includes(q))
        if (!matches) return false
      }

      return true
    })
  }, [untakenSchedules, categoryFilter, datePreset, customDate, scheduleSearch])

  // Selected schedule objects strictly scoped to the active filtered view
  const selectedScheduleObjects = useMemo(() => {
    const set = new Set(selectedScheduleIds)
    return filteredSchedules
      .filter(item => set.has(item.schedule.id))
      .map(item => item.schedule)
  }, [filteredSchedules, selectedScheduleIds])

  // Available unique accounts in the selected filtered schedules
  const availableRecipientAccounts = useMemo(() => {
    const map = new Map<string, RecipientAccountOption>()
    const selectedSet = new Set(selectedScheduleObjects.map(s => s.id))

    filteredSchedules.forEach(item => {
      if (!selectedSet.has(item.schedule.id)) return
      item.assignedAccounts.forEach(acc => {
        if (!acc.hasAccount) return
        const key = acc.userId || acc.memberId
        if (!key) return
        if (map.has(key)) {
          const existing = map.get(key)!
          if (!existing.scheduleTitles.includes(item.schedule.title)) {
            existing.scheduleTitles.push(item.schedule.title)
          }
        } else {
          map.set(key, {
            key,
            userId: acc.userId,
            memberId: acc.memberId,
            memberName: acc.memberName,
            email: acc.email,
            scheduleTitles: [item.schedule.title]
          })
        }
      })
    })
    return Array.from(map.values())
  }, [filteredSchedules, selectedScheduleObjects])

  // Auto-sync selected schedule IDs whenever category or date preset changes
  useEffect(() => {
    setSelectedScheduleIds(filteredSchedules.map(item => item.schedule.id))
  }, [categoryFilter, datePreset, customDate])

  // Auto-sync selected recipient keys when available recipient list changes
  useEffect(() => {
    setSelectedRecipientKeys(availableRecipientAccounts.map(a => a.key))
  }, [availableRecipientAccounts])

  // Generated Tagalog reminder text
  const reminderText = useMemo(() => {
    return generateUntakenScheduleReminderText({
      schedules: selectedScheduleObjects,
      customNote: customNote,
      template: reminderTemplate
    })
  }, [selectedScheduleObjects, customNote, reminderTemplate])

  // Selection handlers for schedules
  const handleToggleSchedule = (id: string) => {
    setSelectedScheduleIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredSchedules.map(item => item.schedule.id)
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every(id => selectedScheduleIds.includes(id))

    if (allFilteredSelected) {
      setSelectedScheduleIds(prev => prev.filter(id => !filteredIds.includes(id)))
    } else {
      setSelectedScheduleIds(prev => Array.from(new Set([...prev, ...filteredIds])))
    }
  }

  // Selection handlers for recipient accounts
  const handleToggleRecipient = (key: string) => {
    setSelectedRecipientKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleToggleAllRecipients = () => {
    const allKeys = availableRecipientAccounts.map(a => a.key)
    if (selectedRecipientKeys.length === allKeys.length) {
      setSelectedRecipientKeys([])
    } else {
      setSelectedRecipientKeys(allKeys)
    }
  }

  const handleCopy = async () => {
    if (selectedScheduleIds.length === 0) {
      toast.warning('Select Schedules', 'Please select at least one schedule to copy the reminder.')
      return
    }
    try {
      await navigator.clipboard.writeText(reminderText)
      setCopied(true)
      toast.success('Copied to Clipboard!', 'Ready to paste into your group chat or message thread.')
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Failed to copy text:', err)
      toast.error('Copy Failed', 'Could not copy to clipboard. Please highlight and copy manually.')
    }
  }

  const handleSendInAppNotifications = async () => {
    const activeSelectedIds = selectedScheduleObjects.map(s => s.id)
    if (activeSelectedIds.length === 0) {
      toast.warning('Select Schedules', 'Please select at least one schedule to send reminders.')
      return
    }
    if (selectedRecipientKeys.length === 0) {
      toast.warning('Select Server Accounts', 'Please select at least one altar server account to receive the notification.')
      return
    }

    const targetRecipientIds = selectedRecipientKeys.flatMap(k => {
      const acc = availableRecipientAccounts.find(a => a.key === k)
      if (!acc) return [k]
      return [acc.key, acc.userId, acc.memberId, acc.email].filter(Boolean) as string[]
    })

    setIsSendingNotifications(true)
    setSendProgress({
      active: true,
      current: 0,
      total: activeSelectedIds.length,
      percentage: 10,
      statusLabel: 'Initializing reminder dispatch...'
    })

    try {
      const res = await notificationService.sendBulkAttendanceReminders(
        {
          scheduleIds: activeSelectedIds,
          customMessage: customNote,
          targetAudienceType: 'custom_members',
          customMemberIds: targetRecipientIds,
          performedBy: profile?.displayName || profile?.memberName || user?.email || 'Administrator'
        },
        (prog) => {
          setSendProgress({
            active: prog.active,
            current: prog.current,
            total: prog.total,
            percentage: prog.percentage,
            statusLabel: prog.statusLabel || 'Sending reminders...'
          })
        }
      )

      if (res.schedulesReminded > 0 || res.officersNotified > 0) {
        toast.success(
          'In-App Reminders Dispatched!',
          `Sent in-app notification alerts for ${res.schedulesReminded} schedule(s) to ${selectedRecipientKeys.length} selected server account(s).`
        )
      } else {
        toast.info('Completed', 'Notification process completed.')
      }
    } catch (err: any) {
      console.error('Failed to send reminders:', err)
      toast.error('Dispatch Failed', err.message || 'Could not send in-app reminder notifications.')
    } finally {
      setIsSendingNotifications(false)
      // Keep completion progress visible briefly for visual satisfaction
      setTimeout(() => {
        setSendProgress(null)
      }, 1500)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pending Attendance Reminder"
      maxWidth="4xl"
    >
      <div className="space-y-5">
        {/* Top Information Banner */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3.5">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Untaken Attendance Reminder & Notification Manager
              </h4>
              <p className="text-xs text-indigo-700/90 mt-0.5 leading-relaxed">
                Pumili ng mga schedules, piliin kung aling specific na mga altar server accounts ang makatatanggap ng in-app notification alert, o kopyahin ang formatted GC message.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold">Loading untaken schedules...</p>
          </div>
        ) : untakenSchedules.length === 0 ? (
          <div className="py-12 px-4 text-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/50">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-emerald-950">All Attendances Are Complete!</h3>
            <p className="text-xs text-emerald-700 mt-1 max-w-sm mx-auto">
              There are no untaken schedules remaining. All sessions are recorded or finalized.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Filter & Selector (6 cols) */}
            <div className="lg:col-span-6 flex flex-col space-y-4 min-h-0">
              
              {/* SECTION 1: Collapsible Schedule Selector Card */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all">
                {/* Collapsible Header */}
                <div
                  onClick={() => setIsSchedulesSectionOpen(!isSchedulesSectionOpen)}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer flex items-center justify-between border-b border-slate-100 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1 rounded-md bg-white border border-slate-200 text-slate-600 transition-transform duration-200 ${isSchedulesSectionOpen ? 'rotate-180' : ''}`}>
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
                      1. Select Schedules
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                      {selectedScheduleIds.length}/{untakenSchedules.length}
                    </span>
                  </div>

                  {untakenSchedules.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (selectedScheduleIds.length > 0) {
                          setSelectedScheduleIds([])
                        } else {
                          setSelectedScheduleIds(untakenSchedules.map(s => s.schedule.id))
                        }
                      }}
                      className="text-[11px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      {selectedScheduleIds.length > 0 ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Collapsible Body */}
                {isSchedulesSectionOpen && (
                  <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
                    {/* Search input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search schedules by title or date..."
                        value={scheduleSearch}
                        onChange={e => setScheduleSearch(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 pl-8 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {scheduleSearch && (
                        <button
                          type="button"
                          onClick={() => setScheduleSearch('')}
                          className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold p-0.5"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Compact Filter Toolbar: Date & Category */}
                    <div className="space-y-2 bg-slate-50/70 p-2 rounded-xl border border-slate-200/60">
                      {/* Date Presets Row */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                          Date:
                        </span>
                        {[
                          { id: 'all', label: 'All' },
                          { id: 'today', label: 'Today' },
                          { id: 'yesterday', label: 'Yesterday' },
                          { id: 'this_week', label: 'This Week' },
                          { id: 'custom', label: 'Custom' }
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setDatePreset(p.id as DatePresetFilter)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer ${
                              datePreset === p.id
                                ? 'bg-slate-800 text-white shadow-2xs'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      {datePreset === 'custom' && (
                        <div>
                          <input
                            type="date"
                            value={customDate}
                            onChange={e => setCustomDate(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      {/* Category Chips Row */}
                      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                          Type:
                        </span>
                        {[
                          { id: 'all', label: 'All', count: categoryCounts.all },
                          { id: 'sunday', label: 'Sunday', count: categoryCounts.sunday },
                          { id: 'weekdays', label: 'Weekdays', count: categoryCounts.weekdays },
                          { id: 'meeting', label: 'Meetings', count: categoryCounts.meeting },
                          { id: 'formation', label: 'Formation', count: categoryCounts.formation },
                          { id: 'special_events', label: 'Special', count: categoryCounts.special_events },
                        ].map(cat => {
                          const isActive = categoryFilter === cat.id
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => setCategoryFilter(cat.id as ScheduleCategoryFilter)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{cat.label}</span>
                              <span className={`px-1 rounded text-[8px] ${
                                isActive ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {cat.count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Results Info & Filtered Quick-Select */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
                      <span>
                        Showing <strong className="text-slate-800">{filteredSchedules.length}</strong> of {untakenSchedules.length} schedules
                      </span>
                      {filteredSchedules.length > 0 && filteredSchedules.length < untakenSchedules.length && (
                        <button
                          type="button"
                          onClick={() => handleSelectAllFiltered()}
                          className="text-[10px] font-extrabold text-indigo-600 hover:underline cursor-pointer"
                        >
                          {filteredSchedules.every(s => selectedScheduleIds.includes(s.schedule.id))
                            ? 'Uncheck filtered'
                            : 'Check filtered only'}
                        </button>
                      )}
                    </div>

                    {/* Schedule List Scroll Area with checkboxes */}
                    <div className="border border-slate-200 rounded-xl p-2 bg-slate-50/40 space-y-2 max-h-[220px] overflow-y-auto">
                      {filteredSchedules.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                          No schedules match the selected filters.
                        </div>
                      ) : (
                        filteredSchedules.map(item => {
                          const s = item.schedule
                          const isSelected = selectedScheduleIds.includes(s.id)
                          const day = getDayOfWeek(s.date)
                          const dateFormatted = formatReadableDate(s.date)
                          const timeFormatted = s.startTime ? formatTime12Hour(s.startTime) : ''

                          return (
                            <div
                              key={s.id}
                              onClick={() => handleToggleSchedule(s.id)}
                              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 select-none ${
                                isSelected
                                  ? 'bg-indigo-50/80 border-indigo-200 shadow-2xs'
                                  : 'bg-white border-slate-200/80 hover:border-slate-300 opacity-70'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  e.stopPropagation()
                                  handleToggleSchedule(s.id)
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-extrabold uppercase text-indigo-600 tracking-wider">
                                    {day ? `${day}, ` : ''}{dateFormatted}
                                  </span>
                                  {timeFormatted && (
                                    <span className="text-[10px] font-bold text-slate-500">
                                      {timeFormatted}
                                    </span>
                                  )}
                                </div>
                                <h5 className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                                  {s.title}
                                </h5>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {item.totalAssignedCount} assigned ({item.assignedAccountsCount} with account)
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: Collapsible Target Accounts Checklist */}
              <div className="rounded-2xl border border-amber-200 bg-white shadow-2xs overflow-hidden transition-all">
                {/* Collapsible Header */}
                <div
                  onClick={() => setIsRecipientsSectionOpen(!isRecipientsSectionOpen)}
                  className="p-3 bg-amber-50/80 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-center justify-between border-b border-amber-100 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1 rounded-md bg-white border border-amber-200 text-amber-700 transition-transform duration-200 ${isRecipientsSectionOpen ? 'rotate-180' : ''}`}>
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-950 truncate">
                      2. Target Accounts to Notify
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200/90 text-amber-900 border border-amber-300 shrink-0">
                      {selectedRecipientKeys.length}/{availableRecipientAccounts.length}
                    </span>
                  </div>

                  {availableRecipientAccounts.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleAllRecipients()
                      }}
                      className="text-[11px] font-extrabold text-amber-900 hover:underline cursor-pointer shrink-0"
                    >
                      {selectedRecipientKeys.length === availableRecipientAccounts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Collapsible Body */}
                {isRecipientsSectionOpen && (
                  <div className="p-3 space-y-2 bg-amber-50/20 animate-in fade-in duration-150">
                    {availableRecipientAccounts.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400 italic">
                        No active server accounts linked to the selected schedules.
                      </div>
                    ) : (
                      <div className="max-h-[170px] overflow-y-auto space-y-1.5 pr-1">
                        {availableRecipientAccounts.map((acc) => {
                          const isChecked = selectedRecipientKeys.includes(acc.key)
                          return (
                            <div
                              key={acc.key}
                              onClick={() => handleToggleRecipient(acc.key)}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                                isChecked
                                  ? 'bg-white border-amber-300 shadow-2xs'
                                  : 'bg-amber-100/30 border-amber-200/60 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    e.stopPropagation()
                                    handleToggleRecipient(acc.key)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="h-3.5 w-3.5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <div className="min-w-0">
                                  <span className="text-xs font-bold text-slate-900 block truncate">
                                    {acc.memberName}
                                  </span>
                                  <span className="text-[10px] text-slate-500 block truncate">
                                    {acc.email || 'Registered Server Account'}
                                  </span>
                                </div>
                              </div>

                              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200 shrink-0 ml-2">
                                {acc.scheduleTitles.length} duty
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Right Column: Live Text Preview (6 cols) */}
            <div className="lg:col-span-6 flex flex-col space-y-4 min-h-0">
              
              {/* SECTION 3: Collapsible GC Preview Card */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-2xs overflow-hidden transition-all flex flex-col flex-1">
                {/* Collapsible Header */}
                <div
                  onClick={() => setIsPreviewSectionOpen(!isPreviewSectionOpen)}
                  className="p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer flex items-center justify-between border-b border-slate-100 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`p-1 rounded-md bg-white border border-slate-200 text-slate-600 transition-transform duration-200 ${isPreviewSectionOpen ? 'rotate-180' : ''}`}>
                      <ChevronDownIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
                      3. GC Message Preview & Notes
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 shrink-0">
                    {selectedScheduleObjects.length} schedule(s)
                  </span>
                </div>

                {/* Collapsible Body */}
                {isPreviewSectionOpen && (
                  <div className="p-3 space-y-3 flex-1 flex flex-col animate-in fade-in duration-150">
                    {/* Textarea Preview */}
                    <textarea
                      readOnly
                      value={reminderText}
                      onClick={e => (e.target as HTMLTextAreaElement).select()}
                      className="w-full rounded-xl border border-slate-200 bg-slate-900 text-slate-100 p-3 text-xs font-mono font-medium focus:outline-none resize-none h-[180px] sm:h-[220px] overflow-y-auto leading-relaxed select-all shadow-inner"
                    />

                    {/* Optional Custom Note Input */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-600">
                        Custom Note / Additional Announcement (Optional):
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Please bring your vestments and log in before 5:30 PM..."
                        value={customNote}
                        onChange={e => setCustomNote(e.target.value)}
                        className="w-full text-xs rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Progressive Progress Bar for Bulk Dispatching */}
        {sendProgress && (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-blue-50 p-4 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                </span>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {sendProgress.statusLabel || 'Sending reminders...'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black text-blue-700 font-mono bg-white px-2 py-0.5 rounded-md border border-blue-100 shadow-2xs">
                  {sendProgress.percentage}%
                </span>
              </div>
            </div>

            {/* Progressive Bar Track */}
            <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                style={{ width: `${Math.min(100, Math.max(5, sendProgress.percentage))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold mt-2">
              <span>Progress: {sendProgress.current} / {sendProgress.total} schedules processed</span>
              <span>{sendProgress.percentage >= 100 ? '✅ Completed!' : '⚡ Dispatching alerts...'}</span>
            </div>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="text-[11px] text-slate-500 font-medium">
            {selectedRecipientKeys.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {selectedRecipientKeys.length} server account(s) selected for notification
              </span>
            ) : (
              <span className="text-slate-400 italic">No accounts selected for notification</span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              onClick={onClose}
              disabled={isSendingNotifications}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="purple"
              size="dense"
              onClick={handleCopy}
              disabled={selectedScheduleIds.length === 0 || isSendingNotifications}
              icon={
                copied ? (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )
              }
            >
              {copied ? 'Copied GC Text!' : 'Copy for GC / Messenger'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="dense"
              onClick={handleSendInAppNotifications}
              disabled={selectedScheduleIds.length === 0 || selectedRecipientKeys.length === 0 || isSendingNotifications}
              loading={isSendingNotifications}
              icon={
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              }
            >
              Send In-App Notification ({selectedRecipientKeys.length})
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
