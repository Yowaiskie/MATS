import React, { useState } from 'react'
import type { Member } from '@/types/member'
import { recurringService } from '@/services/recurringService'
import { getFullName } from '@/utils/member'

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
  const [csvText, setCsvText] = useState('')
  const [validationResult, setValidationResult] = useState<any | null>(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importReport, setImportReport] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualMemberMap, setManualMemberMap] = useState<Record<string, string>>({})

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        setCsvText(event.target.result as string)
        setManualMemberMap({})
      }
    }
    reader.readAsText(file)
  }

  const handleValidate = async () => {
    if (!csvText.trim()) {
      setError('Please select a CSV file or paste CSV text first.')
      return
    }

    setValidating(true)
    setError(null)
    setValidationResult(null)
    setImportReport(null)

    try {
      const result = await recurringService.validateCSV(csvText, activeMembers, manualMemberMap)
      setValidationResult(result)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to parse and validate CSV.')
    } finally {
      setValidating(false)
    }
  }

  const handleImport = async () => {
    if (!validationResult || validationResult.validRows.length === 0) return

    setImporting(true)
    setError(null)

    try {
      const { created, updated } = await recurringService.importSchedules(validationResult.validRows)
      setImportReport({
        created,
        updated,
        skipped: validationResult.invalidRows.length + validationResult.duplicates.length,
        duplicates: validationResult.duplicates.length,
        unknownMembers: validationResult.unknownMembers,
        invalidRows: validationResult.invalidRows
      })
      await onImportSuccess()
      setValidationResult(null)
      setCsvText('')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setCsvText('')
    setValidationResult(null)
    setImportReport(null)
    setError(null)
    setManualMemberMap({})
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={handleClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl z-10 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-bold text-gray-900">Bulk CSV Schedule Import</h3>
            <p className="text-xs text-gray-500 mt-0.5">Upload a CSV file to import multiple schedules at once.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

          {!validationResult && !importReport && (
            <div className="space-y-4">
              {/* File Input */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-semibold text-gray-700">Select CSV File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-200 border-dashed rounded-xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-3 text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-2 text-xs text-gray-600"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-[10px] text-gray-400">CSV formatted with Title, Date, Start Time, End Time, Assigned Members</p>
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
                  placeholder={`Title,Date,Start Time,End Time,Assigned Members\nSunday Mass,2026-07-05,06:00,07:00,Juan Cruz|Pedro Santos|Michael Camarador`}
                />
              </div>
            </div>
          )}

          {/* Validation Preview */}
          {validationResult && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-blue-600">CSV Import Dry-Run Validation Summary</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-green-100 bg-green-50 text-center">
                  <span className="block text-[10px] uppercase font-bold text-green-600">Valid Rows</span>
                  <span className="text-xl font-bold text-green-700 mt-1 block">{validationResult.validRows.length}</span>
                </div>
                <div className="p-3 rounded-xl border border-red-100 bg-red-50 text-center">
                  <span className="block text-[10px] uppercase font-bold text-red-600">Invalid Rows</span>
                  <span className="text-xl font-bold text-red-700 mt-1 block">{validationResult.invalidRows.length}</span>
                </div>
                <div className="p-3 rounded-xl border border-blue-100 bg-blue-50 text-center">
                  <span className="block text-[10px] uppercase font-bold text-blue-600">Updates</span>
                  <span className="text-xl font-bold text-blue-700 mt-1 block">
                    {validationResult.validRows.filter((r: any) => r.isUpdate).length}
                  </span>
                </div>
                <div className="p-3 rounded-xl border border-orange-100 bg-orange-50 text-center">
                  <span className="block text-[10px] uppercase font-bold text-orange-600">Unknown Members</span>
                  <span className="text-xl font-bold text-orange-700 mt-1 block">{validationResult.unknownMembers.length}</span>
                </div>
              </div>

              {/* Detailed Lists */}
              <div className="space-y-3">
                {/* Warnings / Unknown Members */}
                {validationResult.unknownMembers.length > 0 && (
                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 space-y-2">
                    <h5 className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                      ⚠ Unmatched Altar Server Names
                    </h5>
                    <p className="text-[10px] text-amber-700">Please map these names to existing active members, then click Re-validate.</p>
                    <div className="flex flex-col gap-2 mt-1.5">
                      {validationResult.unknownMembers.map((name: string) => (
                        <div key={name} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded border border-amber-100">
                          <span className="text-[10px] font-semibold text-amber-800 flex-1">
                            {name}
                          </span>
                          <select
                            className="text-xs border border-gray-200 rounded p-1 flex-1 bg-white focus:outline-none focus:border-blue-400"
                            value={manualMemberMap[name] || ''}
                            onChange={(e) => setManualMemberMap(prev => ({ ...prev, [name]: e.target.value }))}
                          >
                            <option value="">-- Exclude --</option>
                            {activeMembers.filter(m => m.status === 'active').map(m => (
                              <option key={m.id} value={m.id}>
                                {getFullName(m)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid rows list */}
                {validationResult.validRows.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-green-600">✓ Ready for Import ({validationResult.validRows.length})</h5>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                      {validationResult.validRows.map((row: any, index: number) => (
                        <div key={index} className="text-[10px] text-gray-600 flex justify-between">
                          <span>
                            {row.isUpdate && <span className="inline-block rounded bg-blue-100 text-blue-700 px-1 py-0.5 text-[8px] font-bold mr-1 uppercase">Update</span>}
                            Row {row.rowNum}: {row.title} ({row.date} {row.startTime}-{row.endTime})
                          </span>
                          <span className="text-blue-600">{row.memberNames.length - row.warnings.length} assigned</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invalid rows list */}
                {validationResult.invalidRows.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-red-600">✗ Invalid Rows ({validationResult.invalidRows.length})</h5>
                    <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50 space-y-1">
                      {validationResult.invalidRows.map((row: any, index: number) => (
                        <div key={index} className="text-[10px] text-red-600 flex flex-col sm:flex-row sm:justify-between border-b border-gray-100 pb-1 last:border-0">
                          <span>Row {row.rowNum}: {row.title || 'Format Error'}</span>
                          <span className="text-[10px] text-red-500 italic font-medium">{row.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Final Report */}
          {importReport && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl border border-green-200 bg-green-50 text-center space-y-1">
                <svg className="mx-auto h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold text-green-700 mt-2">CSV Import Complete!</h4>
                <p className="text-xs text-gray-600 mt-1">
                  Successfully imported <strong>{importReport.created}</strong> new schedules and updated <strong>{importReport.updated}</strong> existing schedules.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Final Audit Log</div>
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-700">
                    <span>Schedules Created:</span>
                    <span className="font-bold text-green-600">{importReport.created}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Schedules Updated:</span>
                    <span className="font-bold text-blue-600">{importReport.updated}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Schedules Skipped (Conflict / Errors):</span>
                    <span className="font-bold text-red-600">{importReport.skipped}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>Unknown Member Warnings:</span>
                    <span className="font-bold text-orange-600">{importReport.unknownMembers.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4 flex-wrap gap-2">
          <div>
            {!validationResult && !importReport && (
              <a 
                href="/docs/schedule_import_template.csv" 
                download
                className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
                onClick={(e) => {
                  e.preventDefault()
                  const csvContent = "Title,Date,Start Time,End Time,Assigned Members\nSunday Mass,2026-07-05,06:00,07:00,Juan Cruz|Pedro Santos|Michael Camarador"
                  const blob = new Blob([csvContent], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = 'schedule_import_template.csv'
                  link.click()
                }}
              >
                Download Sample CSV
              </a>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {!validationResult && !importReport ? (
              <>
                <button onClick={handleClose} className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer shadow-sm">
                  Cancel
                </button>
                <button
                  onClick={handleValidate}
                  disabled={validating || !csvText.trim()}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {validating ? 'Validating...' : 'Validate CSV'}
                </button>
              </>
            ) : validationResult && !importReport ? (
              <>
                <button onClick={() => {
                  setValidationResult(null)
                  setManualMemberMap({})
                }} className="rounded-lg border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors cursor-pointer shadow-sm">
                  Back
                </button>
                {validationResult.unknownMembers.length > 0 && (
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm"
                  >
                    {validating ? 'Validating...' : 'Re-validate'}
                  </button>
                )}
                <button
                  onClick={handleImport}
                  disabled={importing || validationResult.validRows.length === 0}
                  className="rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
                >
                  {importing ? 'Importing...' : `Confirm & Import (${validationResult.validRows.length})`}
                </button>
              </>
            ) : (
              <button onClick={handleClose} className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors cursor-pointer shadow-sm">
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
