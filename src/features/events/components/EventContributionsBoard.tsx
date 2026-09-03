import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/Card'
import { Loading } from '@/components/Loading'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventContributionService } from '@/services/eventContributionService'
import { eventFinanceService } from '@/services/eventFinanceService'
import { categoryService } from '@/services/finance/categoryService'
import { eventService } from '@/services/eventService'
import type { EventContribution, EventContributionPurpose, ContributionLinkDestination } from '@/types/eventContribution'
import { getContributionLinkSummary } from '@/types/eventContribution'
import type { EventFinanceCategory } from '@/types/eventFinance'
import type { FinanceCategory } from '@/types/finance'
import type { Event } from '@/types/event'
import { EventContributionModal } from './EventContributionModal'
import { ContributionPurposeModal } from './ContributionPurposeModal'
import { ConfirmModal, AlertModal } from '@/components/Dialog'
import { Modal } from '@/components/Modal'
import { EventContributionExportModal } from './EventContributionExportModal'

interface Props {
  eventId: string
  eventName: string
  isHeadOrCreator: boolean
}

export const EventContributionsBoard: React.FC<Props> = ({ eventId, eventName, isHeadOrCreator }) => {
  const { profile, canAction } = useAuth()
  const [contributions, setContributions] = useState<EventContribution[]>([])
  const [purposes, setPurposes] = useState<EventContributionPurpose[]>([])
  const [financeCategories, setFinanceCategories] = useState<EventFinanceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Dialog / Modal states
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false)
  const [editingContribution, setEditingContribution] = useState<EventContribution | null>(null)
  const [isPurposeModalOpen, setIsPurposeModalOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [alertTitle, setAlertTitle] = useState('Contribution Tracker')

  // Single & Bulk Link to Finance states
  const [linkTarget, setLinkTarget] = useState<EventContribution | null>(null)
  const [linkDestination, setLinkDestination] = useState<ContributionLinkDestination>('current_event')
  const [targetEventId, setTargetEventId] = useState('')
  const [otherEvents, setOtherEvents] = useState<Event[]>([])
  const [mainFinanceCategories, setMainFinanceCategories] = useState<FinanceCategory[]>([])
  const [targetEventCategories, setTargetEventCategories] = useState<EventFinanceCategory[]>([])
  const [loadingDestCategories, setLoadingDestCategories] = useState(false)
  const [selectedFinanceCategory, setSelectedFinanceCategory] = useState('')
  const [financeLinkDate, setFinanceLinkDate] = useState(new Date().toISOString().split('T')[0])
  const [customLinkAmount, setCustomLinkAmount] = useState<number | ''>('')
  const [showLinkModal, setShowLinkModal] = useState(false)

  // Manage multi-allocations modal state
  const [manageAllocTarget, setManageAllocTarget] = useState<EventContribution | null>(null)
  const [showManageAllocModal, setShowManageAllocModal] = useState(false)
  const [unlinkAllocTarget, setUnlinkAllocTarget] = useState<{ contributionId: string; allocationId?: string; amount: number; label: string } | null>(null)
  const [showUnlinkAllocConfirm, setShowUnlinkAllocConfirm] = useState(false)

  // Bulk Selection & Bulk Link states
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showBulkLinkModal, setShowBulkLinkModal] = useState(false)

  // Archive confirmation state
  const [showArchived, setShowArchived] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<EventContribution | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  // Void confirmation state
  const [voidTarget, setVoidTarget] = useState<EventContribution | null>(null)
  const [showVoidConfirm, setShowVoidConfirm] = useState(false)
  const [showExportPdfModal, setShowExportPdfModal] = useState(false)

  // Unlink confirmation state
  const [unlinkTarget, setUnlinkTarget] = useState<EventContribution | null>(null)
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<EventContribution | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Filtering states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPurposeId, setSelectedPurposeId] = useState('all')
  const [selectedHeldBy, setSelectedHeldBy] = useState('all')
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('recorded') // default active
  const [selectedLinkStatus, setSelectedLinkStatus] = useState('all') // all | linked | unlinked
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const canAdd = canAction('canAddEventContributions') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'
  const canEdit = canAction('canEditEventContributions') || canAction('canAddEventContributions') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator' || canAction('canManageEvents')
  const canVoid = canAction('canVoidEventContributions') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'
  const canManagePurposes = canAction('canManageEventContributionPurposes') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'
  const canExport = canAction('canExportEventContributions') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'
  const canLinkFinance = canAction('canAddEventIncome') || canAction('canAddIncome') || canAction('canAddEventContributions') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'
  const canDelete = isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator' || canAction('canManageEvents') || canAction('canAddEventContributions') || canAction('canVoidEventContributions')

  useEffect(() => {
    fetchData()
  }, [eventId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [contribData, purposeData, financeCats] = await Promise.all([
        eventContributionService.getContributionsByEventId(eventId),
        eventContributionService.getPurposesByEventId(eventId),
        eventFinanceService.getEventFinanceCategories(eventId, 'income')
      ])
      setContributions(contribData)
      setPurposes(purposeData)
      setFinanceCategories(financeCats.filter(c => !c.isArchived))
      setSelectedIds([]) // Reset selections on refresh
    } catch (err) {
      console.error('Failed to load contributions board data:', err)
      setAlertTitle('Load Failed')
      setAlertMessage('Could not retrieve contribution tracking logs.')
    } finally {
      setLoading(false)
    }
  }

  // Active records metrics
  const activeContributions = useMemo(() => {
    return contributions.filter(c => c.status === 'recorded' && !c.isArchived)
  }, [contributions])

  const metrics = useMemo(() => {
    const totalCollected = activeContributions.reduce((acc, c) => acc + c.amount, 0)
    const contributorCount = new Set(activeContributions.map(c => c.contributorName)).size
    const cashTotal = activeContributions.filter(c => c.paymentMethod === 'cash').reduce((acc, c) => acc + c.amount, 0)
    const gcashTotal = activeContributions.filter(c => c.paymentMethod === 'gcash').reduce((acc, c) => acc + c.amount, 0)
    const transferTotal = activeContributions.filter(c => c.paymentMethod === 'bank_transfer').reduce((acc, c) => acc + c.amount, 0)
    const otherTotal = activeContributions.filter(c => c.paymentMethod === 'other').reduce((acc, c) => acc + c.amount, 0)

    // Purpose summary breakdown
    const purposeTotals: Record<string, number> = {}
    activeContributions.forEach(c => {
      purposeTotals[c.purposeName] = (purposeTotals[c.purposeName] || 0) + c.amount
    })

    return {
      totalCollected,
      contributorCount,
      cashTotal,
      gcashTotal,
      transferTotal,
      otherTotal,
      purposeTotals
    }
  }, [activeContributions])

  // Unique custodians / collectors for filtering
  const uniqueCustodians = useMemo(() => {
    const set = new Set<string>()
    contributions.forEach(c => {
      if (!c.isArchived && c.collectedByName?.trim()) {
        set.add(c.collectedByName.trim())
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [contributions])

  // Filtered List
  const filteredContributions = useMemo(() => {
    return contributions.filter(c => {
      // 0. Archived Filter
      if (showArchived ? false : c.isArchived) return false

      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = c.contributorName.toLowerCase().includes(query)
        const matchCareOf = c.collectedByName?.toLowerCase().includes(query) || false
        const matchRef = c.referenceNumber?.toLowerCase().includes(query) || false
        if (!matchName && !matchCareOf && !matchRef) return false
      }

      // 2. Purpose Filter
      if (selectedPurposeId !== 'all' && c.purposeId !== selectedPurposeId) {
        return false
      }

      // 3. Held By Filter
      if (selectedHeldBy !== 'all') {
        if (selectedHeldBy === 'unassigned') {
          if (c.collectedByName?.trim()) return false
        } else {
          if ((c.collectedByName || '').trim().toLowerCase() !== selectedHeldBy.trim().toLowerCase()) {
            return false
          }
        }
      }

      // 4. Payment Method Filter
      if (selectedPaymentMethod !== 'all' && c.paymentMethod !== selectedPaymentMethod) {
        return false
      }

      // 5. Status Filter
      if (selectedStatus !== 'all' && c.status !== selectedStatus) {
        return false
      }

      // 6. Finance Link Filter
      const summary = getContributionLinkSummary(c)
      if (selectedLinkStatus === 'linked' && summary.status === 'unlinked') return false
      if (selectedLinkStatus === 'unlinked' && summary.status !== 'unlinked') return false

      // 7. Date Range Filter
      const contribDate = c.contributedAt?.toDate ? c.contributedAt.toDate() : new Date(c.contributedAt as any)
      const dateStr = contribDate.toISOString().split('T')[0]
      if (startDate && dateStr < startDate) return false
      if (endDate && dateStr > endDate) return false

      return true
    })
  }, [contributions, showArchived, searchQuery, selectedPurposeId, selectedHeldBy, selectedPaymentMethod, selectedStatus, selectedLinkStatus, startDate, endDate])

  // Eligible unlinked items for bulk actions
  const eligibleUnlinkedItems = useMemo(() => {
    return filteredContributions.filter(c => {
      const summary = getContributionLinkSummary(c)
      return c.status === 'recorded' && summary.remainingToLink > 0
    })
  }, [filteredContributions])

  const selectedSum = useMemo(() => {
    return contributions
      .filter(c => selectedIds.includes(c.id))
      .reduce((sum, c) => {
        const summary = getContributionLinkSummary(c)
        return sum + summary.remainingToLink
      }, 0)
  }, [contributions, selectedIds])

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(eligibleUnlinkedItems.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleVoidConfirm = async () => {
    if (!voidTarget || !profile) return
    setShowVoidConfirm(false)
    setSubmitting(true)
    try {
      await eventContributionService.voidContribution(voidTarget.id, eventId, profile.displayName || profile.email)
      setAlertTitle('Record Voided')
      setAlertMessage('The contribution has been voided and removed from active metrics.')
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Void Action Failed')
      setAlertMessage(err.message || 'Could not void contribution record.')
    } finally {
      setSubmitting(false)
      setVoidTarget(null)
    }
  }

  const handleArchiveConfirm = async () => {
    if (!archiveTarget || !profile) return
    setShowArchiveConfirm(false)
    setSubmitting(true)
    try {
      await eventContributionService.archiveContribution(archiveTarget.id, eventId, profile.displayName || profile.email)
      setAlertTitle('Record Archived')
      setAlertMessage('The contribution record has been archived.')
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Archive Failed')
      setAlertMessage(err.message || 'Could not archive contribution record.')
    } finally {
      setSubmitting(false)
      setArchiveTarget(null)
    }
  }

  const handleRestoreContribution = async (c: EventContribution) => {
    if (!profile) return
    setSubmitting(true)
    try {
      await eventContributionService.restoreContribution(c.id, eventId, profile.displayName || profile.email)
      setAlertTitle('Record Restored')
      setAlertMessage('The contribution record has been restored.')
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Restore Failed')
      setAlertMessage(err.message || 'Could not restore contribution record.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnlinkConfirm = async () => {
    if (!unlinkTarget || !profile) return
    setShowUnlinkConfirm(false)
    setSubmitting(true)
    try {
      await eventContributionService.unlinkFromFinance(
        unlinkTarget.id,
        profile.displayName || profile.email
      )
      setAlertTitle('Unlink Successful')
      setAlertMessage('All finance links for this contribution have been removed.')
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Unlink Failed')
      setAlertMessage(err.message || 'Could not unlink contribution record.')
    } finally {
      setSubmitting(false)
      setUnlinkTarget(null)
    }
  }

  const handleUnlinkAllocConfirm = async () => {
    if (!unlinkAllocTarget || !profile) return
    setShowUnlinkAllocConfirm(false)
    setSubmitting(true)
    try {
      await eventContributionService.unlinkFromFinance(
        unlinkAllocTarget.contributionId,
        profile.displayName || profile.email,
        unlinkAllocTarget.allocationId
      )
      setAlertTitle('Portion Unlinked')
      setAlertMessage(`Successfully unlinked ₱${unlinkAllocTarget.amount.toLocaleString()} from ${unlinkAllocTarget.label}.`)
      await fetchData()
      // If modal was open, refresh target
      if (manageAllocTarget && manageAllocTarget.id === unlinkAllocTarget.contributionId) {
        const updatedContrib = (await eventContributionService.getContributionsByEventId(eventId)).find(c => c.id === manageAllocTarget.id)
        if (updatedContrib) {
          const updatedSummary = getContributionLinkSummary(updatedContrib)
          if (updatedSummary.allocations.length > 0) {
            setManageAllocTarget(updatedContrib)
          } else {
            setShowManageAllocModal(false)
            setManageAllocTarget(null)
          }
        }
      }
    } catch (err: any) {
      setAlertTitle('Unlink Failed')
      setAlertMessage(err.message || 'Could not unlink this finance portion.')
    } finally {
      setSubmitting(false)
      setUnlinkAllocTarget(null)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || !profile) return
    setShowDeleteConfirm(false)
    setSubmitting(true)
    try {
      await eventContributionService.deleteContribution(
        deleteTarget.id,
        eventId,
        profile.displayName || profile.email
      )
      setAlertTitle('Record Deleted')
      setAlertMessage('The contribution record has been permanently deleted.')
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Delete Failed')
      setAlertMessage(err.message || 'Could not delete contribution record.')
    } finally {
      setSubmitting(false)
      setDeleteTarget(null)
    }
  }

  const canLinkMainFunds = canAction('canAddIncome') || canAction('canManageEvents') || isHeadOrCreator || profile?.role === 'admin' || profile?.role === 'coordinator'

  const handleDestinationChange = async (dest: ContributionLinkDestination) => {
    setLinkDestination(dest)
    setSelectedFinanceCategory('')

    if (dest === 'main_funds') {
      if (mainFinanceCategories.length === 0) {
        try {
          setLoadingDestCategories(true)
          const cats = await categoryService.getCategories(false)
          setMainFinanceCategories(cats)
        } catch (err) {
          console.error('Failed to load main finance categories:', err)
        } finally {
          setLoadingDestCategories(false)
        }
      }
    } else if (dest === 'other_event') {
      if (otherEvents.length === 0) {
        try {
          setLoadingDestCategories(true)
          const evts = await eventService.getEvents(false)
          setOtherEvents(evts.filter(e => e.id !== eventId))
        } catch (err) {
          console.error('Failed to load events list:', err)
        } finally {
          setLoadingDestCategories(false)
        }
      }
    }
  }

  const handleTargetEventChange = async (targetId: string) => {
    setTargetEventId(targetId)
    setSelectedFinanceCategory('')
    if (!targetId) {
      setTargetEventCategories([])
      return
    }
    try {
      setLoadingDestCategories(true)
      const cats = await eventFinanceService.getEventFinanceCategories(targetId, 'income')
      setTargetEventCategories(cats.filter(c => !c.isArchived))
    } catch (err) {
      console.error('Failed to load target event categories:', err)
    } finally {
      setLoadingDestCategories(false)
    }
  }

  const activeCategoriesList = useMemo(() => {
    if (linkDestination === 'main_funds') return mainFinanceCategories
    if (linkDestination === 'other_event') return targetEventCategories
    return financeCategories
  }, [linkDestination, mainFinanceCategories, targetEventCategories, financeCategories])

  const handleLinkFinanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkTarget || !profile || !selectedFinanceCategory) return
    if (linkDestination === 'other_event' && !targetEventId) {
      setAlertTitle('Selection Required')
      setAlertMessage('Please select a target event.')
      return
    }

    const summary = getContributionLinkSummary(linkTarget)
    const linkAmt = customLinkAmount !== '' ? Number(customLinkAmount) : summary.remainingToLink

    if (isNaN(linkAmt) || linkAmt <= 0) {
      setAlertTitle('Invalid Amount')
      setAlertMessage('Please enter a valid amount greater than ₱0.00.')
      return
    }
    if (linkAmt > summary.remainingToLink) {
      setAlertTitle('Amount Exceeded')
      setAlertMessage(`Hindi pwedeng sumobra sa remaining unlinked amount na ₱${summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`)
      return
    }

    const targetEventObj = otherEvents.find(ev => ev.id === targetEventId)

    setShowLinkModal(false)
    setSubmitting(true)
    try {
      await eventContributionService.linkToFinance(
        linkTarget.id,
        selectedFinanceCategory,
        financeLinkDate,
        profile.uid,
        profile.displayName || profile.email,
        {
          destination: linkDestination,
          targetEventId: linkDestination === 'other_event' ? targetEventId : undefined,
          targetEventName: linkDestination === 'other_event' ? targetEventObj?.title : undefined,
          currentEventName: eventName,
          linkAmount: linkAmt
        }
      )
      const destLabel = linkDestination === 'main_funds' 
        ? 'Main Church Funds' 
        : linkDestination === 'other_event' 
          ? `Event: ${targetEventObj?.title || 'Selected Event'}` 
          : 'Event Finance'
      setAlertTitle('Link Successful')
      const remaining = summary.remainingToLink - linkAmt
      setAlertMessage(
        remaining > 0 
          ? `₱${linkAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} has been recorded into ${destLabel}. Meron pang natitirang ₱${remaining.toLocaleString('en-US', { minimumFractionDigits: 2 })} na available para i-link.`
          : `Buong ₱${linkAmt.toLocaleString('en-US', { minimumFractionDigits: 2 })} ay matagumpay na naitala sa ${destLabel}.`
      )
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Linking Failed')
      setAlertMessage(err.message || 'Failed to link record to Finance.')
    } finally {
      setSubmitting(false)
      setLinkTarget(null)
      setSelectedFinanceCategory('')
      setTargetEventId('')
      setLinkDestination('current_event')
      setCustomLinkAmount('')
    }
  }

  const handleBulkLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedIds.length === 0 || !profile || !selectedFinanceCategory) return
    if (linkDestination === 'other_event' && !targetEventId) {
      setAlertTitle('Selection Required')
      setAlertMessage('Please select a target event.')
      return
    }

    const targetEventObj = otherEvents.find(ev => ev.id === targetEventId)

    setShowBulkLinkModal(false)
    setSubmitting(true)
    try {
      const count = await eventContributionService.bulkLinkToFinance(
        selectedIds,
        selectedFinanceCategory,
        financeLinkDate,
        profile.uid,
        profile.displayName || profile.email,
        {
          destination: linkDestination,
          targetEventId: linkDestination === 'other_event' ? targetEventId : undefined,
          targetEventName: linkDestination === 'other_event' ? targetEventObj?.title : undefined,
          currentEventName: eventName
        }
      )
      const destLabel = linkDestination === 'main_funds' 
        ? 'Main Church Funds' 
        : linkDestination === 'other_event' 
          ? `Event: ${targetEventObj?.title || 'Selected Event'}` 
          : 'Event Finance'
      setAlertTitle('Bulk Link Successful')
      setAlertMessage(`Successfully recorded ${count} contributions into ${destLabel}.`)
      await fetchData()
    } catch (err: any) {
      setAlertTitle('Bulk Link Failed')
      setAlertMessage(err.message || 'Failed to complete bulk linking.')
    } finally {
      setSubmitting(false)
      setSelectedFinanceCategory('')
      setTargetEventId('')
      setLinkDestination('current_event')
    }
  }

  const handleExportPdf = () => {
    if (!canExport) return
    setShowExportPdfModal(true)
  }

  const handleExportCsv = () => {
    if (!canExport) return
    const headers = [
      'Contributor',
      'Held By',
      'Purpose',
      'Amount',
      'Payment Method',
      'Reference Number',
      'Contribution Date',
      'Recorded By',
      'Status',
      'Finance Link ID'
    ]

    const rows = filteredContributions.map(c => {
      const dateObj = c.contributedAt?.toDate ? c.contributedAt.toDate() : new Date(c.contributedAt as any)
      return [
        `"${c.contributorName.replace(/"/g, '""')}"`,
        `"${(c.collectedByName || 'N/A').replace(/"/g, '""')}"`,
        `"${c.purposeName.replace(/"/g, '""')}"`,
        c.amount,
        c.paymentMethod.toUpperCase(),
        c.referenceNumber ? `"${c.referenceNumber.replace(/"/g, '""')}"` : 'N/A',
        dateObj.toISOString().split('T')[0],
        `"${c.createdByName.replace(/"/g, '""')}"`,
        c.status.toUpperCase(),
        c.linkedFinanceIncomeId || 'Not Linked'
      ]
    })

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${eventName.replace(/\s+/g, '_')}_Contributions.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatContributedDate = (contribAt: any) => {
    const d = contribAt?.toDate ? contribAt.toDate() : new Date(contribAt)
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-gray-200 shadow-xs">
        <Loading variant="spinner" label="Loading contribution tracking workspace..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-gray-900">Event Collection Tracker</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
              Receipt Log
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Record, filter, and audit participant payments, entrance fees, and donations per event.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManagePurposes && (
            <button
              onClick={() => setIsPurposeModalOpen(true)}
              className="px-3.5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Purposes</span>
            </button>
          )}
          {canExport && (
            <>
              <button
                onClick={handleExportPdf}
                className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>PDF Report</span>
              </button>
              <button
                onClick={handleExportCsv}
                className="px-3.5 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>CSV</span>
              </button>
            </>
          )}
          {canAdd && (
            <button
              onClick={() => {
                setEditingContribution(null)
                setIsRecordModalOpen(true)
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <span>+ Record Contribution</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Collected */}
        <Card className="p-6 border border-emerald-200 bg-emerald-50/40 shadow-xs flex flex-col justify-between">
          <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2">Total Collected</h3>
          <div className="text-3xl font-black text-emerald-600">
            ₱{metrics.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] font-semibold text-emerald-700 mt-2">{metrics.contributorCount} distinct contributors</p>
        </Card>

        {/* Cash */}
        <Card className="p-6 border border-gray-200 shadow-xs flex flex-col justify-between">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Cash Collected</h3>
          <div className="text-3xl font-black text-gray-900">
            ₱{metrics.cashTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Physical Cash</p>
        </Card>

        {/* GCash */}
        <Card className="p-6 border border-blue-200 bg-blue-50/30 shadow-xs flex flex-col justify-between">
          <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider mb-2">GCash Collected</h3>
          <div className="text-3xl font-black text-blue-600">
            ₱{metrics.gcashTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-blue-600/80 mt-2">Mobile E-Wallet</p>
        </Card>

        {/* Bank Transfer */}
        <Card className="p-6 border border-purple-200 bg-purple-50/30 shadow-xs flex flex-col justify-between">
          <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wider mb-2">Bank Transfer</h3>
          <div className="text-3xl font-black text-purple-600">
            ₱{metrics.transferTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-purple-600/80 mt-2">Direct Bank</p>
        </Card>

        {/* Other */}
        <Card className="p-6 border border-gray-200 shadow-xs flex flex-col justify-between sm:col-span-2 lg:col-span-1">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Other Payments</h3>
          <div className="text-3xl font-black text-gray-900">
            ₱{metrics.otherTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">In-Kind / Custom</p>
        </Card>
      </div>

      {/* Purpose Collection Summary Pills */}
      {Object.keys(metrics.purposeTotals).length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-2">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose Category Totals</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.purposeTotals).map(([name, sum]) => (
              <div key={name} className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs flex items-center gap-2">
                <span className="font-medium text-gray-700">{name}:</span>
                <span className="font-bold text-gray-900">₱{sum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar Card */}
      <Card className="p-4 sm:p-5 border border-gray-200 shadow-xs bg-gray-50/50 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {/* Search Box */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Search Contributor / Ref</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 pl-8 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
              />
              <svg className="w-4 h-4 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Held By Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Held By (Hawak ni)</label>
            <select
              value={selectedHeldBy}
              onChange={(e) => setSelectedHeldBy(e.target.value)}
              className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs truncate"
            >
              <option value="all">All Custodians</option>
              <option value="unassigned">Not Specified</option>
              {uniqueCustodians.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Purpose Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Purpose Category</label>
            <select
              value={selectedPurposeId}
              onChange={(e) => setSelectedPurposeId(e.target.value)}
              className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs truncate"
            >
              <option value="all">All Purposes</option>
              {purposes.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Payment Method</label>
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs truncate"
            >
              <option value="all">All Methods</option>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Date Range</label>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-medium border border-gray-200 rounded-xl px-2 py-1.5 bg-white focus:outline-none shadow-xs"
              />
              <span className="text-gray-400 text-xs shrink-0">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-1/2 min-w-0 text-xs font-medium border border-gray-200 rounded-xl px-2 py-1.5 bg-white focus:outline-none shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* Status Toggle & Link Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-gray-200 pt-3">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-gray-500 shrink-0">Record Status:</span>
              <div className="inline-flex bg-gray-200/60 p-0.5 rounded-xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedStatus('recorded')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedStatus === 'recorded' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('voided')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedStatus === 'voided' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Voided
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatus('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedStatus === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  All
                </button>
              </div>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-gray-500 shrink-0">Finance Link:</span>
              <div className="inline-flex bg-gray-200/60 p-0.5 rounded-xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedLinkStatus('all')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedLinkStatus === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLinkStatus('linked')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedLinkStatus === 'linked' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Linked
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLinkStatus('unlinked')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${selectedLinkStatus === 'unlinked' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Unlinked
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-600 shrink-0">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="text-blue-600 focus:ring-blue-500 h-4 w-4 rounded cursor-pointer"
              />
              <span>Show Archived</span>
            </label>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-xs font-semibold text-gray-500">
              Showing <strong className="text-gray-900">{filteredContributions.length}</strong> of {contributions.length} entries
            </div>
            {(searchQuery.trim() || selectedPurposeId !== 'all' || selectedHeldBy !== 'all' || selectedPaymentMethod !== 'all' || selectedStatus !== 'recorded' || selectedLinkStatus !== 'all' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedPurposeId('all')
                  setSelectedHeldBy('all')
                  setSelectedPaymentMethod('all')
                  setSelectedStatus('recorded')
                  setSelectedLinkStatus('all')
                  setStartDate('')
                  setEndDate('')
                }}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Bulk Action Bar (Visible when 1 or more items selected) */}
      {selectedIds.length > 0 && canLinkFinance && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-emerald-700 px-3 py-1 rounded-xl text-xs font-black">
              {selectedIds.length} Selected
            </span>
            <span className="text-xs font-medium">
              Total Amount: <strong>₱{selectedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-bold hover:bg-emerald-700 rounded-xl transition cursor-pointer"
            >
              Deselect All
            </button>
            <button
              onClick={() => {
                setLinkDestination('current_event')
                setSelectedFinanceCategory('')
                setTargetEventId('')
                setShowBulkLinkModal(true)
              }}
              className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-extrabold transition shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span>Record Selected as Income ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Contribution Table */}
      <Card className="overflow-hidden border border-gray-200 shadow-xs rounded-2xl">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {canLinkFinance && (
                  <th className="px-4 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={eligibleUnlinkedItems.length > 0 && selectedIds.length === eligibleUnlinkedItems.length}
                      onChange={handleSelectAll}
                      disabled={eligibleUnlinkedItems.length === 0}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                )}
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contributor</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Held By</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ref #</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Finance Link</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContributions.length === 0 ? (
                <tr>
                  <td colSpan={canLinkFinance ? 10 : 9} className="px-6 py-12 text-center text-gray-400 text-xs font-medium italic">
                    No contributions found matching your search or filters.
                  </td>
                </tr>
              ) : (
                filteredContributions.map(c => {
                  const summary = getContributionLinkSummary(c)
                  const isEligibleForLink = c.status === 'recorded' && summary.remainingToLink > 0
                  const isSelected = selectedIds.includes(c.id)

                  const paymentMethodBadges: Record<string, { label: string; style: string }> = {
                    cash: { label: 'Cash', style: 'bg-slate-100 text-slate-700 border-slate-200' },
                    gcash: { label: 'GCash', style: 'bg-blue-50 text-blue-700 border-blue-200' },
                    bank_transfer: { label: 'Bank Transfer', style: 'bg-purple-50 text-purple-700 border-purple-200' },
                    other: { label: 'Other', style: 'bg-gray-100 text-gray-700 border-gray-200' }
                  }
                  const badgeInfo = paymentMethodBadges[c.paymentMethod] || { label: c.paymentMethod, style: 'bg-gray-100 text-gray-700 border-gray-200' }

                  return (
                    <tr key={c.id} className={`transition-colors ${isSelected ? 'bg-emerald-50/60' : 'hover:bg-gray-50/80'}`}>
                      {canLinkFinance && (
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!isEligibleForLink}
                            onChange={() => handleToggleSelect(c.id)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-bold text-gray-900">{c.contributorName}</div>
                        {c.notes && <div className="text-[11px] text-gray-400 max-w-xs truncate">{c.notes}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-700">
                        {c.collectedByName || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-700">
                        {c.purposeName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xs font-black text-gray-900">
                          ₱{c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {summary.status === 'partial' && (
                          <div className="text-[10px] text-amber-600 font-semibold">
                            ₱{summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })} unlinked
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeInfo.style}`}>
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                        {c.referenceNumber || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                        {formatContributedDate(c.contributedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {summary.status === 'full' ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            {summary.allocations.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setManageAllocTarget(c)
                                  setShowManageAllocModal(true)
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 font-bold rounded-full text-[10px] uppercase border bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition cursor-pointer"
                                title="View multi-link allocations"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                <span>Multi-Link ({summary.allocations.length})</span>
                              </button>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 font-bold rounded-full text-[10px] uppercase border ${
                                summary.allocations[0]?.destination === 'main_funds'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : summary.allocations[0]?.destination === 'other_event'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              }`}>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {summary.allocations[0]?.destination === 'main_funds'
                                  ? 'Main Funds'
                                  : summary.allocations[0]?.destination === 'other_event'
                                    ? 'Other Event'
                                    : 'Linked'}
                              </span>
                            )}
                            {summary.allocations[0]?.destination === 'other_event' && summary.allocations[0]?.targetEventName && (
                              <span className="text-[10px] text-gray-500 font-medium truncate max-w-[140px]" title={summary.allocations[0].targetEventName}>
                                → {summary.allocations[0].targetEventName}
                              </span>
                            )}
                          </div>
                        ) : summary.status === 'partial' ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <button
                              type="button"
                              onClick={() => {
                                setManageAllocTarget(c)
                                setShowManageAllocModal(true)
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 font-bold rounded-full text-[10px] uppercase border bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 transition cursor-pointer"
                              title="Click to manage linked portions"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                              </svg>
                              <span>Partial (₱{summary.totalLinked.toLocaleString()})</span>
                            </button>
                            <span className="text-[10px] text-gray-500 font-medium">
                              Bal: ₱{summary.remainingToLink.toLocaleString()}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 font-bold rounded-full text-[10px] uppercase">
                            Not Linked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {c.isArchived ? (
                          <span className="inline-flex px-2.5 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 font-bold rounded-full text-[10px] uppercase">
                            Archived
                          </span>
                        ) : c.status === 'voided' ? (
                          <span className="inline-flex px-2.5 py-0.5 bg-red-50 text-red-700 border border-red-200 font-bold rounded-full text-[10px] uppercase line-through">
                            Voided
                          </span>
                        ) : (
                          <span className="inline-flex px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-full text-[10px] uppercase">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.isArchived ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRestoreContribution(c)}
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                              >
                                Restore
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTarget(c)
                                    setShowDeleteConfirm(true)
                                  }}
                                  className="p-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center"
                                  title="Delete permanently"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {c.status === 'recorded' && summary.remainingToLink > 0 && canLinkFinance && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLinkTarget(c)
                                    setCustomLinkAmount(summary.remainingToLink)
                                    setLinkDestination('current_event')
                                    setSelectedFinanceCategory('')
                                    setTargetEventId('')
                                    setShowLinkModal(true)
                                  }}
                                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                                >
                                  {summary.totalLinked > 0 ? `Link Balance (₱${summary.remainingToLink.toLocaleString()})` : 'Record as Income'}
                                </button>
                              )}
                              {c.status === 'recorded' && canEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingContribution(c)
                                    setIsRecordModalOpen(true)
                                  }}
                                  className="px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                                  title="Edit contribution details"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  <span>Edit</span>
                                </button>
                              )}
                              {summary.totalLinked > 0 && canLinkFinance && (
                                <>
                                  {summary.allocations.length === 1 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setUnlinkTarget(c)
                                        setShowUnlinkConfirm(true)
                                      }}
                                      className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                                      title="Unlink from Finance ledger"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                      <span>Unlink</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setManageAllocTarget(c)
                                        setShowManageAllocModal(true)
                                      }}
                                      className="px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                                      title="Manage linked allocations"
                                    >
                                      <span>Links ({summary.allocations.length})</span>
                                    </button>
                                  )}
                                </>
                              )}
                              {c.status === 'recorded' && summary.totalLinked === 0 && canVoid && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidTarget(c)
                                    setShowVoidConfirm(true)
                                  }}
                                  className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                                >
                                  Void
                                </button>
                              )}
                              {summary.totalLinked === 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setArchiveTarget(c)
                                    setShowArchiveConfirm(true)
                                  }}
                                  className="px-2.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1"
                                  title="Archive contribution record"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                  </svg>
                                </button>
                              )}
                              {canDelete && summary.totalLinked === 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeleteTarget(c)
                                    setShowDeleteConfirm(true)
                                  }}
                                  className="p-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center"
                                  title="Delete permanently"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modals */}
      <EventContributionModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false)
          setEditingContribution(null)
        }}
        eventId={eventId}
        onSuccess={fetchData}
        contributionToEdit={editingContribution}
      />

      <ContributionPurposeModal
        isOpen={isPurposeModalOpen}
        onClose={() => setIsPurposeModalOpen(false)}
        eventId={eventId}
        onSuccess={fetchData}
      />

      {/* Single Link to Finance Modal */}
      {showLinkModal && linkTarget && (() => {
        const summary = getContributionLinkSummary(linkTarget)
        const isAmountExceeded = typeof customLinkAmount === 'number' && customLinkAmount > summary.remainingToLink
        const isAmountZeroOrNegative = typeof customLinkAmount === 'number' && customLinkAmount <= 0
        const isAmountInvalid = customLinkAmount === '' || isAmountExceeded || isAmountZeroOrNegative

        return (
          <Modal 
            isOpen={showLinkModal} 
            onClose={() => { 
              setShowLinkModal(false)
              setLinkTarget(null)
              setLinkDestination('current_event')
              setSelectedFinanceCategory('')
              setTargetEventId('')
              setCustomLinkAmount('')
            }} 
            title="Record Contribution as Income" 
            maxWidth="sm"
          >
            <form onSubmit={handleLinkFinanceSubmit} className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium space-y-1">
                <div>Contribution: <strong>₱{linkTarget.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> ({linkTarget.purposeName}) from <strong>{linkTarget.contributorName}</strong></div>
                {summary.totalLinked > 0 && (
                  <div className="text-[11px] text-gray-500">
                    Already linked: <strong>₱{summary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> | Remaining unlinked: <strong className="text-emerald-700">₱{summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                  </div>
                )}
              </div>

              {/* Destination Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1.5">Select Destination Ledger *</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold text-center">
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('current_event')}
                    className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'current_event' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    This Event
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('main_funds')}
                    disabled={!canLinkMainFunds}
                    className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'main_funds' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={!canLinkMainFunds ? 'Requires Church Finance access' : 'Link to Church General Treasury'}
                  >
                    Main Funds
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('other_event')}
                    className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'other_event' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                  >
                    Other Event
                  </button>
                </div>
              </div>

              {/* Amount to link */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase text-gray-500">Amount to Link (₱) *</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-gray-500 font-semibold">Available: ₱{summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    {isAmountExceeded && (
                      <button
                        type="button"
                        onClick={() => setCustomLinkAmount(summary.remainingToLink)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                      >
                        (Reset to Max)
                      </button>
                    )}
                  </div>
                </div>
                <div className="relative rounded-xl shadow-xs">
                  <div className={`absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none font-bold text-xs ${isAmountExceeded ? 'text-red-500' : 'text-gray-400'}`}>
                    ₱
                  </div>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={summary.remainingToLink}
                    required
                    value={customLinkAmount}
                    onChange={(e) => setCustomLinkAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className={`w-full pl-8 pr-3 py-2 text-xs font-black rounded-xl bg-white focus:outline-none shadow-xs transition-colors ${
                      isAmountExceeded 
                        ? 'text-red-900 border-2 border-red-500 focus:ring-2 focus:ring-red-200' 
                        : 'text-gray-900 border border-gray-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500'
                    }`}
                    placeholder={String(summary.remainingToLink)}
                  />
                </div>

                {/* Warning when amount exceeds remaining available */}
                {isAmountExceeded && (
                  <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-center justify-between gap-2 animate-fadeIn">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>
                        Sumobra ang halaga! Available to link is <strong>₱{summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> (sobra ng ₱{(customLinkAmount - summary.remainingToLink).toLocaleString('en-US', { minimumFractionDigits: 2 })}).
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomLinkAmount(summary.remainingToLink)}
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded-lg text-[10px] font-extrabold shrink-0 cursor-pointer transition"
                    >
                      Fix to ₱{summary.remainingToLink.toLocaleString()}
                    </button>
                  </div>
                )}

                {/* Warning when amount is zero or negative */}
                {isAmountZeroOrNegative && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-center gap-1.5 animate-fadeIn">
                    <svg className="w-4 h-4 shrink-0 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Ang halaga ay dapat mas mataas sa ₱0.00.</span>
                  </div>
                )}

                {/* Partial allocation info helper */}
                {!isAmountInvalid && typeof customLinkAmount === 'number' && customLinkAmount > 0 && customLinkAmount < summary.remainingToLink && (
                  <div className="mt-2 p-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl text-[11px] text-blue-900 flex items-start gap-2 animate-fadeIn">
                    <svg className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="space-y-0.5">
                      <span className="font-bold">Partial Allocation:</span>
                      <div className="text-[11px] text-blue-800">
                        • <strong>₱{customLinkAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> will be recorded to selected Finance ledger.
                      </div>
                      <div className="text-[11px] text-blue-800">
                        • <strong>₱{(summary.remainingToLink - customLinkAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> will remain available to link later.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Target Event Dropdown (if destination is other_event) */}
              {linkDestination === 'other_event' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Target Event *</label>
                  {loadingDestCategories && otherEvents.length === 0 ? (
                    <div className="text-xs text-gray-400 py-2">Loading events...</div>
                  ) : (
                    <select
                      required
                      value={targetEventId}
                      onChange={(e) => handleTargetEventChange(e.target.value)}
                      className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                    >
                      <option value="">-- Choose Target Event --</option>
                      {otherEvents.map(evt => (
                        <option key={evt.id} value={evt.id}>{evt.title}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Finance Category Dropdown */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  {linkDestination === 'main_funds' ? 'Main Finance Category *' : 'Event Finance Category *'}
                </label>
                {loadingDestCategories ? (
                  <div className="text-xs text-gray-400 py-2">Loading categories...</div>
                ) : (
                  <select
                    required
                    value={selectedFinanceCategory}
                    onChange={(e) => setSelectedFinanceCategory(e.target.value)}
                    className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  >
                    <option value="">-- Choose Category --</option>
                    {activeCategoriesList.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Income Received Date *</label>
                <input
                  type="date"
                  required
                  value={financeLinkDate}
                  onChange={(e) => setFinanceLinkDate(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { 
                    setShowLinkModal(false)
                    setLinkTarget(null)
                    setLinkDestination('current_event')
                    setSelectedFinanceCategory('')
                    setTargetEventId('')
                    setCustomLinkAmount('')
                  }}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedFinanceCategory || (linkDestination === 'other_event' && !targetEventId) || isAmountInvalid}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs transition-opacity"
                >
                  {submitting ? 'Linking...' : 'Confirm Link'}
                </button>
              </div>
            </form>
          </Modal>
        )
      })()}

      {/* Manage Linked Allocations Modal */}
      {showManageAllocModal && manageAllocTarget && (() => {
        const summary = getContributionLinkSummary(manageAllocTarget)
        return (
          <Modal
            isOpen={showManageAllocModal}
            onClose={() => {
              setShowManageAllocModal(false)
              setManageAllocTarget(null)
            }}
            title="Manage Finance Links"
            maxWidth="md"
          >
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">
                <div>Contributor: <strong>{manageAllocTarget.contributorName}</strong> ({manageAllocTarget.purposeName})</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                  <span>Total Contribution: <strong>₱{manageAllocTarget.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Linked: <strong className="text-purple-700">₱{summary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                  <span>Remaining: <strong className="text-emerald-700">₱{summary.remainingToLink.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-gray-700 uppercase">Linked Portions ({summary.allocations.length})</div>
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white">
                  {summary.allocations.map((alloc, idx) => {
                    const destLabel = alloc.destination === 'main_funds'
                      ? 'Main Church Funds'
                      : alloc.destination === 'other_event'
                        ? `Event: ${alloc.targetEventName || 'Other Event'}`
                        : 'This Event Finance'

                    return (
                      <div key={alloc.id || idx} className="p-3 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-gray-900">
                              ₱{Number(alloc.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              alloc.destination === 'main_funds'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : alloc.destination === 'other_event'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {destLabel}
                            </span>
                          </div>
                          {alloc.categoryName && (
                            <div className="text-[11px] text-gray-500">
                              Category: {alloc.categoryName} {alloc.date ? `• Date: ${alloc.date}` : ''}
                            </div>
                          )}
                        </div>

                        {canLinkFinance && (
                          <button
                            type="button"
                            onClick={() => {
                              setUnlinkAllocTarget({
                                contributionId: manageAllocTarget.id,
                                allocationId: alloc.id,
                                amount: Number(alloc.amount),
                                label: destLabel
                              })
                              setShowUnlinkAllocConfirm(true)
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition cursor-pointer flex items-center gap-1"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Unlink</span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                {canLinkFinance && summary.remainingToLink > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowManageAllocModal(false)
                      setLinkTarget(manageAllocTarget)
                      setCustomLinkAmount(summary.remainingToLink)
                      setLinkDestination('current_event')
                      setSelectedFinanceCategory('')
                      setTargetEventId('')
                      setShowLinkModal(true)
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    + Link Remaining (₱{summary.remainingToLink.toLocaleString()})
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => {
                    setShowManageAllocModal(false)
                    setManageAllocTarget(null)
                  }}
                  className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </Modal>
        )
      })()}

      {/* Bulk Link to Finance Modal */}
      {showBulkLinkModal && (
        <Modal 
          isOpen={showBulkLinkModal} 
          onClose={() => {
            setShowBulkLinkModal(false)
            setLinkDestination('current_event')
            setSelectedFinanceCategory('')
            setTargetEventId('')
          }} 
          title={`Bulk Link ${selectedIds.length} Contributions to Finance`} 
          maxWidth="sm"
        >
          <form onSubmit={handleBulkLinkSubmit} className="space-y-4">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-medium">
              You are about to record <strong>{selectedIds.length} selected contributions</strong> (Total: <strong>₱{selectedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>) into Finance.
            </div>

            {/* Destination Selector */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1.5">Select Destination Ledger *</label>
              <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold text-center">
                <button
                  type="button"
                  onClick={() => handleDestinationChange('current_event')}
                  className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'current_event' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  This Event
                </button>
                <button
                  type="button"
                  onClick={() => handleDestinationChange('main_funds')}
                  disabled={!canLinkMainFunds}
                  className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'main_funds' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={!canLinkMainFunds ? 'Requires Church Finance access' : 'Link to Church General Treasury'}
                >
                  Main Funds
                </button>
                <button
                  type="button"
                  onClick={() => handleDestinationChange('other_event')}
                  className={`py-1.5 px-1 rounded-lg transition-all cursor-pointer truncate ${linkDestination === 'other_event' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  Other Event
                </button>
              </div>
            </div>

            {/* Target Event Dropdown (if destination is other_event) */}
            {linkDestination === 'other_event' && (
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Target Event *</label>
                {loadingDestCategories && otherEvents.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2">Loading events...</div>
                ) : (
                  <select
                    required
                    value={targetEventId}
                    onChange={(e) => handleTargetEventChange(e.target.value)}
                    className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                  >
                    <option value="">-- Choose Target Event --</option>
                    {otherEvents.map(evt => (
                      <option key={evt.id} value={evt.id}>{evt.title}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Finance Category Dropdown */}
            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                {linkDestination === 'main_funds' ? 'Main Finance Category *' : 'Event Finance Category *'}
              </label>
              {loadingDestCategories ? (
                <div className="text-xs text-gray-400 py-2">Loading categories...</div>
              ) : (
                <select
                  required
                  value={selectedFinanceCategory}
                  onChange={(e) => setSelectedFinanceCategory(e.target.value)}
                  className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
                >
                  <option value="">-- Choose Category --</option>
                  {activeCategoriesList.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">Income Received Date *</label>
              <input
                type="date"
                required
                value={financeLinkDate}
                onChange={(e) => setFinanceLinkDate(e.target.value)}
                className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 shadow-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setShowBulkLinkModal(false)
                  setLinkDestination('current_event')
                  setSelectedFinanceCategory('')
                  setTargetEventId('')
                }}
                className="px-4 py-2 border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedFinanceCategory || (linkDestination === 'other_event' && !targetEventId)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {submitting ? 'Processing Bulk Link...' : 'Confirm Bulk Link'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Unlink Single Allocation Dialog */}
      <ConfirmModal
        isOpen={showUnlinkAllocConfirm}
        onClose={() => { setShowUnlinkAllocConfirm(false); setUnlinkAllocTarget(null); }}
        onConfirm={handleUnlinkAllocConfirm}
        title="Unlink Portion from Finance"
        message={`Are you sure you want to unlink ₱${unlinkAllocTarget?.amount.toLocaleString()} from ${unlinkAllocTarget?.label}? The corresponding income entry in the finance ledger will be removed, and this amount will return to the contribution's unlinked balance.`}
        confirmLabel="Unlink Portion"
        variant="warning"
      />

      {/* Confirm Unlink All Dialog */}
      <ConfirmModal
        isOpen={showUnlinkConfirm}
        onClose={() => { setShowUnlinkConfirm(false); setUnlinkTarget(null); }}
        onConfirm={handleUnlinkConfirm}
        title="Unlink Contribution from Finance"
        message={`Are you sure you want to unlink all finance records for the contribution of ₱${unlinkTarget?.amount.toLocaleString()} from ${unlinkTarget?.contributorName}? All recorded income entries in the finance ledger will be removed.`}
        confirmLabel="Unlink All"
        variant="warning"
      />

      {/* Confirm Permanent Delete Dialog */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
        onConfirm={handleDeleteConfirm}
        title="Delete Contribution Record"
        message={`Are you sure you want to permanently delete the contribution record of ₱${deleteTarget?.amount.toLocaleString()} from ${deleteTarget?.contributorName}? ${deleteTarget?.linkedFinanceIncomeId ? 'This contribution is linked to Finance, so the associated ledger income entries will also be permanently removed.' : ''} This action cannot be undone.`}
        confirmLabel="Delete Permanently"
        variant="danger"
      />

      {/* Confirm Archive Dialog */}
      <ConfirmModal
        isOpen={showArchiveConfirm}
        onClose={() => { setShowArchiveConfirm(false); setArchiveTarget(null); }}
        onConfirm={handleArchiveConfirm}
        title="Archive Contribution Record"
        message={`Are you sure you want to archive the contribution of ₱${archiveTarget?.amount.toLocaleString()} from ${archiveTarget?.contributorName}? You can view and restore archived items anytime using the "Show Archived" filter.`}
        confirmLabel="Archive Record"
        variant="warning"
      />

      {/* Confirm Void Dialog */}
      <ConfirmModal
        isOpen={showVoidConfirm}
        onClose={() => { setShowVoidConfirm(false); setVoidTarget(null); }}
        onConfirm={handleVoidConfirm}
        title="Void Contribution Record"
        message={`Are you sure you want to void the contribution of ₱${voidTarget?.amount.toLocaleString()} from ${voidTarget?.contributorName}? This action is irreversible for audit trails.`}
        confirmLabel="Void Record"
        variant="danger"
      />

      {/* Alert modal */}
      <AlertModal
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        title={alertTitle}
        message={alertMessage || ''}
      />

      {/* Dynamic PDF Export Modal with Signatures */}
      <EventContributionExportModal
        isOpen={showExportPdfModal}
        onClose={() => setShowExportPdfModal(false)}
        eventName={eventName}
        contributions={filteredContributions}
        filterDescription={(() => {
          let desc = ''
          if (selectedPurposeId !== 'all') {
            const p = purposes.find(purp => purp.id === selectedPurposeId)
            desc += `Purpose: ${p ? p.name : 'Unknown'}. `
          }
          if (selectedPaymentMethod !== 'all') {
            desc += `Method: ${selectedPaymentMethod.toUpperCase()}. `
          }
          if (selectedStatus !== 'all') {
            desc += `Status: ${selectedStatus.toUpperCase()}. `
          }
          return desc || undefined
        })()}
      />
    </div>
  )
}
