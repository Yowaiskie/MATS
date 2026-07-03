import React, { useState } from 'react'
import type { Member } from '@/types/member'
import { recurringService } from '@/services/recurringService'

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

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      if (event.target?.result) {
        setCsvText(event.target.result as string)
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
      const result = await recurringService.validateCSV(csvText, activeMembers)
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
      const importedCount = await recurringService.importSchedules(validationResult.validRows)
      setImportReport({
        created: importedCount,
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
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 transition-opacity" onClick={handleClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl rounded-lg border border-gray-800 bg-gray-950 p-6 shadow-xl z-10 text-white flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-900">
          <div>
            <h3 className="text-base font-bold text-white">Bulk CSV Schedule Import</h3>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file to import multiple schedules at once.</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors cursor-pointer">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded border border-red-900 bg-red-950/40 p-4 text-xs text-red-400">
              {error}
            </div>
          )}

          {!validationResult && !importReport && (
            <div className="space-y-4">
              {/* File Input */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-gray-300">Select CSV File</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-800 border-dashed rounded-lg cursor-pointer bg-gray-950/50 hover:bg-gray-900/50 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-3 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-2 text-xs text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-[10px] text-gray-500">CSV formatted with Title, Date, Start Time, End Time, Assigned Members</p>
                    </div>
                    <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {/* Text Area backup */}
              <div className="flex flex-col space-y-2">
                <label className="text-xs font-bold text-gray-300">Or Paste CSV Content</label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="h-32 block w-full rounded border border-gray-850 bg-gray-950 px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="Title,Date,Start Time,End Time,Assigned Members&#10;Sunday Mass,2026-07-05,06:00,07:00,Juan Cruz|Pedro Santos|Michael Camarador"
                />
              </div>
            </div>
          )}

          {/* Validation Preview */}
          {validationResult && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-indigo-400">CSV Import Dry-Run Validation Summary</h4>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 rounded border border-gray-850 bg-gray-900/30 text-center">
                  <span className="block text-[10px] uppercase font-bold text-green-400">Valid Rows</span>
                  <span className="text-lg font-bold text-white mt-1 block">{validationResult.validRows.length}</span>
                </div>
                <div className="p-3 rounded border border-gray-850 bg-gray-900/30 text-center">
                  <span className="block text-[10px] uppercase font-bold text-red-400">Invalid Rows</span>
                  <span className="text-lg font-bold text-white mt-1 block">{validationResult.invalidRows.length}</span>
                </div>
                <div className="p-3 rounded border border-gray-850 bg-gray-900/30 text-center">
                  <span className="block text-[10px] uppercase font-bold text-yellow-500">Duplicates</span>
                  <span className="text-lg font-bold text-white mt-1 block">{validationResult.duplicates.length}</span>
                </div>
                <div className="p-3 rounded border border-gray-850 bg-gray-900/30 text-center">
                  <span className="block text-[10px] uppercase font-bold text-amber-500">Unknown Members</span>
                  <span className="text-lg font-bold text-white mt-1 block">{validationResult.unknownMembers.length}</span>
                </div>
              </div>

              {/* Detailed Lists */}
              <div className="space-y-3">
                {/* Warnings / Unknown Members */}
                {validationResult.unknownMembers.length > 0 && (
                  <div className="p-3 rounded border border-amber-950 bg-amber-950/10 space-y-1">
                    <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      ⚠️ Unmatched Altar Server Names (Excluded from Assignments)
                    </h5>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {validationResult.unknownMembers.map((name: string) => (
                        <span key={name} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-900/20 border border-amber-900/40 text-amber-300">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid rows list */}
                {validationResult.validRows.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-green-400">✓ Ready for Import ({validationResult.validRows.length})</h5>
                    <div className="max-h-32 overflow-y-auto border border-gray-900 rounded p-2 bg-gray-950/50 space-y-1">
                      {validationResult.validRows.map((row: any, index: number) => (
                        <div key={index} className="text-[10px] text-gray-300 flex justify-between">
                          <span>Row {row.rowNum}: {row.title} ({row.date} {row.startTime}-{row.endTime})</span>
                          <span className="text-indigo-400">{row.memberNames.length - row.warnings.length} assigned</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invalid rows list */}
                {validationResult.invalidRows.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold text-red-400">✗ Invalid Rows ({validationResult.invalidRows.length})</h5>
                    <div className="max-h-32 overflow-y-auto border border-gray-900 rounded p-2 bg-gray-950/50 space-y-1">
                      {validationResult.invalidRows.map((row: any, index: number) => (
                        <div key={index} className="text-[10px] text-red-400/90 flex flex-col sm:flex-row sm:justify-between border-b border-gray-900/50 pb-1 last:border-0">
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
              <div className="p-4 rounded border border-green-950 bg-green-950/15 text-center space-y-1">
                <svg className="mx-auto h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h4 className="text-sm font-bold text-green-400 mt-2">CSV Import Complete!</h4>
                <p className="text-xs text-gray-300 mt-1">
                  Successfully imported **{importReport.created}** schedules into the database.
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Final Audit log</div>
                <div className="border border-gray-900 rounded p-3 bg-gray-950/50 space-y-1 text-xs">
                  <div className="flex justify-between text-gray-300">
                    <span>Schedules Created:</span>
                    <span className="font-bold text-green-400">{importReport.created}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Schedules Skipped (Conflict / Errors):</span>
                    <span className="font-bold text-red-400">{importReport.skipped}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Duplicate Schedules Detected:</span>
                    <span className="font-bold text-yellow-500">{importReport.duplicates}</span>
                  </div>
                  <div className="flex justify-between text-gray-300">
                    <span>Unknown Member Warnings:</span>
                    <span className="font-bold text-amber-500">{importReport.unknownMembers.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-900 mt-4 flex-wrap gap-2">
          <div>
            {!validationResult && !importReport && (
              <a 
                href="/docs/schedule_import_template.csv" 
                download
                className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold"
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
                <button onClick={handleClose} className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer">
                  Cancel
                </button>
                <button
                  onClick={handleValidate}
                  disabled={validating || !csvText.trim()}
                  className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  {validating ? 'Validating...' : 'Validate CSV'}
                </button>
              </>
            ) : validationResult && !importReport ? (
              <>
                <button onClick={() => setValidationResult(null)} className="rounded border border-gray-800 bg-gray-900 hover:bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer">
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || validationResult.validRows.length === 0}
                  className="rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 px-4.5 py-2 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  {importing ? 'Importing...' : `Confirm & Import (${validationResult.validRows.length})`}
                </button>
              </>
            ) : (
              <button onClick={handleClose} className="rounded bg-indigo-600 hover:bg-indigo-500 px-4.5 py-2 text-xs font-semibold text-white transition-colors cursor-pointer">
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
