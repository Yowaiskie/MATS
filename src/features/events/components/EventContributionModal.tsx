import React, { useState, useEffect } from 'react'
import { Modal, CurrencyInput, CustomSelect, Button, useToast } from '@/components'
import { MemberCombobox } from '@/components/MemberCombobox'
import { useAuth } from '@/features/authentication/AuthContext'
import { eventContributionService } from '@/services/eventContributionService'
import { memberService } from '@/services/memberService'
import type { EventContribution, EventContributionPurpose, ContributionPaymentMethod } from '@/types/eventContribution'
import { getContributionLinkSummary } from '@/types/eventContribution'
import type { Member } from '@/types/member'
import { Timestamp } from 'firebase/firestore'

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  onSuccess: () => void
  contributionToEdit?: EventContribution | null
}

interface GroupMemberEntry {
  id: string
  name: string
  memberUid?: string
  amount: string
}

export const EventContributionModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventId,
  onSuccess,
  contributionToEdit
}) => {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [purposes, setPurposes] = useState<EventContributionPurpose[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mode: 'single' vs 'group'
  const [entryMode, setEntryMode] = useState<'single' | 'group'>('single')

  // Form State (Single)
  const [contributorUid, setContributorUid] = useState('')
  const [contributorName, setContributorName] = useState('')
  const [amount, setAmount] = useState('')

  // Form State (Group)
  const [payerName, setPayerName] = useState('')
  const [defaultGroupAmount, setDefaultGroupAmount] = useState('')
  const [groupEntries, setGroupEntries] = useState<GroupMemberEntry[]>([
    { id: '1', name: '', amount: '' },
    { id: '2', name: '', amount: '' }
  ])

  // Shared Form State
  const [purposeId, setPurposeId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<ContributionPaymentMethod>('cash')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [contributedDate, setContributedDate] = useState(new Date().toISOString().split('T')[0])
  const [collectedByName, setCollectedByName] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchInitialData()
      if (contributionToEdit) {
        setEntryMode('single')
        setContributorUid(contributionToEdit.contributorUid || '')
        setContributorName(contributionToEdit.contributorName || '')
        setPurposeId(contributionToEdit.purposeId || '')
        const rawAmt = contributionToEdit.amount !== undefined ? String(contributionToEdit.amount) : ''
        setAmount(rawAmt)
        setDefaultGroupAmount(rawAmt)
        setPaymentMethod(contributionToEdit.paymentMethod || 'cash')
        setReferenceNumber(contributionToEdit.referenceNumber || '')

        let cleanedNotes = contributionToEdit.notes || ''
        let extractedPayer = ''
        const match = cleanedNotes.match(/^Paid via:\s*([^•]+)(?:\s*•\s*)?/i)
        if (match) {
          extractedPayer = match[1].trim()
          cleanedNotes = cleanedNotes.replace(/^Paid via:\s*[^•]+(?:\s*•\s*)?/i, '').trim()
        }
        setPayerName(extractedPayer)
        setNotes(cleanedNotes)

        setGroupEntries([
          {
            id: 'original_' + contributionToEdit.id,
            name: contributionToEdit.contributorName || '',
            memberUid: contributionToEdit.contributorUid || undefined,
            amount: rawAmt
          }
        ])

        let dateStr = new Date().toISOString().split('T')[0]
        if (contributionToEdit.contributedAt) {
          const d = contributionToEdit.contributedAt.toDate
            ? contributionToEdit.contributedAt.toDate()
            : new Date(contributionToEdit.contributedAt as any)
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear()
            const month = String(d.getMonth() + 1).padStart(2, '0')
            const day = String(d.getDate()).padStart(2, '0')
            dateStr = `${year}-${month}-${day}`
          }
        }
        setContributedDate(dateStr)
        setCollectedByName(contributionToEdit.collectedByName || '')
        setError(null)
      } else {
        resetForm()
      }
    }
  }, [isOpen, contributionToEdit])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const [purposesData, membersData] = await Promise.all([
        eventContributionService.getPurposesByEventId(eventId),
        memberService.getMembers(false) // active members only
      ])
      setPurposes(purposesData.filter(p => !p.isArchived || (contributionToEdit && p.id === contributionToEdit.purposeId)))
      setMembers(membersData)
    } catch (err) {
      console.error('Failed to load modal data:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEntryMode('single')
    setContributorUid('')
    setContributorName('')
    setPayerName('')
    setPurposeId('')
    setAmount('')
    setDefaultGroupAmount('')
    setGroupEntries([
      { id: '1', name: '', amount: '' },
      { id: '2', name: '', amount: '' }
    ])
    setPaymentMethod('cash')
    setReferenceNumber('')
    setContributedDate(new Date().toISOString().split('T')[0])
    setCollectedByName(profile?.displayName || profile?.email || '')
    setNotes('')
    setError(null)
  }

  const handleSwitchMode = (newMode: 'single' | 'group') => {
    setEntryMode(newMode)
    if (newMode === 'group') {
      if (groupEntries.length === 0 || (groupEntries.length === 1 && !groupEntries[0].name.trim())) {
        setGroupEntries([
          {
            id: contributionToEdit ? 'original_' + contributionToEdit.id : '1',
            name: contributorName.trim() || '',
            memberUid: contributorUid || undefined,
            amount: amount || defaultGroupAmount || ''
          },
          {
            id: '2',
            name: '',
            amount: defaultGroupAmount || amount || ''
          }
        ])
      }
      if (!payerName.trim() && contributorName.trim()) {
        setPayerName(contributorName.trim())
      }
    } else {
      if (groupEntries.length > 0 && groupEntries[0].name.trim()) {
        setContributorName(groupEntries[0].name)
        setContributorUid(groupEntries[0].memberUid || '')
        if (groupEntries[0].amount) {
          setAmount(groupEntries[0].amount)
        }
      }
    }
  }

  const handleAddGroupRow = () => {
    setGroupEntries(prev => [
      ...prev,
      { id: Math.random().toString(36).substring(2, 9), name: '', amount: defaultGroupAmount || '' }
    ])
  }

  const handleRemoveGroupRow = (index: number) => {
    if (groupEntries.length <= 1) return
    setGroupEntries(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateGroupRow = (index: number, updates: Partial<GroupMemberEntry>) => {
    setGroupEntries(prev => prev.map((entry, i) => i === index ? { ...entry, ...updates } : entry))
  }

  const handleApplyDefaultAmount = () => {
    if (!defaultGroupAmount) return
    setGroupEntries(prev => prev.map(entry => ({ ...entry, amount: defaultGroupAmount })))
  }

  const groupTotalAmount = groupEntries.reduce((sum, e) => sum + (Number(e.amount.replace(/[^0-9.]/g, '')) || 0), 0)

  // Detect related family / siblings (same last name in directory)
  const getFamilySuggestions = (targetName: string, targetUid?: string) => {
    if (!targetName.trim()) return []
    let baseMember = members.find(m => m.id === targetUid)
    if (!baseMember) {
      baseMember = members.find(m => `${m.firstName} ${m.lastName}`.toLowerCase() === targetName.toLowerCase().trim())
    }

    let lastName = ''
    if (baseMember) {
      lastName = baseMember.lastName.trim()
    } else {
      const parts = targetName.trim().split(/\s+/)
      if (parts.length > 1) {
        lastName = parts[parts.length - 1]
      }
    }

    if (!lastName || lastName.length < 2) return []

    const currentGroupNames = groupEntries.map(e => e.name.toLowerCase().trim())
    return members.filter(m => {
      const fullName = `${m.firstName} ${m.lastName}`.trim()
      const isSameMember = baseMember ? m.id === baseMember.id : fullName.toLowerCase() === targetName.toLowerCase().trim()
      const isAlreadyInGroup = entryMode === 'group' && currentGroupNames.includes(fullName.toLowerCase())
      const isSameLastName = m.lastName.toLowerCase().trim() === lastName.toLowerCase().trim()
      return isSameLastName && !isSameMember && !isAlreadyInGroup
    })
  }

  const handleAddFamilyMember = (fm: Member) => {
    const fullName = `${fm.firstName} ${fm.lastName}`.trim()
    const amt = defaultGroupAmount || amount || (groupEntries[0]?.amount) || '100'

    if (entryMode === 'single') {
      setEntryMode('group')
      if (!payerName.trim() && contributorName.trim()) {
        setPayerName(contributorName.trim())
      }
      setGroupEntries([
        {
          id: contributionToEdit ? 'original_' + contributionToEdit.id : '1',
          name: contributorName.trim() || '',
          memberUid: contributorUid || undefined,
          amount: amount || amt
        },
        {
          id: Math.random().toString(36).substring(2, 9),
          name: fullName,
          memberUid: fm.id,
          amount: amt
        }
      ])
    } else {
      setGroupEntries(prev => {
        // If there's an empty row, fill it
        const firstEmptyIdx = prev.findIndex(e => !e.name.trim())
        if (firstEmptyIdx !== -1) {
          return prev.map((e, idx) => idx === firstEmptyIdx ? { ...e, name: fullName, memberUid: fm.id, amount: e.amount || amt } : e)
        }
        return [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            name: fullName,
            memberUid: fm.id,
            amount: amt
          }
        ]
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    if (!purposeId) {
      setError('Purpose category is required.')
      return
    }

    const selectedPurpose = purposes.find(p => p.id === purposeId)
    if (!selectedPurpose) {
      setError('Invalid purpose selected.')
      return
    }

    // ==========================================
    // GROUP / MULTI-MEMBER SUBMISSION
    // ==========================================
    if (entryMode === 'group') {
      const validEntries = groupEntries.filter(e => e.name.trim().length > 0)
      if (validEntries.length === 0) {
        setError('Please enter or select at least one member.')
        return
      }

      for (let i = 0; i < validEntries.length; i++) {
        const item = validEntries[i]
        const num = Number(item.amount.replace(/,/g, ''))
        if (isNaN(num) || num <= 0) {
          setError(`Please specify a valid positive amount for "${item.name}".`)
          return
        }
      }

      if ((paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') && !referenceNumber.trim()) {
        setError('Reference number is required for GCash / Bank Transfer.')
        return
      }

      // Check linked finance amount on the first entry if editing
      if (contributionToEdit) {
        const summary = getContributionLinkSummary(contributionToEdit)
        const primaryAmt = Number(validEntries[0].amount.replace(/,/g, ''))
        if (summary.totalLinked > 0 && primaryAmt < summary.totalLinked) {
          setError(`Amount for primary record cannot be less than the already linked amount of ₱${summary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Please unlink portions first if needed.`)
          return
        }
      }

      setSubmitting(true)
      setError(null)
      try {
        const parts = contributedDate.split('-').map(Number)
        const contributedAtDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
        const contributedAt = Timestamp.fromDate(contributedAtDate)

        if (contributionToEdit) {
          // 1. Update the original contribution record with the primary row
          const primaryItem = validEntries[0]
          const primaryNum = Number(primaryItem.amount.replace(/,/g, ''))
          const isPrimaryPayer = payerName.trim().toLowerCase() === primaryItem.name.trim().toLowerCase()
          const primaryPayerPrefix = payerName.trim() && !isPrimaryPayer ? `Paid via: ${payerName.trim()}` : ''
          const primaryCombinedNotes = [primaryPayerPrefix, notes.trim()].filter(Boolean).join(' • ')

          await eventContributionService.updateContribution(
            contributionToEdit.id,
            {
              contributorUid: primaryItem.memberUid || null,
              contributorName: primaryItem.name.trim(),
              purposeId,
              purposeName: selectedPurpose.name,
              amount: primaryNum,
              paymentMethod,
              referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
              collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
              notes: primaryCombinedNotes,
              contributedAt
            },
            profile.uid,
            profile.displayName || profile.email
          )

          // 2. If additional companion / family rows were added, create them via batch
          const additionalItems = validEntries.slice(1)
          if (additionalItems.length > 0) {
            const batchPayload = additionalItems.map(item => {
              const num = Number(item.amount.replace(/,/g, ''))
              const isPayerThemselves = payerName.trim().toLowerCase() === item.name.trim().toLowerCase()
              const payerPrefix = payerName.trim() && !isPayerThemselves ? `Paid via: ${payerName.trim()}` : (primaryItem.name.trim() ? `Paid via: ${primaryItem.name.trim()}` : '')
              const combinedNotes = [payerPrefix, notes.trim()].filter(Boolean).join(' • ')

              return {
                eventId,
                contributorUid: item.memberUid || null,
                contributorName: item.name.trim(),
                purposeId,
                purposeName: selectedPurpose.name,
                amount: num,
                paymentMethod,
                referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
                collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
                notes: combinedNotes,
                contributedAt
              }
            })

            await eventContributionService.addBatchContributions(
              batchPayload,
              profile.uid,
              profile.displayName || profile.email || 'Admin'
            )
          }
        } else {
          // New Group Contribution
          const batchPayload = validEntries.map(item => {
            const num = Number(item.amount.replace(/,/g, ''))
            const isPayerThemselves = payerName.trim().toLowerCase() === item.name.trim().toLowerCase()
            const payerPrefix = payerName.trim() && !isPayerThemselves ? `Paid via: ${payerName.trim()}` : ''
            const combinedNotes = [payerPrefix, notes.trim()].filter(Boolean).join(' • ')

            return {
              eventId,
              contributorUid: item.memberUid || null,
              contributorName: item.name.trim(),
              purposeId,
              purposeName: selectedPurpose.name,
              amount: num,
              paymentMethod,
              referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
              collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
              notes: combinedNotes,
              contributedAt
            }
          })

          await eventContributionService.addBatchContributions(
            batchPayload,
            profile.uid,
            profile.displayName || profile.email || 'Admin'
          )
        }

        toast.success(
          contributionToEdit ? 'Group Contributions Updated' : 'Group Contributions Saved',
          `Successfully saved ${validEntries.length} member contributions.`
        )
        onSuccess()
        onClose()
      } catch (err: any) {
        setError(err.message || 'Failed to save group contributions.')
      } finally {
        setSubmitting(false)
      }
      return
    }

    // ==========================================
    // SINGLE MEMBER SUBMISSION
    // ==========================================
    const numAmount = Number(amount.replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Amount must be a positive number.')
      return
    }

    if (contributionToEdit) {
      const summary = getContributionLinkSummary(contributionToEdit)
      if (summary.totalLinked > 0 && numAmount < summary.totalLinked) {
        setError(`Amount cannot be less than the already linked amount of ₱${summary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Please unlink portions first if needed.`)
        return
      }
    }

    const finalContributorName = contributorName.trim()
    if (!finalContributorName) {
      setError('Contributor name is required.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const parts = contributedDate.split('-').map(Number)
      const contributedAtDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0)
      const contributedAt = Timestamp.fromDate(contributedAtDate)

      if (contributionToEdit) {
        await eventContributionService.updateContribution(
          contributionToEdit.id,
          {
            contributorUid: contributorUid || null,
            contributorName: finalContributorName,
            purposeId,
            purposeName: selectedPurpose.name,
            amount: numAmount,
            paymentMethod,
            referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
            collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
            notes: notes.trim(),
            contributedAt
          },
          profile.uid,
          profile.displayName || profile.email
        )
      } else {
        await eventContributionService.addContribution(
          {
            eventId,
            contributorUid: contributorUid || null,
            contributorName: finalContributorName,
            purposeId,
            purposeName: selectedPurpose.name,
            amount: numAmount,
            paymentMethod,
            referenceNumber: (paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') ? referenceNumber.trim() : '',
            collectedByName: collectedByName.trim() || profile.displayName || profile.email || 'N/A',
            notes: notes.trim(),
            contributedAt
          },
          profile.uid,
          profile.displayName || profile.email
        )
      }
      toast.success(
        contributionToEdit ? 'Contribution Updated' : 'Contribution Saved',
        `Successfully ${contributionToEdit ? 'updated' : 'recorded'} contribution for ${finalContributorName}.`
      )
      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save contribution.')
    } finally {
      setSubmitting(false)
    }
  }

  const linkSummary = contributionToEdit ? getContributionLinkSummary(contributionToEdit) : null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={contributionToEdit ? 'Edit Event Contribution' : 'Record Event Contribution'}
      subtitle={contributionToEdit ? 'Update member or sponsor contribution details' : 'Log individual or grouped member contributions'}
      badge="Event Contribution"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      }
      maxWidth="2xl"
    >
      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400">Loading form parameters...</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl animate-fade-in">
              {error}
            </div>
          )}

          {linkSummary && linkSummary.totalLinked > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <strong>Finance Link Notice:</strong> This contribution has ₱{linkSummary.totalLinked.toLocaleString('en-US', { minimumFractionDigits: 2 })} linked to Finance. The amount cannot be reduced below this total.
              </div>
            </div>
          )}

          {/* Mode Switcher */}
          <div className="flex p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 mb-2">
            <button
              type="button"
              onClick={() => handleSwitchMode('single')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                entryMode === 'single'
                  ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Single Member (Isang Tao)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('group')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                entryMode === 'group'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25 ring-1 ring-indigo-700/20'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>Group / Family (May Kasama / Kapatid)</span>
            </button>
          </div>

          {/* Group Mode: Primary Payer */}
          {entryMode === 'group' && (
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-900">
                  Primary Payer (Sino ang nag-abot / nagbayad)
                </label>
                <span className="text-[10px] font-semibold text-indigo-600">e.g. Kuya John, Sponsor, Parent</span>
              </div>
              <MemberCombobox
                placeholder="Search masterlist or type payer name..."
                value={payerName}
                members={members}
                onChange={(name) => setPayerName(name)}
                helperText="Auto-added to notes of covered members (e.g. 'Paid via: Kuya John')."
              />
            </div>
          )}

          {/* Single Mode: Contributor Search/Input */}
          {entryMode === 'single' && (
            <div className="space-y-2">
              <MemberCombobox
                label="Contributor Name"
                placeholder="Search MATS masterlist or enter custom contributor name..."
                required
                value={contributorName}
                members={members}
                onChange={(name, uid) => {
                  setContributorName(name)
                  setContributorUid(uid || '')
                }}
                helperText="Select active server from masterlist, or type custom name for sponsors/donors/family."
              />

              {/* Family / Siblings Suggestions */}
              {(() => {
                const familySuggestions = getFamilySuggestions(contributorName, contributorUid)
                if (familySuggestions.length === 0) return null

                return (
                  <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-900">
                      <span>Family / Sibling Suggestions:</span>
                      <span className="text-slate-400 font-normal lowercase">(same surname in masterlist)</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {familySuggestions.map(fm => (
                        <button
                          key={fm.id}
                          type="button"
                          onClick={() => handleAddFamilyMember(fm)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                          title="Click to add as group payment with this family member"
                        >
                          <span className="text-indigo-400 group-hover:text-white font-black">+</span>
                          <span>{fm.firstName} {fm.lastName}</span>
                          <span className="text-[9px] opacity-75 font-normal">({fm.rank})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Purpose category selection */}
          <div>
            <CustomSelect
              label="Contribution Purpose"
              required
              value={purposeId}
              onChange={(e) => setPurposeId(e.target.value)}
              options={[
                { value: '', label: '-- Select Purpose category --' },
                ...purposes.map((p) => ({
                  value: p.id,
                  label: p.name
                }))
              ]}
            />
          </div>

          {/* Single Mode: Amount & Date */}
          {entryMode === 'single' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <CurrencyInput
                  label="Amount (PHP)"
                  required
                  placeholder="500.00"
                  value={amount}
                  onChange={(_formatted, numeric) => setAmount(String(numeric))}
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Contribution Date *</label>
                <input
                  type="date"
                  required
                  value={contributedDate}
                  onChange={(e) => setContributedDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Group Mode: Members Breakdown List */}
          {entryMode === 'group' && (
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                    Members / Family Covered ({groupEntries.length}) *
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Add each member or family member covered by this payment.</span>
                </div>

                {/* Default Amount Helper */}
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Fixed Each: ₱</span>
                  <input
                    type="text"
                    placeholder="100.00"
                    value={defaultGroupAmount}
                    onChange={(e) => setDefaultGroupAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-20 text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-indigo-500 text-right"
                  />
                  <button
                    type="button"
                    onClick={handleApplyDefaultAmount}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                  >
                    Apply All
                  </button>
                </div>
              </div>

              {/* Family Suggestions in Group Mode */}
              {(() => {
                const currentGroupNames = groupEntries.map(e => e.name.toLowerCase().trim()).filter(Boolean)
                const namesToCheck = [payerName, ...groupEntries.map(e => e.name)].filter(Boolean)
                const checkedLastNames = new Set<string>()
                const familyMatches: Member[] = []

                for (const name of namesToCheck) {
                  const matched = members.find(m => `${m.firstName} ${m.lastName}`.toLowerCase() === name.toLowerCase().trim())
                  const lastName = matched ? matched.lastName.trim() : (name.trim().split(/\s+/).pop() || '')
                  if (lastName && lastName.length >= 2 && !checkedLastNames.has(lastName.toLowerCase())) {
                    checkedLastNames.add(lastName.toLowerCase())
                    const related = members.filter(m => 
                      m.lastName.toLowerCase().trim() === lastName.toLowerCase() &&
                      !currentGroupNames.includes(`${m.firstName} ${m.lastName}`.toLowerCase())
                    )
                    familyMatches.push(...related)
                  }
                }

                if (familyMatches.length === 0) return null

                return (
                  <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-900">
                      <span>Suggested Family Members / Siblings:</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {familyMatches.map(fm => (
                        <button
                          key={fm.id}
                          type="button"
                          onClick={() => handleAddFamilyMember(fm)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                        >
                          <span className="text-indigo-400 group-hover:text-white font-black">+</span>
                          <span>{fm.firstName} {fm.lastName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Rows */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {groupEntries.map((entry, idx) => (
                  <div key={entry.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="text-[10px] font-black text-slate-400 w-5 shrink-0 text-center sm:text-left">
                      #{idx + 1}
                    </div>
                    <div className="flex-1">
                      <MemberCombobox
                        placeholder="Search member or enter family name..."
                        value={entry.name}
                        members={members}
                        onChange={(name, uid) => handleUpdateGroupRow(idx, { name, memberUid: uid || '' })}
                      />
                    </div>
                    <div className="w-full sm:w-36 flex items-center gap-1.5 shrink-0">
                      <CurrencyInput
                        placeholder="0.00"
                        value={entry.amount}
                        onChange={(_formatted, numeric) => handleUpdateGroupRow(idx, { amount: String(numeric) })}
                      />
                      {groupEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGroupRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                          title="Remove row"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Row Button & Total Summary */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddGroupRow}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer border border-indigo-200"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Another Member (Magdagdag)</span>
                </button>

                <div className="flex items-center justify-between sm:justify-end gap-3 px-3 py-2 bg-slate-100/90 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase">Total Group Payment:</span>
                  <span className="text-sm font-black text-indigo-700">
                    ₱{groupTotalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Group Mode: Date */}
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Contribution Date *</label>
                <input
                  type="date"
                  required
                  value={contributedDate}
                  onChange={(e) => setContributedDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <CustomSelect
                label="Payment Method"
                required
                value={paymentMethod}
                onChange={(e) => {
                  setPaymentMethod(e.target.value as ContributionPaymentMethod)
                  setReferenceNumber('')
                }}
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'gcash', label: 'GCash' },
                  { value: 'bank_transfer', label: 'Bank Transfer' },
                  { value: 'other', label: 'Other' }
                ]}
              />
            </div>

            {/* Conditional Reference Number */}
            {(paymentMethod === 'gcash' || paymentMethod === 'bank_transfer') && (
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Reference Number (Numbers Only) *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 100293847561"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            )}
          </div>

          {/* Held By Field */}
          <div>
            <MemberCombobox
              label="Held By (Hawak ni / Inabot kay)"
              placeholder="Search masterlist officer or enter custom name..."
              value={collectedByName}
              members={members}
              officersOnly
              onChange={(name) => setCollectedByName(name)}
              helperText="Defaults to your name. Update if money was handed to or held by another officer or external person."
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[10px] font-extrabold uppercase text-slate-500 mb-1">Notes / Remarks</label>
            <textarea
              placeholder="Add optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-blue-500 h-16 resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 sticky bottom-0 bg-white">
            <Button
              type="button"
              variant="outline"
              size="dense"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="dense"
              loading={submitting}
            >
              {contributionToEdit ? (entryMode === 'group' && groupEntries.filter(e => e.name.trim()).length > 1 ? `Update & Save Group (${groupEntries.filter(e => e.name.trim()).length} Members)` : 'Update Contribution') : (entryMode === 'group' ? `Save Group (${groupEntries.filter(e => e.name.trim()).length} Members)` : 'Save Contribution')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
