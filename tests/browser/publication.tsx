import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../../src/context/ToastContext'
import { AuthProvider } from '../../src/features/authentication/AuthContext'
import { PublicationsTab } from '../../src/features/schedules/components/PublicationsTab'
import { scheduleService } from '../../src/services/scheduleService'
import { recurringService } from '../../src/services/recurringService'
import { db } from './publicationFirebase'
import '../../src/index.css'

const verification = { projectId: db.app.options.projectId, reportReads: [] as number[], recurringService }
Object.assign(window, { publicationVerification: verification })
const originalReport = scheduleService.getDuplicateReport.bind(scheduleService)
scheduleService.getDuplicateReport = async (...args) => {
  const previous = args[2]?.scannedCount || 0
  const report = await originalReport(...args)
  verification.reportReads.push(report.scannedCount - previous)
  return report
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><AuthProvider><ToastProvider><main className="p-4 max-w-5xl mx-auto"><PublicationsTab /></main></ToastProvider></AuthProvider></QueryClientProvider>
)
