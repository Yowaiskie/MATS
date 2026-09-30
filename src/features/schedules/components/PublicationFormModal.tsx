import React, { useState, useEffect } from 'react'
import type { SchedulePublication, SchedulePublicationInput } from '@/types/publication'
import type { ScheduleTemplate } from '@/types/schedule'
import { recurringService } from '@/services/recurringService'
import { scheduleService } from '@/services/scheduleService'
import { isScheduleIncludedInPublication } from '@/utils/scheduleUtils'
import { CustomSelect, Button } from '@/components'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft (Temporary Closed)' },
  { value: 'published', label: 'Published (Open for Scheduling)' },
  { value: 'archived', label: 'Archived (Totally Closed & Locked)' },
]

export const LITURGICAL_COLORS = [
  { id: 'green', label: 'Green', sub: 'Ordinary Time (Karaniwang Panahon)', hex: '#059669', badgeClass: 'bg-emerald-500' },
  { id: 'white', label: 'White / Gold', sub: 'Easter, Christmas, Feasts of the Lord & Mary', hex: '#fbbf24', badgeClass: 'bg-amber-400' },
  { id: 'purple', label: 'Violet / Purple', sub: 'Advent, Lent, Penitential & Memorials', hex: '#9333ea', badgeClass: 'bg-purple-600' },
  { id: 'red', label: 'Red', sub: 'Pentecost, Palm Sunday, Good Friday, Martyrs', hex: '#e11d48', badgeClass: 'bg-rose-600' },
  { id: 'rose', label: 'Rose / Pink', sub: 'Gaudete & Laetare Sundays', hex: '#f472b6', badgeClass: 'bg-pink-400' },
  { id: 'blue', label: 'Blue', sub: 'Marian Feasts & Solemnities', hex: '#0284c7', badgeClass: 'bg-sky-600' },
] as const

export interface CustomEventSlotInput {
  scheduleId?: string
  date: string
  title: string
  startTime: string
  endTime: string
  location?: string
  liturgicalColor?: string
}

interface CustomEventSlotItem {
  id: string
  scheduleId?: string
  date: string
  dayName: string
  title: string
  startTime: string
  endTime: string
  location: string
  liturgicalColor?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (
    input: SchedulePublicationInput,
    generateSchedules: boolean,
    selectedTemplateIds: string[],
    customEventSlots?: CustomEventSlotInput[]
  ) => Promise<void>
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
  const [submissionDeadline, setSubmissionDeadline] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft')
  const [maxSundaysPerServer, setMaxSundaysPerServer] = useState<number>(4)
  const [maxWeekdaysPerServer, setMaxWeekdaysPerServer] = useState<number>(8)
  const [maxServersPerSundaySlot, setMaxServersPerSundaySlot] = useState<number>(5)
  const [maxServersPerWeekdaySlot, setMaxServersPerWeekdaySlot] = useState<number>(5)
  const [includeSundays, setIncludeSundays] = useState<boolean>(true)
  const [includeWeekdays, setIncludeWeekdays] = useState<boolean>(true)
  const [includeHolyHour, setIncludeHolyHour] = useState<boolean>(false)
  const [includeMeetings, setIncludeMeetings] = useState<boolean>(false)
  const [customExcludedKeywords, setCustomExcludedKeywords] = useState<string>('')
  const [allowedRanks, setAllowedRanks] = useState<string[]>(['Chevaliers', 'Paladins'])
  const [generateSchedules, setGenerateSchedules] = useState<boolean>(true)
  const [warningAbsenceThreshold, setWarningAbsenceThreshold] = useState<number>(3)
  const [suspensionAbsenceThreshold, setSuspensionAbsenceThreshold] = useState<number>(5)
  const [publicationType, setPublicationType] = useState<'regular' | 'special_event'>('regular')
  const [includeSpecialEvents, setIncludeSpecialEvents] = useState<boolean>(false)
  const [includedDaysOfWeek, setIncludedDaysOfWeek] = useState<string[]>([])
  const [enableStreetLocation, setEnableStreetLocation] = useState<boolean>(false)
  const [maxSpecialPerServer, setMaxSpecialPerServer] = useState<number>(2)
  const [maxServersPerSpecialSlot, setMaxServersPerSpecialSlot] = useState<number>(6)
  const [enableRankQuotas, setEnableRankQuotas] = useState<boolean>(true)
  const [maxChevaliersPerSlot, setMaxChevaliersPerSlot] = useState<number>(2)
  const [maxPaladinsPerSlot, setMaxPaladinsPerSlot] = useState<number>(3)
  const [maxSquiresPerSlot, setMaxSquiresPerSlot] = useState<number>(0)
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([])
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Slot Generator & Weekly Street Location Builder State
  const [defaultSlotTitle, setDefaultSlotTitle] = useState('')
  const [defaultStartTime, setDefaultStartTime] = useState('18:00')
  const [defaultEndTime, setDefaultEndTime] = useState('19:00')
  const [liturgicalColor, setLiturgicalColor] = useState<string>('purple')
  const [eventSlots, setEventSlots] = useState<CustomEventSlotItem[]>([])
  const [autoGenerateSpecialSlots, setAutoGenerateSpecialSlots] = useState<boolean>(true)

  // Calculate approximate duration in months from start and end dates
  const calculateDurationMonths = (start: string, end: string): number => {
    if (!start || !end) return 2
    const d1 = new Date(start)
    const d2 = new Date(end)
    const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 35) return 1
    if (diffDays <= 75) return 2
    if (diffDays <= 110) return 3
    return Math.round(diffDays / 30)
  }

  // Helper to compute dates between start and end matching selected days
  const computeMatchingDates = (
    start: string,
    end: string,
    daysFilter: string[],
    defaultTitle: string,
    startT: string,
    endT: string,
    prevSlots: CustomEventSlotItem[]
  ): CustomEventSlotItem[] => {
    if (!start || !end || start > end) return []
    const [sY, sM, sD] = start.split('-').map(Number)
    const [eY, eM, eD] = end.split('-').map(Number)
    const dStart = new Date(sY, sM - 1, sD)
    const dEnd = new Date(eY, eM - 1, eD)

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const items: CustomEventSlotItem[] = []
    const prevMap = new Map(prevSlots.map(s => [s.date, s]))

    for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
      const currentDay = dayNames[d.getDay()]
      if (daysFilter.length > 0 && !daysFilter.some(df => df.toLowerCase() === currentDay.toLowerCase())) {
        continue
      }
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const existing = prevMap.get(dateStr)

      items.push({
        id: existing ? existing.id : `${dateStr}-${Math.random().toString(36).substring(2, 7)}`,
        scheduleId: existing?.scheduleId,
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        title: existing?.title || defaultTitle || 'Special Mass',
        startTime: existing?.startTime || startT || '18:00',
        endTime: existing?.endTime || endT || '19:00',
        location: existing?.location || '',
        liturgicalColor: existing?.liturgicalColor || liturgicalColor || 'purple'
      })
    }

    return items
  }

  const handleDateChange = (newStart: string, newEnd: string) => {
    setStartDate(newStart)
    setEndDate(newEnd)
    if (newStart && newEnd && newStart <= newEnd) {
      const months = calculateDurationMonths(newStart, newEnd)
      if (months === 1) {
        setWarningAbsenceThreshold(2)
        setSuspensionAbsenceThreshold(3)
      } else if (months === 2) {
        setWarningAbsenceThreshold(3)
        setSuspensionAbsenceThreshold(5)
      } else if (months >= 3) {
        setWarningAbsenceThreshold(4)
        setSuspensionAbsenceThreshold(7)
      }

      setEventSlots(prev => 
        computeMatchingDates(newStart, newEnd, includedDaysOfWeek, defaultSlotTitle || name, defaultStartTime, defaultEndTime, prev)
      )
    }
  }

  const handleTypeChange = (type: 'regular' | 'special_event') => {
    setPublicationType(type)
    if (type === 'special_event') {
      setIncludeSpecialEvents(true)
      setIncludeSundays(false)
      setIncludeWeekdays(false)
      setGenerateSchedules(false)
      setAutoGenerateSpecialSlots(true)
      if (!defaultSlotTitle) {
        setDefaultSlotTitle(name || 'Misa sa Nayon / Kalye')
      }
    } else {
      setIncludeSpecialEvents(false)
      setIncludeSundays(true)
      setIncludeWeekdays(true)
    }
  }

  const toggleDayOfWeek = (day: string) => {
    const updated = includedDaysOfWeek.includes(day)
      ? includedDaysOfWeek.filter(d => d !== day)
      : [...includedDaysOfWeek, day]

    setIncludedDaysOfWeek(updated)
    setEventSlots(prev => 
      computeMatchingDates(startDate, endDate, updated, defaultSlotTitle || name, defaultStartTime, defaultEndTime, prev)
    )
  }

  const updateSlotLocation = (id: string, loc: string) => {
    setEventSlots(prev => prev.map(s => s.id === id ? { ...s, location: loc } : s))
  }

  const updateSlotTitle = (id: string, title: string) => {
    setEventSlots(prev => prev.map(s => s.id === id ? { ...s, title } : s))
  }

  const removeEventSlot = (id: string) => {
    setEventSlots(prev => prev.filter(s => s.id !== id))
  }

  const handleClearAllSlots = () => {
    setEventSlots([])
  }

  const handleRegenerateSlots = () => {
    if (!startDate || !endDate || startDate > endDate) return
    setEventSlots(
      computeMatchingDates(
        startDate,
        endDate,
        includedDaysOfWeek,
        defaultSlotTitle || name || 'Special Mass',
        defaultStartTime,
        defaultEndTime,
        []
      )
    )
  }

  const addNewCustomSlot = () => {
    const todayStr = startDate || new Date().toISOString().split('T')[0]
    const [y, m, d] = todayStr.split('-').map(Number)
    const dObj = new Date(y, m - 1, d)
    setEventSlots(prev => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: todayStr,
        dayName: isNaN(dObj.getTime()) ? 'Custom Date' : dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        title: defaultSlotTitle || name || 'Special Mass',
        startTime: defaultStartTime,
        endTime: defaultEndTime,
        location: ''
      }
    ])
  }

  const applyTitleToAll = (title: string) => {
    setEventSlots(prev => prev.map(s => ({ ...s, title })))
  }

  const applyTimeToAll = (startT: string, endT: string) => {
    setEventSlots(prev => prev.map(s => ({ ...s, startTime: startT, endTime: endT })))
  }

  useEffect(() => {
    if (isOpen) {
      if (publication) {
        setName(publication.name)
        setStartDate(publication.startDate)
        setEndDate(publication.endDate)
        setSubmissionDeadline(publication.submissionDeadline || '')
        setDescription(publication.description || '')
        setStatus(publication.status)
        setLiturgicalColor(publication.liturgicalColor || 'purple')
        const isSpecial = publication.publicationType === 'special_event' || (!!publication.includeSpecialEvents && !publication.includeSundays && !publication.includeWeekdays)
        setPublicationType(isSpecial ? 'special_event' : 'regular')
        setMaxSundaysPerServer(publication.maxSundaysPerServer ?? 4)
        setMaxWeekdaysPerServer(publication.maxWeekdaysPerServer ?? 8)
        setMaxSpecialPerServer(publication.maxSpecialPerServer ?? 2)
        setMaxServersPerSundaySlot(publication.maxServersPerSundaySlot ?? 5)
        setMaxServersPerWeekdaySlot(publication.maxServersPerWeekdaySlot ?? 5)
        setMaxServersPerSpecialSlot(publication.maxServersPerSpecialSlot ?? 6)
        setEnableRankQuotas(publication.enableRankQuotas ?? true)
        setMaxChevaliersPerSlot(
          publication.rankSlotQuotas?.Chevaliers ?? 
          (isSpecial ? 3 : 2)
        )
        setMaxPaladinsPerSlot(
          publication.rankSlotQuotas?.Paladins ?? 
          (isSpecial ? 3 : 3)
        )
        setMaxSquiresPerSlot(publication.rankSlotQuotas?.Squires ?? 0)
        setIncludeSundays(publication.includeSundays ?? !isSpecial)
        setIncludeWeekdays(publication.includeWeekdays ?? !isSpecial)
        setIncludeHolyHour(publication.includeHolyHour ?? false)
        setIncludeMeetings(publication.includeMeetings ?? false)
        setIncludeSpecialEvents(publication.includeSpecialEvents ?? isSpecial)
        setIncludedDaysOfWeek(publication.includedDaysOfWeek || [])
        setEnableStreetLocation(publication.enableStreetLocation || false)
        setCustomExcludedKeywords((publication.customExcludedKeywords || []).join(', '))
        setAllowedRanks(publication.allowedRanks ?? ['Chevaliers', 'Paladins'])
        setWarningAbsenceThreshold(publication.warningAbsenceThreshold ?? 3)
        setSuspensionAbsenceThreshold(publication.suspensionAbsenceThreshold ?? 5)
        setGenerateSchedules(false) // Default to false when editing
        setDefaultSlotTitle(publication.name || '')
        setDefaultStartTime('18:00')
        const isEventMode = isSpecial || !!publication.enableStreetLocation || (publication.includedDaysOfWeek || []).length > 0
        setAutoGenerateSpecialSlots(isEventMode)
        
        // Asynchronously load existing schedules in this publication date range to populate eventSlots & locations
        const loadExistingSchedules = async () => {
          try {
            const existing = await scheduleService.getSchedulesByDateRange(publication.startDate, publication.endDate)
            const valid = existing.filter(s => isScheduleIncludedInPublication(s, publication))
            if (valid.length > 0) {
              const loadedItems: CustomEventSlotItem[] = valid.map(s => {
                const [y, m, d] = s.date.split('-').map(Number)
                const dateObj = new Date(y, m - 1, d)
                return {
                  id: s.id,
                  scheduleId: s.id,
                  date: s.date,
                  dayName: dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
                  title: s.title,
                  startTime: s.startTime,
                  endTime: s.endTime,
                  location: s.location || '',
                  liturgicalColor: s.liturgicalColor || publication.liturgicalColor || 'purple'
                }
              })
              setEventSlots(loadedItems)
              if (loadedItems[0]?.title) setDefaultSlotTitle(loadedItems[0].title)
              if (loadedItems[0]?.startTime) setDefaultStartTime(loadedItems[0].startTime)
              if (loadedItems[0]?.endTime) setDefaultEndTime(loadedItems[0].endTime)
            } else {
              setEventSlots(
                computeMatchingDates(
                  publication.startDate,
                  publication.endDate,
                  publication.includedDaysOfWeek || [],
                  publication.name,
                  '18:00',
                  '19:00',
                  []
                )
              )
            }
          } catch (e) {
            console.error('Failed to load existing publication schedules:', e)
            setEventSlots(
              computeMatchingDates(
                publication.startDate,
                publication.endDate,
                publication.includedDaysOfWeek || [],
                publication.name,
                '18:00',
                '19:00',
                []
              )
            )
          }
        }
        loadExistingSchedules()
      } else {
        setName('')
        setStartDate('')
        setEndDate('')
        setSubmissionDeadline('')
        setDescription('')
        setStatus('draft')
        setPublicationType('regular')
        setMaxSundaysPerServer(4)
        setMaxWeekdaysPerServer(8)
        setMaxSpecialPerServer(2)
        setMaxServersPerSundaySlot(5)
        setMaxServersPerWeekdaySlot(5)
        setMaxServersPerSpecialSlot(6)
        setEnableRankQuotas(true)
        setMaxChevaliersPerSlot(2)
        setMaxPaladinsPerSlot(3)
        setMaxSquiresPerSlot(0)
        setIncludeSundays(true)
        setIncludeWeekdays(true)
        setIncludeHolyHour(false)
        setIncludeMeetings(false)
        setIncludeSpecialEvents(false)
        setIncludedDaysOfWeek([])
        setEnableStreetLocation(false)
        setCustomExcludedKeywords('')
        setAllowedRanks(['Chevaliers', 'Paladins'])
        setWarningAbsenceThreshold(3)
        setSuspensionAbsenceThreshold(5)
        setGenerateSchedules(true) // Default to true when creating
        setDefaultSlotTitle('')
        setDefaultStartTime('18:00')
        setDefaultEndTime('19:00')
        setAutoGenerateSpecialSlots(true)
        setEventSlots([])
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

  const currentSlotCapacity = publicationType === 'special_event'
    ? maxServersPerSpecialSlot
    : maxServersPerSundaySlot

  const totalRankAllotment = (enableRankQuotas ? maxChevaliersPerSlot : 0) +
    (enableRankQuotas ? maxPaladinsPerSlot : 0) +
    (enableRankQuotas && allowedRanks.includes('Squires') ? maxSquiresPerSlot : 0)

  const isRankExceeding = enableRankQuotas && totalRankAllotment > currentSlotCapacity

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (startDate > endDate) {
      setError('Start date cannot be after end date.')
      return
    }

    if (enableRankQuotas && totalRankAllotment > currentSlotCapacity) {
      setError(`Total rank allotment (${totalRankAllotment}) cannot exceed the Max Servers per Slot (${currentSlotCapacity}). Please adjust Chevaliers, Paladins, or Squires.`)
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      const excludedKwList = customExcludedKeywords
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0)

      const isCustomSlotMode = publicationType === 'special_event' || enableStreetLocation || includedDaysOfWeek.length > 0 || autoGenerateSpecialSlots
      const customSlotsPayload: CustomEventSlotInput[] | undefined = 
        (isCustomSlotMode && eventSlots.length > 0)
          ? eventSlots.map(s => ({
              scheduleId: s.scheduleId,
              date: s.date,
              title: s.title?.trim() || defaultSlotTitle.trim() || name.trim() || 'Special Mass',
              startTime: s.startTime || defaultStartTime || '18:00',
              endTime: s.endTime || defaultEndTime || '19:00',
              location: s.location ? s.location.trim() : '',
              liturgicalColor: s.liturgicalColor || liturgicalColor || undefined
            }))
          : undefined

      await onSubmit({ 
        name, startDate, endDate, description, status,
        publicationType,
        liturgicalColor: liturgicalColor || undefined,
        submissionDeadline: submissionDeadline || undefined,
        maxSundaysPerServer, maxWeekdaysPerServer,
        maxSpecialPerServer,
        maxServersPerSundaySlot, maxServersPerWeekdaySlot,
        maxServersPerSpecialSlot,
        enableRankQuotas,
        rankSlotQuotas: enableRankQuotas ? {
          Chevaliers: maxChevaliersPerSlot,
          Paladins: maxPaladinsPerSlot,
          ...(maxSquiresPerSlot > 0 ? { Squires: maxSquiresPerSlot } : {})
        } : undefined,
        sundayRankQuotas: enableRankQuotas ? {
          Chevaliers: maxChevaliersPerSlot,
          Paladins: maxPaladinsPerSlot,
          ...(maxSquiresPerSlot > 0 ? { Squires: maxSquiresPerSlot } : {})
        } : undefined,
        weekdayRankQuotas: enableRankQuotas ? {
          Chevaliers: maxChevaliersPerSlot,
          Paladins: maxPaladinsPerSlot,
          ...(maxSquiresPerSlot > 0 ? { Squires: maxSquiresPerSlot } : {})
        } : undefined,
        specialRankQuotas: enableRankQuotas ? {
          Chevaliers: maxChevaliersPerSlot,
          Paladins: maxPaladinsPerSlot,
          ...(maxSquiresPerSlot > 0 ? { Squires: maxSquiresPerSlot } : {})
        } : undefined,
        includeSundays, includeWeekdays,
        includeHolyHour, includeMeetings,
        includeSpecialEvents: publicationType === 'special_event' ? true : includeSpecialEvents,
        includedDaysOfWeek,
        enableStreetLocation,
        customExcludedKeywords: excludedKwList,
        allowedRanks,
        warningAbsenceThreshold,
        suspensionAbsenceThreshold
      }, generateSchedules, selectedTemplateIds, customSlotsPayload)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save publication.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Publication Setup
              </span>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {publication ? 'Edit Publication' : 'Create Publication'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-3.5 bg-rose-50 text-rose-800 text-xs font-bold rounded-2xl border border-rose-200 animate-fade-in">
              {error}
            </div>
          )}

          <form id="pub-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Publication Type Selector */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-2">
                Publication Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('regular')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    publicationType === 'regular'
                      ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${publicationType === 'regular' ? 'text-indigo-900' : 'text-slate-700'}`}>
                      Regular Mass Cycle
                    </span>
                    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                      publicationType === 'regular' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                    }`}>
                      {publicationType === 'regular' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight">
                    Monthly operating rotation (Sunday & Weekday Masses).
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('special_event')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    publicationType === 'special_event'
                      ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70 text-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black ${publicationType === 'special_event' ? 'text-purple-900' : 'text-slate-700'}`}>
                      Special Occasion / Event
                    </span>
                    <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                      publicationType === 'special_event' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'
                    }`}>
                      {publicationType === 'special_event' && <span className="w-1 h-1 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight">
                    Dedicated roster for Fiestas, Triduum, and Solemnities.
                  </span>
                </button>
              </div>
            </div>

            {publicationType === 'special_event' && (
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl text-purple-950 text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-900">
                  <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Special Occasion Mode Active</span>
                </div>
                <p className="text-[11px] text-purple-800 leading-relaxed font-medium">
                  This publication is isolated from the regular Sunday/Weekday operating cycle. Altar servers accessing this link will only see special event slots within this date range.
                </p>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Publication Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder={publicationType === 'special_event' ? 'e.g. Parish Fiesta 2026 Special Schedule' : 'e.g. October 2026 Regular Schedule'}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-semibold"
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
                  onChange={(e) => handleDateChange(e.target.value, endDate)}
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
                  onChange={(e) => handleDateChange(startDate, e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase text-gray-500 mb-1.5">
                Submission Deadline (Optional)
              </label>
              <input
                type="datetime-local"
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium text-gray-800"
              />
              <span className="text-[10px] text-gray-400 font-medium block mt-1">
                Members who do not submit by this deadline can be automatically assigned via &quot;Auto-Assign Randomly&quot;.
              </span>
            </div>

            <CustomSelect
              label="Publication Status & Link Access"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={STATUS_OPTIONS}
            />

            {/* Limit Rules Section */}
            <div className="space-y-4 pt-2 border-t border-gray-100">
              {/* Section 1: Server Selection Limits */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-slate-800">1. Individual Server Limits (per Person)</span>
                  <span className="text-[10px] text-slate-500 font-medium leading-tight block mt-0.5">
                    Maximum number of schedule slots each member is allowed to select.
                  </span>
                </div>
                {publicationType === 'special_event' ? (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-purple-800 mb-1">
                      Max Special Occasion Slots / Person
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxSpecialPerServer}
                      onChange={(e) => setMaxSpecialPerServer(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold text-purple-900"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                        Max Sundays / Person
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxSundaysPerServer}
                        onChange={(e) => setMaxSundaysPerServer(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-600 mb-1">
                        Max Weekdays / Person
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={maxWeekdaysPerServer}
                        onChange={(e) => setMaxWeekdaysPerServer(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Per Mass Slot Server Capacity */}
              <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 space-y-3">
                <div>
                  <span className="block text-xs font-black text-indigo-950">2. Mass Capacity Limits (per Time Slot)</span>
                  <span className="text-[10px] text-indigo-700 font-medium leading-tight block mt-0.5">
                    Maximum number of altar servers allowed to serve in a single Mass time slot.
                  </span>
                </div>
                {publicationType === 'special_event' ? (
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-purple-800 mb-1">
                      Max Servers / Special Event Slot
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={maxServersPerSpecialSlot}
                      onChange={(e) => setMaxServersPerSpecialSlot(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold text-purple-900"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-indigo-800 mb-1">
                        Max Servers / Sunday Mass
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={maxServersPerSundaySlot}
                        onChange={(e) => setMaxServersPerSundaySlot(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-indigo-800 mb-1">
                        Max Servers / Weekday Mass
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={maxServersPerWeekdaySlot}
                        onChange={(e) => setMaxServersPerWeekdaySlot(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 rounded-lg border border-indigo-200 text-xs bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-900"
                      />
                    </div>
                  </div>
                )}

                {/* Sub-card: Rank Quota / Allotment */}
                <div className="mt-3 pt-3 border-t border-indigo-100/80">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                        Rank Allotment per Slot (Chevaliers vs Paladins)
                      </span>
                      <span className="text-[10px] text-indigo-700 font-medium block">
                        Prevents a single rank from occupying all slots in any schedule.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={enableRankQuotas}
                        onChange={(e) => setEnableRankQuotas(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {enableRankQuotas && (
                    <div className="space-y-2.5 animate-in fade-in duration-150">
                      {/* Counter & Status */}
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold p-2 rounded-xl bg-white border border-indigo-100/90 shadow-2xs">
                        <span className="text-slate-600">Total Rank Allotment:</span>
                        <span className={`px-2 py-0.5 rounded-md font-black ${
                          isRankExceeding
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : totalRankAllotment === currentSlotCapacity
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        }`}>
                          {totalRankAllotment} / {currentSlotCapacity} Servers {isRankExceeding ? '(Exceeds Max!)' : totalRankAllotment === currentSlotCapacity ? '(Balanced)' : ''}
                        </span>
                      </div>

                      {isRankExceeding && (
                        <p className="text-[10px] font-bold text-rose-600 px-1">
                          Total rank allotment ({totalRankAllotment}) cannot exceed the Max Servers per Slot ({currentSlotCapacity}). Please adjust Chevaliers or Paladins.
                        </p>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                          <label className="block text-[10px] font-extrabold uppercase text-slate-700 mb-1">
                            Max Chevaliers
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={currentSlotCapacity}
                            value={maxChevaliersPerSlot}
                            onChange={(e) => setMaxChevaliersPerSlot(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Senior Servers</span>
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                          <label className="block text-[10px] font-extrabold uppercase text-slate-700 mb-1">
                            Max Paladins
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={currentSlotCapacity}
                            value={maxPaladinsPerSlot}
                            onChange={(e) => setMaxPaladinsPerSlot(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Junior Servers</span>
                        </div>

                        {allowedRanks.includes('Squires') && (
                          <div className="p-2 bg-white rounded-xl border border-indigo-100 shadow-2xs col-span-2 sm:col-span-1">
                            <label className="block text-[10px] font-extrabold uppercase text-slate-700 mb-1">
                              Max Squires
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={currentSlotCapacity}
                              value={maxSquiresPerSlot}
                              onChange={(e) => setMaxSquiresPerSlot(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-full px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white font-bold text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Trainee / Prob</span>
                          </div>
                        )}
                      </div>

                      {/* Quick Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                        <span className="text-slate-500 font-bold">Presets:</span>
                        {currentSlotCapacity === 5 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setMaxChevaliersPerSlot(2)
                                setMaxPaladinsPerSlot(3)
                                setMaxSquiresPerSlot(0)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200 cursor-pointer transition"
                            >
                              2 Chevaliers + 3 Paladins (5)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMaxChevaliersPerSlot(3)
                                setMaxPaladinsPerSlot(2)
                                setMaxSquiresPerSlot(0)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-bold hover:bg-purple-200 cursor-pointer transition"
                            >
                              3 Chevaliers + 2 Paladins (5)
                            </button>
                            {allowedRanks.includes('Squires') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setMaxChevaliersPerSlot(2)
                                  setMaxPaladinsPerSlot(2)
                                  setMaxSquiresPerSlot(1)
                                }}
                                className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold hover:bg-emerald-200 cursor-pointer transition"
                              >
                                2 Chev + 2 Pal + 1 Squire
                              </button>
                            )}
                          </>
                        ) : currentSlotCapacity === 6 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setMaxChevaliersPerSlot(3)
                                setMaxPaladinsPerSlot(3)
                                setMaxSquiresPerSlot(0)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-bold hover:bg-purple-200 cursor-pointer transition"
                            >
                              3 Chevaliers + 3 Paladins (6)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMaxChevaliersPerSlot(2)
                                setMaxPaladinsPerSlot(4)
                                setMaxSquiresPerSlot(0)
                              }}
                              className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200 cursor-pointer transition"
                            >
                              2 Chevaliers + 4 Paladins (6)
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const half = Math.floor(currentSlotCapacity / 2)
                              setMaxChevaliersPerSlot(half)
                              setMaxPaladinsPerSlot(currentSlotCapacity - half)
                              setMaxSquiresPerSlot(0)
                            }}
                            className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 font-bold hover:bg-indigo-200 cursor-pointer transition"
                          >
                            Balanced ({Math.floor(currentSlotCapacity / 2)} Chev + {currentSlotCapacity - Math.floor(currentSlotCapacity / 2)} Pal)
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Included Schedule Types & Filter Settings */}
              <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-amber-950">3. Included Schedule Types & Filters</span>
                  <span className="text-[10px] text-amber-700 font-medium leading-tight block mt-0.5">
                    {publicationType === 'special_event'
                      ? 'Special Event mode isolates event schedules from regular masses.'
                      : 'Configure which schedule categories and days are displayed in the public link.'}
                  </span>
                </div>

                {/* Day of Week Specific Filtering */}
                <div className="p-3 bg-white rounded-xl border border-amber-200/70 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Recurring Days of the Week</span>
                      <span className="text-[10px] text-slate-500">
                        {includedDaysOfWeek.length === 0
                          ? 'All Days included (Default)'
                          : `Filtered: Only ${includedDaysOfWeek.join(', ')}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setIncludedDaysOfWeek([])}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          includedDaysOfWeek.length === 0 ? 'bg-indigo-100 text-indigo-900 font-extrabold' : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        All Days
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setIncludedDaysOfWeek(['Thursday'])}
                        className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                          includedDaysOfWeek.length === 1 && includedDaysOfWeek[0] === 'Thursday'
                            ? 'bg-purple-100 text-purple-900 font-extrabold'
                            : 'hover:bg-purple-50 text-purple-700'
                        }`}
                      >
                        Thursday Only
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setIncludedDaysOfWeek(['Sunday'])}
                        className="hover:bg-slate-100 text-slate-600 px-1 py-0.5 rounded cursor-pointer"
                      >
                        Sundays
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setIncludedDaysOfWeek(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                        className="hover:bg-slate-100 text-slate-600 px-1 py-0.5 rounded cursor-pointer"
                      >
                        Mon-Fri
                      </button>
                    </div>
                  </div>

                  {/* Day selection chips */}
                  <div className="grid grid-cols-7 gap-1 pt-1">
                    {[
                      { id: 'Sunday', label: 'Sun' },
                      { id: 'Monday', label: 'Mon' },
                      { id: 'Tuesday', label: 'Tue' },
                      { id: 'Wednesday', label: 'Wed' },
                      { id: 'Thursday', label: 'Thu' },
                      { id: 'Friday', label: 'Fri' },
                      { id: 'Saturday', label: 'Sat' },
                    ].map(day => {
                      const isSelected = includedDaysOfWeek.includes(day.id)
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDayOfWeek(day.id)}
                          className={`py-1.5 px-1 rounded-lg text-xs font-bold text-center border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {day.label}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Tip: For single-day recurring events (like Every Thursday Street Mass / Misa sa Kalye), tap <strong>Thursday Only</strong>.
                  </span>
                </div>

                {/* Street / Venue Location Toggle */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200/70 hover:bg-amber-50/40 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={enableStreetLocation}
                    onChange={(e) => setEnableStreetLocation(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">
                      Enable Street / Venue Locations (e.g. Misa sa Kalye / Sitio / Purok)
                    </span>
                    <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      Prominently highlights and displays street addresses, chapels, and venue names on schedule cards and the public schedule portal.
                    </span>
                  </div>
                </label>

                {publicationType === 'regular' && (
                  <div className="space-y-2 pt-1">
                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeSundays}
                        onChange={(e) => setIncludeSundays(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">Sunday & Anticipated Masses</span>
                        <span className="text-[10px] text-slate-500 leading-tight">
                          Saturday evening (5:00 PM onwards) and all Sunday Masses.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={includeWeekdays}
                        onChange={(e) => setIncludeWeekdays(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800">Weekday Masses</span>
                        <span className="text-[10px] text-slate-500 leading-tight">
                          Regular daily morning and afternoon Masses (Mon–Sat).
                        </span>
                      </div>
                    </label>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeHolyHour}
                      onChange={(e) => setIncludeHolyHour(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Holy Hour & Eucharistic Adoration</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Unchecked by default. Enable only if you want altar servers to select Holy Hour slots in this link.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-amber-200/60 hover:bg-amber-50/30 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={includeMeetings}
                      onChange={(e) => setIncludeMeetings(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Meetings & Formations</span>
                      <span className="text-[10px] text-slate-500 leading-tight">
                        Parish assemblies, practices, and rehearsals (Unchecked by default).
                      </span>
                    </div>
                  </label>
                </div>

                <div className="pt-2 border-t border-amber-100">
                  <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">
                    Custom Excluded Keywords (Optional)
                  </label>
                  <input
                    type="text"
                    value={customExcludedKeywords}
                    onChange={(e) => setCustomExcludedKeywords(e.target.value)}
                    placeholder="e.g. Novena, Vespers, Special Service"
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-medium text-slate-800 placeholder:text-slate-400"
                  />
                  <span className="text-[10px] text-amber-700 leading-tight block mt-1">
                    Comma-separated title keywords to exclude from this publication.
                  </span>
                </div>
              </div>

              {/* Liturgical Color Theme Presets */}
              <div className="bg-purple-50/60 p-3.5 rounded-xl border border-purple-200/80 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="block text-xs font-black text-purple-950">Liturgical Color Theme Preset</span>
                    <span className="text-[10px] text-purple-700 font-medium leading-tight block mt-0.5">
                      Select the Catholic Church liturgical color for this schedule publication. The public portal table and time badges will reflect this theme.
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-purple-100 text-purple-900 border border-purple-200 shrink-0">
                    {LITURGICAL_COLORS.find(c => c.id === (liturgicalColor || 'purple'))?.label || 'Violet'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {LITURGICAL_COLORS.map(col => {
                    const isSelected = (liturgicalColor || 'purple').toLowerCase() === col.id
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setLiturgicalColor(col.id)
                          setEventSlots(prev => prev.map(s => ({ ...s, liturgicalColor: col.id })))
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-purple-600 ring-2 ring-purple-400/40 shadow-xs'
                            : 'bg-white/80 border-slate-200/80 hover:bg-white hover:border-purple-200'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/10 flex items-center justify-center shadow-xs"
                          style={{ backgroundColor: col.hex }}
                        >
                          {isSelected && (
                            <svg className={`w-2.5 h-2.5 ${col.id === 'white' || col.id === 'rose' ? 'text-black' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-black text-slate-900 block truncate">{col.label}</span>
                          <span className="text-[9px] text-slate-500 line-clamp-1 leading-tight">{col.sub}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Section 4: Eligible Member Ranks */}
              <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/80 space-y-3">
                <div>
                  <span className="block text-xs font-black text-emerald-950">4. Eligible Member Ranks (Allowed to Schedule)</span>
                  <span className="text-[10px] text-emerald-700 font-medium leading-tight block mt-0.5">
                    Select which server ranks can view and submit schedules in this publication. Squires are unchecked by default.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  {[
                    { id: 'Chevaliers', label: 'Chevaliers', desc: 'Senior Servers' },
                    { id: 'Paladins', label: 'Paladins', desc: 'Intermediate Servers' },
                    { id: 'Squires', label: 'Squires', desc: 'Junior / Trainees' }
                  ].map(rank => {
                    const isChecked = allowedRanks.includes(rank.id)
                    return (
                      <label key={rank.id} className="flex items-start gap-2 p-2 rounded-lg bg-white border border-emerald-200/60 hover:bg-emerald-50/30 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setAllowedRanks(allowedRanks.filter(r => r !== rank.id))
                            } else {
                              setAllowedRanks([...allowedRanks, rank.id])
                            }
                          }}
                          className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">{rank.label}</span>
                          <span className="text-[10px] text-slate-500">{rank.desc}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Section 5: Attendance Policy & Suspension Rules for this Publication */}
              {publicationType === 'regular' ? (
                <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/80 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="block text-xs font-black text-rose-950">5. Attendance Suspension Rules for this Cycle</span>
                      <span className="text-[10px] text-rose-700 font-medium leading-tight block mt-0.5">
                        These thresholds will automatically apply across the system and in Member Reports during this schedule cycle.
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                      {calculateDurationMonths(startDate, endDate)} Month(s) Cycle
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-amber-900 mb-1">
                        Warning Absence Threshold
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={warningAbsenceThreshold}
                        onChange={(e) => setWarningAbsenceThreshold(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-3 py-1.5 rounded-lg border border-amber-300 text-xs bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 font-bold text-amber-950"
                      />
                      <span className="text-[10px] text-amber-700 block mt-0.5">Yellow warning in reports</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-rose-900 mb-1">
                        Suspension Absence Threshold
                      </label>
                      <input
                        type="number"
                        min="2"
                        max="50"
                        value={suspensionAbsenceThreshold}
                        onChange={(e) => setSuspensionAbsenceThreshold(parseInt(e.target.value, 10) || 2)}
                        className="w-full px-3 py-1.5 rounded-lg border border-rose-300 text-xs bg-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-bold text-rose-950"
                      />
                      <span className="text-[10px] text-rose-700 block mt-0.5">
                        {calculateDurationMonths(startDate, endDate) === 2 ? 'At least 5 absences for 2-month cycle' : 'Triggers red suspended status'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-slate-600 text-xs flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-[11px] leading-tight">
                    Special occasion publications do not affect or trigger attendance absence suspension thresholds.
                  </span>
                </div>
              )}
            </div>

            {/* Special Event & Weekly Street Mass Slots Generator */}
            {(publicationType === 'special_event' || enableStreetLocation || includedDaysOfWeek.length > 0) && (
              <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-purple-950 block">
                      Schedule Slots & Weekly Street Locations
                    </span>
                    <span className="text-[10px] text-purple-700 font-medium leading-tight block mt-0.5">
                      Configure the mass time and set individual street venues/chapels for each week or date in this schedule.
                    </span>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-purple-200 text-[10px] font-bold text-purple-900 shrink-0">
                    <input
                      type="checkbox"
                      checked={autoGenerateSpecialSlots}
                      onChange={(e) => setAutoGenerateSpecialSlots(e.target.checked)}
                      className="h-3.5 w-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span>Auto-Create Slots</span>
                  </label>
                </div>

                {autoGenerateSpecialSlots && (
                  <div className="space-y-3 pt-1">
                    {/* Default Title and Mass Time for all dates */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-white p-3 rounded-xl border border-purple-200/60">
                      <div className="sm:col-span-1">
                        <label className="block text-[10px] font-extrabold uppercase text-purple-900 mb-1">
                          Event / Mass Title
                        </label>
                        <input
                          type="text"
                          value={defaultSlotTitle}
                          onChange={(e) => {
                            setDefaultSlotTitle(e.target.value)
                            applyTitleToAll(e.target.value)
                          }}
                          placeholder="e.g. Misa sa Nayon / Kalye"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 text-xs bg-purple-50/30 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold text-purple-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-purple-900 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={defaultStartTime}
                          onChange={(e) => {
                            setDefaultStartTime(e.target.value)
                            applyTimeToAll(e.target.value, defaultEndTime)
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 text-xs bg-purple-50/30 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold text-purple-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-purple-900 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={defaultEndTime}
                          onChange={(e) => {
                            setDefaultEndTime(e.target.value)
                            applyTimeToAll(defaultStartTime, e.target.value)
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-purple-200 text-xs bg-purple-50/30 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold text-purple-950"
                        />
                      </div>
                    </div>

                    {/* Date Rows with Weekly Locations */}
                    {eventSlots.length === 0 ? (
                      <div className="p-5 bg-white rounded-xl border border-dashed border-purple-300 text-center space-y-3">
                        <div>
                          <p className="text-xs font-bold text-purple-950">No schedule date slots currently listed.</p>
                          <p className="text-[11px] text-purple-700 font-medium mt-0.5">
                            {startDate && endDate
                              ? `You can auto-populate all dates between ${startDate} and ${endDate}, or manually add custom dates.`
                              : 'Please select valid Start and End dates above.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          {startDate && endDate && (
                            <button
                              type="button"
                              onClick={handleRegenerateSlots}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-xs transition cursor-pointer"
                            >
                              Populate Dates from Range ({startDate} to {endDate})
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={addNewCustomSlot}
                            className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-extrabold transition cursor-pointer"
                          >
                            + Add Custom Date
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-900 px-1 flex-wrap gap-2">
                          <span>Weekly Dates & Locations ({eventSlots.length} Slots)</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRegenerateSlots}
                              className="text-purple-600 hover:text-purple-800 hover:underline cursor-pointer font-extrabold"
                              title="Regenerate all dates from current start and end date settings"
                            >
                              Reset / Regenerate
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={addNewCustomSlot}
                              className="text-purple-600 hover:text-purple-800 hover:underline cursor-pointer flex items-center gap-1 font-extrabold"
                            >
                              + Add Custom Date
                            </button>
                            <span>•</span>
                            <button
                              type="button"
                              onClick={handleClearAllSlots}
                              className="text-rose-500 hover:text-rose-700 hover:underline cursor-pointer font-extrabold"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                          {eventSlots.map((slot) => (
                            <div key={slot.id} className="p-2.5 bg-white rounded-xl border border-purple-200/70 shadow-2xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-black uppercase border border-purple-200 shrink-0">
                                    {slot.date}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800">
                                    {slot.dayName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-extrabold text-purple-700">
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeEventSlot(slot.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                                    title="Remove this date slot"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>

                              {/* Inputs: Street / Venue + Custom Title / Subtext under place */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-0.5">
                                    Street / Venue / Place
                                  </label>
                                  <input
                                    type="text"
                                    value={slot.location}
                                    onChange={(e) => updateSlotLocation(slot.id, e.target.value)}
                                    placeholder="e.g. Barangay 83, Mabini St."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-extrabold uppercase text-slate-500 mb-0.5">
                                    Mass Title / Subtext (Under Place)
                                  </label>
                                  <input
                                    type="text"
                                    value={slot.title}
                                    onChange={(e) => updateSlotTitle(slot.id, e.target.value)}
                                    placeholder="e.g. Street Masses, Rosary Month"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium placeholder:text-slate-400 bg-slate-50/50 focus:bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!publication && publicationType === 'regular' && (
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

        <div className="px-6 py-4 border-t border-slate-100 bg-white flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 sticky bottom-0">
          <Button
            type="button"
            variant="secondary"
            size="dense"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="pub-form"
            variant="primary"
            size="dense"
            loading={isSubmitting}
            loadingText="Saving..."
            className="w-full sm:w-auto !bg-indigo-600 hover:!bg-indigo-700 !shadow-indigo-500/20"
          >
            Save Publication
          </Button>
        </div>
      </div>
    </div>
  )
}
