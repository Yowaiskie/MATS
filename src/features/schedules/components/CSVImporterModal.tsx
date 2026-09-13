import React, { useState, useEffect } from 'react'
import type { Member } from '@/types/member'
import { recurringService } from '@/services/recurringService'
import { scheduleService } from '@/services/scheduleService'
import { getFullName } from '@/utils/member'

const formatTime12 = (timeStr: string) => {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let h = parseInt(parts[0], 10)
  const m = parts[1].padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  h = h ? h : 12
  return `${h}:${m} ${ampm}`
}

interface CSVImporterModalProps {
  isOpen: boolean
  onClose: () => void
  activeMembers: Member[]
  onImportSuccess: () => Promise<void>
}

export const CSVImporterModal: React.FC<CSVImporterModalProps> = ({
  isOpen,
  onClose,
  activeMembers,
  onImportSuccess,
}) => {
  const getCurrentMonthStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  const [targetMonth, setTargetMonth] = useState<string>(getCurrentMonthStr())
  const [csvText, setCsvText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [loadingTextIndex, setLoadingTextIndex] = useState(0)
  const [extractedSlots, setExtractedSlots] = useState<any[]>([])
  const [selectedSlotKeys, setSelectedSlotKeys] = useState<string[]>([])
  const [unknownMembers, setUnknownMembers] = useState<string[]>([])
  const [manualMemberMap, setManualMemberMap] = useState<Record<string, string>>({})
  const [importReport, setImportReport] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadingMessages = [
    "Please do not close this window...",
    "Updating schedule templates...",
    "Assigning altar servers...",
    "Syncing with the database...",
    "Checking existing schedules...",
    "Almost done...",
    "Finalizing assignments..."
  ]

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (importing) {
      interval = setInterval(() => {
        setLoadingTextIndex(prev => (prev + 1) % loadingMessages.length)
      }, 1500)
    } else {
      setLoadingTextIndex(0)
    }
    return () => clearInterval(interval)
  }, [importing])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      if (event.target?.result) {
        const text = event.target.result as string
        setCsvText(text)
        await parseCSV(text, manualMemberMap)
      }
    }
    reader.readAsText(file)
  }

  const parseCSV = async (text: string, currentManualMap: Record<string, string>) => {
    if (!text.trim()) {
      setError('Please select a CSV file or paste CSV text first.')
      return
    }

    setParsing(true)
    setError(null)
    setImportReport(null)

    try {
      const result = await recurringService.extractTemplateAssignmentsFromCSV(text, activeMembers, currentManualMap)
      setExtractedSlots(result.slots)
      setUnknownMembers(result.unknownMembers)
      setSelectedSlotKeys(result.slots.map(s => s.key))
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to parse CSV file.')
    } finally {
      setParsing(false)
    }
  }

  const handleManualMapChange = async (unknownName: string, memberId: string) => {
    const updatedMap = { ...manualMemberMap, [unknownName]: memberId }
    if (!memberId) {
      delete updatedMap[unknownName]
    }
    setManualMemberMap(updatedMap)
    if (csvText) {
      await parseCSV(csvText, updatedMap)
    }
  }

  const toggleSlotSelection = (key: string) => {
    setSelectedSlotKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleConfirmImport = async () => {
    const slotsToImport = extractedSlots.filter(s => selectedSlotKeys.includes(s.key))
    if (slotsToImport.length === 0) {
      setError('Please select at least one schedule slot to import assigned servers.')
      return
    }

    setImporting(true)
    setError(null)

    try {
      let createdCount = 0
      let updatedCount = 0
      const templates = await recurringService.getTemplates()
      const existingSchedules = await scheduleService.getSchedules()

      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      setImportProgress(0)

      for (let i = 0; i < slotsToImport.length; i++) {
        const slot = slotsToImport[i]

        // 1. Update/create Schedule Templates
        const existingTemp = templates.find(t => 
          t.title.toLowerCase().trim() === slot.title.toLowerCase().trim() &&
          t.dayOfWeek.toLowerCase().trim() === slot.dayOfWeek.toLowerCase().trim() &&
          t.startTime === slot.startTime
        )

        if (existingTemp) {
          const mergedAssigned = Array.from(new Set([...(existingTemp.assignedMembers || []), ...slot.assignedMemberIds]))
          await recurringService.updateTemplate(existingTemp.id, {
            assignedMembers: mergedAssigned
          })
          updatedCount++
        } else {
          await recurringService.addTemplate({
            name: `${slot.title} (${slot.startTime})`,
            title: slot.title,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            assignedMembers: slot.assignedMemberIds,
            active: true
          })
          createdCount++
        }

        // Direct Update to existing actual Schedule cards for the chosen Target Month (e.g. 2026-08)
        const matchingSchedules = existingSchedules.filter(s => {
          if (!s.date.startsWith(targetMonth)) return false
          if (s.startTime !== slot.startTime) return false
          if (s.title.toLowerCase().trim() !== slot.title.toLowerCase().trim()) return false
          const [y, m, d] = s.date.split('-').map(Number)
          const dateObj = new Date(y, m - 1, d)
          const dayName = weekdays[dateObj.getDay()]
          return dayName.toLowerCase() === slot.dayOfWeek.toLowerCase()
        })

        for (const targetSched of matchingSchedules) {
          const mergedAssigned = Array.from(new Set([...(targetSched.assignedMembers || []), ...slot.assignedMemberIds]))
          await scheduleService.assignMembers(targetSched.id, mergedAssigned, 'CSV Import')
          updatedCount++
        }

        setImportProgress(Math.round(((i + 1) / slotsToImport.length) * 100))
      }

      setImportReport({
        processedSlots: slotsToImport.length,
        created: createdCount,
        updated: updatedCount,
        totalServersAssigned: slotsToImport.reduce((acc, s) => acc + s.assignedMemberIds.length, 0)
      })

      await onImportSuccess()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setCsvText('')
    setExtractedSlots([])
    setSelectedSlotKeys([])
    setUnknownMembers([])
    setManualMemberMap({})
    setImportReport(null)
    setError(null)
    setImportProgress(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={(e) => { e.stopPropagation(); handleClose(); }} />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl z-10 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-extrabold text-sm shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 inline-block mb-0.5">
                Bulk Roster Sync
              </span>
              <h3 className="text-base font-black text-slate-900 tracking-tight">Import Assigned Servers via CSV</h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Extract and assign altar servers for mass time slots directly from CSV.</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClose(); }} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {!extractedSlots.length && !importReport && (
            <div className="space-y-4">
              {/* Target Month Picker */}
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                <label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Select Target Month & Year *
                </label>
                <p className="text-[11px] text-gray-500">
                  Select which month's active schedules to update with the assigned servers from your CSV file.
                </p>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={(e) => setTargetMonth(e.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:border-blue-500 shadow-xs"
                />
              </div>

              {/* File Input */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-semibold text-gray-700">Select Schedule CSV File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-3 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-2 text-xs text-gray-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-[10px] text-gray-400">Extracts assigned servers per time slot</p>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Text Area backup */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-semibold text-gray-700">Or Paste CSV Content</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="h-32 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 font-mono"
                  placeholder={`Title,Date,Start Time,End Time,Assigned Members\nSunday Mass 6AM,2026-07-05,06:00,07:00,Justin Arriola|Alex Bautista|Llew Garcia`}
                />
              </div>
            </div>
          )}

          {/* Extracted Slots Preview */}
          {extractedSlots.length > 0 && !importReport && (
            <div className="space-y-4">
              {importing ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-4">
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-gray-900">Importing server assignments...</h4>
                    <p className="text-xs text-gray-500 mt-1 transition-opacity duration-300">{loadingMessages[loadingTextIndex]}</p>
                  </div>
                  <div className="w-full max-w-sm bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div className="bg-green-500 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${importProgress}%` }}></div>
                  </div>
                  <p className="text-xs font-bold text-green-700">{importProgress}% Complete</p>
                </div>
              ) : (
                <>
                  {/* Unknown Member Resolution */}
              {unknownMembers.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
                  <h5 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    Unrecognized Altar Server Names ({unknownMembers.length})
                  </h5>
                  <p className="text-[10px] text-amber-700">Map these CSV names to active members in your roster:</p>
                  <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
                    {unknownMembers.map((name) => (
                      <div key={name} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded-xl border border-amber-200">
                        <span className="text-[10px] font-semibold text-gray-800 flex-1">
                          {name}
                        </span>
                        <div className="relative flex-1">
                          <select
                            className="w-full h-8 pl-2.5 pr-8 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 appearance-none focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs cursor-pointer transition"
                            value={manualMemberMap[name] || ''}
                            onChange={(e) => handleManualMapChange(name, e.target.value)}
                          >
                            <option value="">-- Exclude / Skip --</option>
                            {activeMembers.map(m => (
                              <option key={m.id} value={m.id}>
                                {getFullName(m)}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Slot list preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">Extracted Time Slots ({extractedSlots.length})</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSlotKeys.length === extractedSlots.length) {
                        setSelectedSlotKeys([])
                      } else {
                        setSelectedSlotKeys(extractedSlots.map(s => s.key))
                      }
                    }}
                    className="text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                  >
                    {selectedSlotKeys.length === extractedSlots.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {extractedSlots.map(slot => {
                    const isSelected = selectedSlotKeys.includes(slot.key)
                    return (
                      <div
                        key={slot.key}
                        onClick={() => toggleSlotSelection(slot.key)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-blue-300 bg-blue-50/40 shadow-2xs' 
                            : 'border-gray-200 bg-white opacity-70'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <span className="font-bold text-gray-900">{slot.title}</span>
                              <span className="text-[11px] text-gray-500 ml-2">
                                ({slot.dayOfWeek} | {formatTime12(slot.startTime)})
                              </span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-blue-100 text-blue-800">
                            {slot.assignedMemberIds.length} Servers
                          </span>
                        </div>

                        <div className="mt-2 text-[11px] text-gray-600 pl-6">
                          {slot.assignedMemberNames.length > 0 ? (
                            <span>{slot.assignedMemberNames.join(', ')}</span>
                          ) : (
                            <span className="italic text-gray-400">No members assigned</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
                </>
              )}
            </div>
          )}

          {/* Import Final Report */}
          {importReport && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-green-200 bg-green-50 text-center space-y-1">
                <svg className="mx-auto h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold text-green-700 mt-2">Server Assignments Imported!</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Successfully imported server assignments for <strong>{importReport.processedSlots}</strong> time slots.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Import Summary</div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-700">
                    <span>Slots Processed:</span>
                    <span className="font-bold text-gray-900">{importReport.processedSlots}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Templates Updated:</span>
                    <span className="font-bold text-blue-600">{importReport.updated}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>New Templates Created:</span>
                    <span className="font-bold text-green-600">{importReport.created}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Total Server Assignments:</span>
                    <span className="font-bold text-purple-600">{importReport.totalServersAssigned}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-3 border-t border-slate-100 mt-4 gap-2.5 bg-white sticky bottom-0">
          {!extractedSlots.length && !importReport ? (
            <>
              <button onClick={handleClose} className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs">
                Cancel
              </button>
              <button
                onClick={() => parseCSV(csvText, manualMemberMap)}
                disabled={parsing || !csvText.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-5 py-2.5 text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              >
                {parsing ? 'Parsing...' : 'Extract Servers'}
              </button>
            </>
          ) : extractedSlots.length > 0 && !importReport ? (
            <>
              <button onClick={() => setExtractedSlots([])} className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs">
                Back
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || selectedSlotKeys.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 px-5 py-2.5 text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95"
              >
                {importing ? 'Importing...' : `Confirm & Apply Servers (${selectedSlotKeys.length})`}
              </button>
            </>
          ) : (
            <button onClick={handleClose} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 text-xs font-black text-white transition-all cursor-pointer shadow-md shadow-indigo-500/20 active:scale-95">
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
