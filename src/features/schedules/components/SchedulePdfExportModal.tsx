import React, { useState, useEffect } from 'react'
import type { SchedulePublication } from '@/types/publication'
import type { Member } from '@/types/member'
import { scheduleService } from '@/services/scheduleService'
import { memberService } from '@/services/memberService'
import { isSundayOrAnticipatedMass, isScheduleIncludedInPublication } from '@/utils/scheduleUtils'
import { formatDocCodeWithDate } from '@/utils/pdfFooterHelper'
import { Button } from '@/components'
import {
  downloadSchedulePdfLongLandscape,
  printSchedulePdf,
  type SundayMassSlotExport,
  type WeekdayMassRowExport,
  type LiturgicalCelebrationExport,
  type ServiceScheduleExportData
} from '@/utils/schedulePdfExport'

interface Props {
  isOpen: boolean
  onClose: () => void
  publication?: SchedulePublication | null
  defaultMonth?: string // YYYY-MM
}

const CELEBRATIONS_STORAGE_KEY = 'mats_liturgical_celebrations_presets'

const computePublicationTitle = (pub: SchedulePublication): string => {
  const d1 = new Date(pub.startDate + 'T00:00:00')
  const d2 = new Date(pub.endDate + 'T00:00:00')
  const m1 = d1.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const m2 = d2.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
  const y1 = d1.getFullYear()
  const y2 = d2.getFullYear()

  if (y1 === y2) {
    if (d1.getMonth() === d2.getMonth()) {
      return `${m1} ${y1}`
    } else {
      return `${m1} - ${m2} ${y1}`
    }
  } else {
    return `${m1} ${y1} - ${m2} ${y2}`
  }
}

const DEFAULT_LITURGICAL_CELEBRATIONS: LiturgicalCelebrationExport[] = [
  {
    id: '1',
    celebration: 'HOLY HOUR',
    timeAndDate: 'Every Friday | 5:00 PM (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)',
    vestment: 'SCV (Polo for Trainees)'
  },
  {
    id: '2',
    celebration: 'BAPTISMS',
    timeAndDate: 'EVERY SUNDAY 10:00AM (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)',
    vestment: 'SCV/ACV (Polo for Trainees)'
  }
]

const getInitialCelebrations = (): LiturgicalCelebrationExport[] => {
  try {
    const saved = localStorage.getItem(CELEBRATIONS_STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to load saved celebrations presets:', e)
  }
  return DEFAULT_LITURGICAL_CELEBRATIONS
}

const computeDerivedTitle = (startMonthStr: string, mode: '1' | '2' | 'custom', customStart?: string, customEnd?: string): string => {
  if (mode === 'custom' && customStart && customEnd) {
    const d1 = new Date(customStart + 'T00:00:00')
    const d2 = new Date(customEnd + 'T00:00:00')
    const m1 = d1.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
    const m2 = d2.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    return `${m1} - ${m2}`
  }

  const [yStr, mStr] = (startMonthStr || '').split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(y) || isNaN(m)) return ''

  if (mode === '1') {
    const d = new Date(y, m - 1, 1)
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase()
  } else if (mode === '2') {
    const d1 = new Date(y, m - 1, 1)
    const d2 = new Date(y, m, 1) // next month
    const m1Name = d1.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
    const m2Name = d2.toLocaleDateString('en-US', { month: 'long' }).toUpperCase()
    const y1 = d1.getFullYear()
    const y2 = d2.getFullYear()
    if (y1 === y2) {
      return `${m1Name} - ${m2Name} ${y1}`
    } else {
      return `${m1Name} ${y1} - ${m2Name} ${y2}`
    }
  }
  return ''
}

const computeSpanLabel = (startMonthStr: string, numMonths: number): string => {
  const [yStr, mStr] = (startMonthStr || '').split('-')
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(y) || isNaN(m)) return ''
  const d1 = new Date(y, m - 1, 1)
  const d2 = new Date(y, m - 1 + (numMonths - 1), 1)
  const m1 = d1.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  const m2 = d2.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
  return `${m1} to ${m2}`
}

export const SchedulePdfExportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  publication,
  defaultMonth
}) => {
  const [loading, setLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview')
  const [nameFormat, setNameFormat] = useState<'short' | 'full'>('short')

  // Duration and Month Range State
  const now = new Date()
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const [durationMode, setDurationMode] = useState<'1' | '2' | 'custom'>('1')
  const [selectedStartMonth, setSelectedStartMonth] = useState<string>(() => {
    if (publication) return publication.startDate.slice(0, 7)
    if (defaultMonth) return defaultMonth
    return currentMonthStr
  })
  const [customStartDate, setCustomStartDate] = useState<string>(() => publication?.startDate || `${currentMonthStr}-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(() => publication?.endDate || `${currentMonthStr}-28`)

  // Export Data State
  const [monthYearTitle, setMonthYearTitle] = useState('')
  const [sundayMasses, setSundayMasses] = useState<SundayMassSlotExport[]>([])
  const [weekdayMasses, setWeekdayMasses] = useState<WeekdayMassRowExport[]>([])
  const [celebrations, setCelebrations] = useState<LiturgicalCelebrationExport[]>(getInitialCelebrations)
  const [savedPresetSuccess, setSavedPresetSuccess] = useState(false)

  const formatMemberDisplayName = (m: Member, fmt: 'short' | 'full' = 'short'): string => {
    if (fmt === 'full') {
      return `${m.firstName || ''} ${m.lastName || ''}`.trim()
    }
    const rawFirst = (m.firstName || '').trim()
    const rawLast = (m.lastName || '').trim()
    const lowerFirst = rawFirst.toLowerCase()

    let firstOnly = ''

    // Special case for compound first names (e.g. "El Thon")
    if (lowerFirst.startsWith('el thon') || m.nickname?.toLowerCase() === 'el thon') {
      firstOnly = 'El Thon'
    } else if (lowerFirst.startsWith('ma. ') || lowerFirst.startsWith('maria ')) {
      const parts = rawFirst.split(/\s+/)
      firstOnly = parts.slice(0, 2).join(' ')
    } else {
      firstOnly = rawFirst.split(/\s+/)[0] || rawFirst
    }

    let lastInitial = ''
    if (rawLast) {
      lastInitial = `${rawLast.charAt(0).toUpperCase()}.`
    } else {
      const parts = rawFirst.split(/\s+/)
      if (parts.length > 1) {
        lastInitial = `${parts[parts.length - 1].charAt(0).toUpperCase()}.`
      }
    }

    return lastInitial ? `${firstOnly} ${lastInitial}` : firstOnly
  }

  const handleSaveAsDefaultPreset = () => {
    try {
      localStorage.setItem(CELEBRATIONS_STORAGE_KEY, JSON.stringify(celebrations))
      setSavedPresetSuccess(true)
      setTimeout(() => setSavedPresetSuccess(false), 3000)
    } catch (e) {
      console.error('Failed to save celebration presets:', e)
    }
  }

  const handleResetToSystemDefault = () => {
    setCelebrations(DEFAULT_LITURGICAL_CELEBRATIONS)
    localStorage.removeItem(CELEBRATIONS_STORAGE_KEY)
    setSavedPresetSuccess(false)
  }

  const handleDurationModeChange = (mode: '1' | '2' | 'custom') => {
    setDurationMode(mode)
    const newTitle = computeDerivedTitle(selectedStartMonth, mode, customStartDate, customEndDate)
    setMonthYearTitle(newTitle)
  }

  const handleStartMonthChange = (monthStr: string) => {
    setSelectedStartMonth(monthStr)
    const newTitle = computeDerivedTitle(monthStr, durationMode, customStartDate, customEndDate)
    setMonthYearTitle(newTitle)
  }

  const loadScheduleData = async () => {
    setLoading(true)
    try {
      let startDate = ''
      let endDate = ''

      if (publication) {
        startDate = publication.startDate
        endDate = publication.endDate
        setMonthYearTitle(computePublicationTitle(publication))
      } else if (durationMode === 'custom') {
        startDate = customStartDate
        endDate = customEndDate
        if (!monthYearTitle) {
          setMonthYearTitle(computeDerivedTitle(selectedStartMonth, durationMode, customStartDate, customEndDate))
        }
      } else {
        const [yearStr, monthStr] = selectedStartMonth.split('-')
        const y = parseInt(yearStr, 10)
        const m = parseInt(monthStr, 10)
        const numMonths = durationMode === '2' ? 2 : 1
        startDate = `${y}-${String(m).padStart(2, '0')}-01`
        const endMonthDate = new Date(y, m - 1 + numMonths, 0)
        const endY = endMonthDate.getFullYear()
        const endM = String(endMonthDate.getMonth() + 1).padStart(2, '0')
        const endD = String(endMonthDate.getDate()).padStart(2, '0')
        endDate = `${endY}-${endM}-${endD}`
        if (!monthYearTitle) {
          setMonthYearTitle(computeDerivedTitle(selectedStartMonth, durationMode, customStartDate, customEndDate))
        }
      }

      const [allMembers, rawSchedules] = await Promise.all([
        memberService.getMembers(),
        scheduleService.getSchedulesByDateRange(startDate, endDate)
      ])

      const allSchedules = publication
        ? rawSchedules.filter(s => isScheduleIncludedInPublication(s, publication))
        : rawSchedules

      const memberMap = new Map(allMembers.map(m => [m.id, formatMemberDisplayName(m, nameFormat)]))

      // 1. Group Sunday Masses (Saturday 6pm + Sunday all day)
      // Standard slot templates
      const standardSundaySlots: SundayMassSlotExport[] = [
        { id: 'sat-6pm', dayName: 'Saturday', timeLabel: '6:00 PM (Youth Mass)', servers: [] },
        { id: 'sun-6am', dayName: 'Sunday', timeLabel: '6:00 AM (Tagalog)', servers: [] },
        { id: 'sun-730am', dayName: 'Sunday', timeLabel: '7:30AM (English)', servers: [] },
        { id: 'sun-9am', dayName: 'Sunday', timeLabel: '9:00AM (Tagalog)', servers: [] },
        { id: 'sun-4pm', dayName: 'Sunday', timeLabel: '4:00 PM (English)', servers: [] },
        { id: 'sun-530pm', dayName: 'Sunday', timeLabel: '5:30 PM (Tagalog)', servers: [] },
        { id: 'sun-7pm', dayName: 'Sunday', timeLabel: '7:00 PM (Tagalog)', servers: [] },
      ]

      // Map assigned servers from allSchedules to Sunday slots
      allSchedules.forEach(s => {
        if (s.status === 'cancelled') return
        const isSun = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
        if (!isSun) return

        const [y, m, d] = s.date.split('-').map(Number)
        const dayOfWeek = new Date(y, m - 1, d).getDay()
        const startTime = s.startTime

        // Find matching slot
        let targetSlot: SundayMassSlotExport | undefined
        if (dayOfWeek === 6 && startTime >= '16:00') {
          targetSlot = standardSundaySlots[0] // Sat 6pm
        } else if (dayOfWeek === 0) {
          if (startTime <= '06:30') targetSlot = standardSundaySlots[1] // 6:00 AM
          else if (startTime <= '08:00') targetSlot = standardSundaySlots[2] // 7:30 AM
          else if (startTime <= '10:30') targetSlot = standardSundaySlots[3] // 9:00 AM
          else if (startTime <= '16:30') targetSlot = standardSundaySlots[4] // 4:00 PM
          else if (startTime <= '18:00') targetSlot = standardSundaySlots[5] // 5:30 PM
          else targetSlot = standardSundaySlots[6] // 7:00 PM
        }

        if (targetSlot && s.assignedMembers) {
          s.assignedMembers.forEach(memId => {
            const name = memberMap.get(memId)
            if (name && !targetSlot!.servers.includes(name)) {
              targetSlot!.servers.push(name)
            }
          })
        }
      })

      setSundayMasses(standardSundaySlots)

      // 2. Group Weekday Masses (SSV)
      const standardWeekdayRows: WeekdayMassRowExport[] = [
        { timeLabel: '6:00 AM', monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] },
        { timeLabel: '6:00 PM', monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [] }
      ]

      allSchedules.forEach(s => {
        if (s.status === 'cancelled') return
        const isSun = isSundayOrAnticipatedMass(s.title, s.date, s.startTime)
        if (isSun) return

        const [y, m, d] = s.date.split('-').map(Number)
        const dayOfWeek = new Date(y, m - 1, d).getDay() // 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        if (dayOfWeek === 0) return

        const dayKeys: (keyof WeekdayMassRowExport)[] = ['monday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const dayKey = dayKeys[dayOfWeek]

        const targetRow = s.startTime < '12:00' ? standardWeekdayRows[0] : standardWeekdayRows[1]
        if (targetRow && s.assignedMembers) {
          s.assignedMembers.forEach(memId => {
            const name = memberMap.get(memId)
            const list = targetRow[dayKey] as string[]
            if (name && !list.includes(name)) {
              list.push(name)
            }
          })
        }
      })

      setWeekdayMasses(standardWeekdayRows)
    } catch (err) {
      console.error('Failed to load schedule export data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadScheduleData()
    }
  }, [isOpen, publication, defaultMonth, nameFormat, durationMode, selectedStartMonth, customStartDate, customEndDate])

  const handleDownloadPdf = async () => {
    setIsExporting(true)
    try {
      const exportPayload: ServiceScheduleExportData = {
        monthYearTitle,
        sundayMasses,
        weekdayMasses,
        celebrations
      }
      await downloadSchedulePdfLongLandscape(exportPayload)
    } catch (err) {
      console.error('Failed to download PDF:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = async () => {
    setIsExporting(true)
    try {
      const exportPayload: ServiceScheduleExportData = {
        monthYearTitle,
        sundayMasses,
        weekdayMasses,
        celebrations
      }
      await printSchedulePdf(exportPayload)
    } catch (err) {
      console.error('Failed to print PDF:', err)
    } finally {
      setIsExporting(false)
    }
  }

  const handleUpdateCelebration = (id: string, field: keyof LiturgicalCelebrationExport, value: string) => {
    setCelebrations(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const handleMoveCelebration = (index: number, direction: 'up' | 'down') => {
    setCelebrations(prev => {
      const next = [...prev]
      const targetIdx = direction === 'up' ? index - 1 : index + 1
      if (targetIdx < 0 || targetIdx >= next.length) return prev
      const temp = next[index]
      next[index] = next[targetIdx]
      next[targetIdx] = temp
      return next
    })
  }

  const handleRotateOrderGroups = (id: string) => {
    setCelebrations(prev => prev.map(c => {
      if (c.id !== id) return c

      // Check if text has 1st Wk, 2nd Wk, 3rd Wk, 4th Wk
      const match = c.timeAndDate.match(/1st Wk:\s*(?:Order of\s*)?([^,)]+),\s*2nd Wk:\s*(?:Order of\s*)?([^,)]+),\s*3rd Wk:\s*(?:Order of\s*)?([^,)]+),\s*4th Wk:\s*(?:Order of\s*)?([^,)]+)/i)

      if (match) {
        const w1 = match[1].trim()
        const w2 = match[2].trim()
        const w3 = match[3].trim()
        const w4 = match[4].trim()

        // Rotate by 1 week: (1st -> w2, 2nd -> w3, 3rd -> w4, 4th -> w1)
        const prefixMatch = c.timeAndDate.substring(0, match.index)
        const suffixMatch = c.timeAndDate.substring(match.index! + match[0].length)
        const newRotationStr = `1st Wk: ${w2}, 2nd Wk: ${w3}, 3rd Wk: ${w4}, 4th Wk: ${w1}`
        return {
          ...c,
          timeAndDate: `${prefixMatch}${newRotationStr}${suffixMatch}`
        }
      } else {
        // Fallback: append standard rotated format if not already in 4-week pattern
        const base = c.timeAndDate.includes('(') ? c.timeAndDate.split('(')[0].trim() : c.timeAndDate.trim()
        return {
          ...c,
          timeAndDate: `${base} (1st Wk: Order of San Juan, 2nd Wk: Order of San Tiago, 3rd Wk: Order of San Andres, 4th Wk: Order of San Pedro)`
        }
      }
    }))
  }

  const handleSetStandardOrders = (id: string) => {
    setCelebrations(prev => prev.map(c => {
      if (c.id !== id) return c
      const base = c.timeAndDate.includes('(') ? c.timeAndDate.split('(')[0].trim() : c.timeAndDate.trim()
      return {
        ...c,
        timeAndDate: `${base} (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)`
      }
    }))
  }

  const handleAppendOrderName = (id: string, orderName: string) => {
    setCelebrations(prev => prev.map(c => {
      if (c.id !== id) return c
      const clean = c.timeAndDate.trim()
      return {
        ...c,
        timeAndDate: clean ? `${clean}, ${orderName}` : orderName
      }
    }))
  }

  const handleAddPreset = (type: 'holy_hour' | 'baptisms' | 'adoration' | 'blank') => {
    if (type === 'holy_hour') {
      setCelebrations(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          celebration: 'HOLY HOUR',
          timeAndDate: 'Every Friday | 5:00 PM (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)',
          vestment: 'SCV (Polo for Trainees)'
        }
      ])
    } else if (type === 'baptisms') {
      setCelebrations(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          celebration: 'BAPTISMS',
          timeAndDate: 'EVERY SUNDAY 10:00AM (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)',
          vestment: 'SCV/ACV (Polo for Trainees)'
        }
      ])
    } else if (type === 'adoration') {
      setCelebrations(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          celebration: 'FIRST FRIDAY ADORATION',
          timeAndDate: '1st Friday of the Month | 5:00 PM',
          vestment: 'SCV (Polo for Trainees)'
        }
      ])
    } else {
      setCelebrations(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          celebration: 'NEW CELEBRATION',
          timeAndDate: 'Time & Date Details / Rotating Groups',
          vestment: 'SCV (Polo for Trainees)'
        }
      ])
    }
  }

  const handleRemoveCelebration = (id: string) => {
    setCelebrations(prev => prev.filter(c => c.id !== id))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-schedule-document, #printable-schedule-document * {
            visibility: visible;
          }
          #printable-schedule-document {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 8mm;
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: landscape;
            margin: 6mm;
          }
        }
      `}</style>
      <div className="w-full max-w-7xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Long 8.5&quot; × 13&quot; Landscape PDF
                </span>
                <span className="text-xs font-bold text-slate-400">Official Template</span>
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                Export Service Assignment Schedule
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex border border-slate-200 bg-slate-50 rounded-xl p-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Live Preview
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'edit'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Customize Details
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100/70">
          {publication && (
            <div className="max-w-6xl mx-auto mb-4 p-3.5 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 border border-purple-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  publication.status === 'archived'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-green-100 text-green-800 border border-green-200'
                }`}>
                  {publication.status === 'archived' ? 'Finalized Publication' : 'Publication Schedule'}
                </span>
                <span className="text-xs font-black text-slate-900">{publication.name}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                <span className="text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-lg">
                  {publication.startDate} to {publication.endDate}
                </span>
                <span className="text-slate-400">({monthYearTitle})</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-xs font-bold text-slate-500">Loading schedule and servers...</span>
            </div>
          ) : activeTab === 'preview' ? (
            /* TAB 1: LIVE VISUAL PREVIEW */
            <div id="printable-schedule-document" className="max-w-6xl mx-auto bg-white shadow-xl rounded-2xl border border-slate-300/80 p-6 sm:p-10 font-sans text-slate-900 select-none">
              
              {/* Header Container */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b-2 border-slate-900">
                {/* Left: Parish Info */}
                <div className="text-left shrink-0">
                  <h1 className="font-serif italic font-bold text-xl sm:text-2xl text-slate-900 leading-tight">
                    Ministry of Altar Servers
                  </h1>
                  <div className="font-sans font-bold text-xs sm:text-sm text-slate-800 tracking-tight mt-0.5">
                    SACRED HEART OF JESUS PARISH - MBS
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    Pilar Rd., Morning Breeze Subdivision, Caloocan City
                  </div>
                </div>

                {/* Center: Logos */}
                <div className="flex items-center gap-3 shrink-0">
                  <img
                    src="/parish-logo.png"
                    alt="Parish Logo"
                    className="w-16 h-16 sm:w-18 sm:h-18 object-contain"
                    onError={e => { (e.target as any).src = '/favicon/favicon.png' }}
                  />
                  <img src="/ministy_logo.jpg" alt="Ministry Logo" className="w-16 h-16 sm:w-18 sm:h-18 object-contain rounded-full" />
                </div>

                {/* Right: Title & Month */}
                <div className="text-right shrink-0">
                  <div className="font-sans font-black text-base sm:text-lg text-slate-900 underline underline-offset-2">
                    Service Assignment Schedule
                  </div>
                  <div className="font-sans font-black text-sm sm:text-base text-slate-900 tracking-wider mt-0.5">
                    {monthYearTitle || 'DECEMBER 2025'}
                  </div>
                </div>
              </div>

              {/* SECTION 1: SUNDAY MASSES (ACV) */}
              <div className="mt-6 space-y-1.5">
                <div className="text-center font-black text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                  SUNDAY MASSES (ACV)
                </div>

                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      {/* Top Day Header Row */}
                      <tr className="border-b border-black">
                        <th className="w-16 bg-[#d9e1f2] border-r border-black p-1"></th>
                        <th className="bg-[#e2f0d9] border-r border-black p-1 font-bold text-[11px] text-slate-900">
                          Saturday
                        </th>
                        <th colSpan={6} className="bg-[#e2f0d9] p-1 font-bold text-[11px] text-slate-900">
                          Sunday
                        </th>
                      </tr>

                      {/* Mass Time Sub-headers */}
                      <tr className="border-b border-black text-[10px] font-bold bg-[#e2f0d9]">
                        <th className="bg-[#d9e1f2] border-r border-black p-1"></th>
                        {sundayMasses.map(slot => (
                          <th key={slot.id} className="border-r last:border-r-0 border-black p-1 text-slate-900">
                            {slot.timeLabel}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="bg-[#d9e1f2] font-black text-xs p-2 border-r border-black align-middle text-slate-900">
                          Servers
                        </td>
                        {sundayMasses.map(slot => (
                          <td key={slot.id} className="p-2 border-r last:border-r-0 border-black align-top text-[11px] font-medium leading-relaxed bg-white">
                            {slot.servers.length > 0 ? (
                              <div className="space-y-0.5">
                                {slot.servers.map((s, idx) => (
                                  <div key={idx} className="whitespace-nowrap">{s}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: WEEKDAY MASSES (SSV) */}
              <div className="mt-6 space-y-1.5">
                <div className="text-center font-black text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                  WEEKDAY MASSES (SSV)
                </div>

                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr className="border-b border-black bg-[#e2f0d9] font-bold text-[11px] text-slate-900">
                        <th className="w-24 bg-[#d9e1f2] border-r border-black p-1 text-slate-900">
                          Time \ Day
                        </th>
                        <th className="border-r border-black p-1">Monday</th>
                        <th className="border-r border-black p-1">Tuesday</th>
                        <th className="border-r border-black p-1">Wednesday</th>
                        <th className="border-r border-black p-1">Thursday</th>
                        <th className="border-r border-black p-1">Friday</th>
                        <th className="p-1">Saturday</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {weekdayMasses.map((row, rIdx) => (
                        <tr key={rIdx}>
                          <td className="bg-[#d9e1f2] font-black text-xs p-2 border-r border-black text-slate-900 align-middle">
                            {row.timeLabel}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium bg-white align-top">
                            {row.monday.length > 0 ? (
                              <div className="space-y-1">
                                {row.monday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium bg-white align-top">
                            {row.tuesday.length > 0 ? (
                              <div className="space-y-1">
                                {row.tuesday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium bg-white align-top">
                            {row.wednesday.length > 0 ? (
                              <div className="space-y-1">
                                {row.wednesday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium bg-white align-top">
                            {row.thursday.length > 0 ? (
                              <div className="space-y-1">
                                {row.thursday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium bg-white align-top">
                            {row.friday.length > 0 ? (
                              <div className="space-y-1">
                                {row.friday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                          <td className="p-2 text-[11px] font-medium bg-white align-top">
                            {row.saturday.length > 0 ? (
                              <div className="space-y-1">
                                {row.saturday.map((name, i) => (
                                  <div key={i} className="whitespace-nowrap">{name}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">----</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3: OTHER LITURGICAL CELEBRATIONS */}
              <div className="mt-6 space-y-1.5">
                <div className="text-center font-black text-xs sm:text-sm uppercase tracking-wider text-slate-900">
                  OTHER LITURGICAL CELEBRATIONS
                </div>

                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-black bg-[#e2f0d9] font-bold text-[11px] text-slate-900 text-center">
                        <th className="w-40 border-r border-black p-1.5">Celebration</th>
                        <th className="border-r border-black p-1.5">Time and Date</th>
                        <th className="w-48 p-1.5">Vestment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {celebrations.map((c) => (
                        <tr key={c.id}>
                          <td className="bg-[#d9e1f2] font-black text-xs p-2 border-r border-black text-center text-slate-900">
                            {c.celebration}
                          </td>
                          <td className="p-2 border-r border-black text-[11px] font-medium text-center bg-white">
                            {c.timeAndDate}
                          </td>
                          <td className="p-2 text-[11px] font-medium text-center bg-white">
                            {c.vestment}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* UNIFORM FOOTER */}
              <div className="mt-8 pt-2 border-t-2 border-slate-900 flex justify-between items-center text-[10px] font-serif text-slate-800">
                <span>MAS-KoA-SHJP.mbs</span>
                <span>1</span>
                <span>{formatDocCodeWithDate('SAS')}</span>
              </div>

            </div>
          ) : (
            /* TAB 2: CUSTOMIZE DETAILS & CELEBRATIONS */
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Header Title, Duration & Format settings */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      1. Schedule Title, Duration & Display Settings
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Configure schedule duration (1 Month, 2 Months, or Custom Date Range) and customize header text.
                    </p>
                  </div>
                </div>

                {/* Duration & Month Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                      Schedule Duration
                    </label>
                    <div className="flex border border-slate-200 rounded-xl p-0.5 bg-slate-50 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => handleDurationModeChange('1')}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          durationMode === '1'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        1 Month
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDurationModeChange('2')}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          durationMode === '2'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        2 Months
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDurationModeChange('custom')}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          durationMode === 'custom'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Custom Range
                      </button>
                    </div>
                  </div>

                  {durationMode !== 'custom' ? (
                    <div>
                      <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                        {durationMode === '2' ? 'Starting Month' : 'Target Month'}
                      </label>
                      <input
                        type="month"
                        value={selectedStartMonth}
                        onChange={e => handleStartMonthChange(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                      {durationMode === '2' && (
                        <span className="text-[10px] text-indigo-600 font-bold mt-1 block">
                          Span: {computeSpanLabel(selectedStartMonth, 2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={e => {
                            setCustomStartDate(e.target.value)
                            const newTitle = computeDerivedTitle(selectedStartMonth, 'custom', e.target.value, customEndDate)
                            setMonthYearTitle(newTitle)
                          }}
                          className="w-full px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                          End Date
                        </label>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={e => {
                            setCustomEndDate(e.target.value)
                            const newTitle = computeDerivedTitle(selectedStartMonth, 'custom', customStartDate, e.target.value)
                            setMonthYearTitle(newTitle)
                          }}
                          className="w-full px-2 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                      Server Name Format
                    </label>
                    <div className="flex border border-slate-200 rounded-xl p-0.5 bg-slate-50 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setNameFormat('short')}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          nameFormat === 'short'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Short (Patrick J.)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNameFormat('full')}
                        className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                          nameFormat === 'full'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Full (Patrick Javier)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Month & Year Title Header */}
                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                    Month & Year Title (Printed on PDF Header)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={monthYearTitle}
                      onChange={e => setMonthYearTitle(e.target.value)}
                      placeholder="e.g. SEPTEMBER - OCTOBER 2026"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const autoTitle = computeDerivedTitle(selectedStartMonth, durationMode, customStartDate, customEndDate)
                        setMonthYearTitle(autoTitle)
                      }}
                      title="Auto-regenerate title from duration"
                      className="px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors shrink-0 cursor-pointer"
                    >
                      Auto Title
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic Liturgical Celebrations Editor */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <span>2. Other Liturgical Celebrations (Dynamic Rows)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        {celebrations.length} {celebrations.length === 1 ? 'Row' : 'Rows'}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Directly edit celebration names, time, vestments, or rotate 4-week Order Groups for Holy Hour and Baptisms.
                    </p>
                  </div>

                  {/* Save Presets & Reset Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {savedPresetSuccess && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg animate-in fade-in">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Default Saved!
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveAsDefaultPreset}
                      title="Save current Holy Hour, Baptisms & Celebrations as your default presets"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      <span>Save as Default Preset</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToSystemDefault}
                      title="Reset Celebrations back to factory default"
                      className="px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </div>

                {/* Preset Add Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleAddPreset('holy_hour')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                  >
                    + Holy Hour (4-Wk)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPreset('baptisms')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                  >
                    + Baptisms (4-Wk)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPreset('adoration')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                  >
                    + 1st Friday Adoration
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPreset('blank')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
                  >
                    + Custom Row
                  </button>
                </div>

                {/* Editable celebration cards list */}
                {celebrations.length === 0 ? (
                  <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                    <p className="text-xs font-bold text-slate-600">No celebrations added yet.</p>
                    <p className="text-[11px] text-slate-400 mt-1 mb-3">Click any preset above to add Holy Hour, Baptisms, or custom celebrations.</p>
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddPreset('holy_hour')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Add Default Holy Hour
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddPreset('baptisms')}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                      >
                        Add Default Baptisms
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {celebrations.map((c, idx) => (
                      <div
                        key={c.id}
                        className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 transition-all shadow-2xs space-y-3"
                      >
                        {/* Card Header with Row Number, Reorder, & Remove */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 font-black text-xs flex items-center justify-center">
                              #{idx + 1}
                            </span>
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                              {c.celebration || 'UNTITLED CELEBRATION'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Move Up */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveCelebration(idx, 'up')}
                              title="Move Up"
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200/60 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m18 15-6-6-6 6"/>
                              </svg>
                            </button>
                            {/* Move Down */}
                            <button
                              type="button"
                              disabled={idx === celebrations.length - 1}
                              onClick={() => handleMoveCelebration(idx, 'down')}
                              title="Move Down"
                              className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 rounded hover:bg-slate-200/60 cursor-pointer"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m6 9 6 6 6-6"/>
                              </svg>
                            </button>
                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemoveCelebration(c.id)}
                              title="Delete Row"
                              className="ml-2 px-2 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Card Form Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Celebration Name Field */}
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                              Celebration Name
                            </label>
                            <input
                              type="text"
                              value={c.celebration}
                              onChange={e => handleUpdateCelebration(c.id, 'celebration', e.target.value.toUpperCase())}
                              placeholder="e.g. HOLY HOUR"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            {/* Quick suggestions */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {['HOLY HOUR', 'BAPTISMS', 'ADORATION', 'HEALING MASS', 'CONFESSION'].map(tag => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => handleUpdateCelebration(c.id, 'celebration', tag)}
                                  className="text-[9px] font-semibold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-200"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Vestment Field */}
                          <div>
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">
                              Vestment
                            </label>
                            <input
                              type="text"
                              value={c.vestment}
                              onChange={e => handleUpdateCelebration(c.id, 'vestment', e.target.value)}
                              placeholder="e.g. SCV (Polo for Trainees)"
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                            {/* Quick suggestions */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {['SCV (Polo for Trainees)', 'ACV (Type B for Trainees)', 'SCV/ACV', 'Type A'].map(vest => (
                                <button
                                  key={vest}
                                  type="button"
                                  onClick={() => handleUpdateCelebration(c.id, 'vestment', vest)}
                                  className="text-[9px] font-semibold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-200"
                                >
                                  {vest}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Time & Date / Rotating Groups Field */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-[10px] font-extrabold uppercase text-slate-500">
                              Time & Date / Rotating Order Groups
                            </label>
                            {/* Rotation Tools */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRotateOrderGroups(c.id)}
                                title="Rotate the 4 Order Groups by 1 week (Week 1 -> Week 2 -> Week 3 -> Week 4)"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                  <path d="M3 3v5h5"/>
                                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                                  <path d="M16 16h5v5"/>
                                </svg>
                                <span>Rotate Orders (Shift Weeks)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetStandardOrders(c.id)}
                                title="Reset rotation to 1st: San Pedro, 2nd: San Juan, 3rd: San Tiago, 4th: San Andres"
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                              >
                                <span>Standard 1-4</span>
                              </button>
                            </div>
                          </div>

                          <textarea
                            rows={2}
                            value={c.timeAndDate}
                            onChange={e => handleUpdateCelebration(c.id, 'timeAndDate', e.target.value)}
                            placeholder="e.g. Every Friday | 5:00 PM (1st Wk: Order of San Pedro, 2nd Wk: Order of San Juan, 3rd Wk: Order of San Tiago, 4th Wk: Order of San Andres)"
                            className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                          />

                          {/* Quick order inserter chips */}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400">Insert Order:</span>
                            {['Order of San Pedro', 'Order of San Juan', 'Order of San Tiago', 'Order of San Andres'].map(order => (
                              <button
                                key={order}
                                type="button"
                                onClick={() => handleAppendOrderName(c.id, order)}
                                className="text-[10px] font-bold text-slate-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 px-2 py-0.5 rounded-md border border-slate-200 transition-colors"
                              >
                                + {order.replace('Order of ', '')}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            Formatted for Long Bond Paper (8.5&quot; × 13&quot; Landscape).
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="dense"
              onClick={handlePrint}
              disabled={isExporting || loading}
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect width="12" height="8" x="6" y="14" />
                </svg>
              }
            >
              Print
            </Button>

            <Button
              type="button"
              variant="primary"
              size="dense"
              onClick={handleDownloadPdf}
              disabled={isExporting || loading}
              loading={isExporting}
              loadingText="Generating PDF..."
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
              }
              className="!bg-indigo-600 hover:!bg-indigo-700 !shadow-indigo-500/20"
            >
              Download PDF (Long 8.5×13 Landscape)
            </Button>
          </div>
        </div>

      </div>
    </div>
  )
}
