import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/Modal'
import { DynamicSignatureConfig } from '@/components/signatures/DynamicSignatureConfig'
import type { SignatureConfig, SignatoryItem } from '@/types/signature'
import { DEFAULT_SIGNATURE_PRESETS } from '@/types/signature'
import type { EventIncome, EventExpense, EventFinanceCategory } from '@/types/eventFinance'
import type { FinanceFundRequest, LiquidationBudgetSource, LiquidationExpenseItem } from '@/types/finance'
import type { Member } from '@/types/member'
import { downloadLiquidationReportPdf, getLiquidationReportPdfBlobUrl } from '@/utils/liquidationReportPdf'
import { settingsService } from '@/services/settingsService'
import { memberService } from '@/services/memberService'
import { eventFinanceService } from '@/services/eventFinanceService'
import { useAuth } from '@/features/authentication/AuthContext'

export type BudgetGroupingMode = 
  | 'summarized'
  | 'by_category'
  | 'members_vs_non_members'
  | 'itemized_members_first'
  | 'itemized_original'
  | 'single_total'

const normalizeName = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/\b(bro|sis|brother|sister|fr|father|rev|reverend|dr|mr|ms|mrs)\b\.?/gi, '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const isMemberMatch = (name: string, membersList: Member[]): boolean => {
  if (!name || membersList.length === 0) return false
  const cleanInput = normalizeName(name)
  if (!cleanInput) return false

  return membersList.some(m => {
    const first = normalizeName(m.firstName || '')
    const last = normalizeName(m.lastName || '')
    const full = `${first} ${last}`.trim()
    const reverseFull = `${last} ${first}`.trim()

    if (cleanInput === full || cleanInput === reverseFull) return true
    if (first && last && cleanInput.includes(first) && cleanInput.includes(last)) return true
    if (m.nickname && cleanInput === normalizeName(m.nickname)) return true
    return false
  })
}

const generateBudgetSourcesFromIncomes = (
  incomesList: EventIncome[],
  mode: BudgetGroupingMode,
  membersList: Member[],
  categoriesList: EventFinanceCategory[],
  eventName: string
): LiquidationBudgetSource[] => {
  const validIncomes = incomesList.filter(i => !i.isArchived)
  if (validIncomes.length === 0) {
    return [
      {
        id: 'b-default',
        description: `EVENT BUDGET / ALLOCATION FOR ${eventName.toUpperCase()}`,
        amount: 0
      }
    ]
  }

  if (mode === 'single_total') {
    const total = validIncomes.reduce((sum, inc) => sum + (Number(inc.amount) || 0), 0)
    return [
      {
        id: 'b-single-total',
        description: `TOTAL EVENT BUDGET & CONTRIBUTIONS COLLECTED FOR ${eventName.toUpperCase()}`,
        amount: total
      }
    ]
  }

  if (mode === 'summarized') {
    const categoryMap: Record<string, number> = {}

    validIncomes.forEach(inc => {
      let catName = 'OTHER EVENT INCOME'
      if (inc.categoryId) {
        const cat = categoriesList.find(c => c.id === inc.categoryId)
        if (cat?.name) catName = cat.name.toUpperCase()
      } else if (inc.description && inc.description.startsWith('Linked contribution:')) {
        const purposeMatch = inc.description.replace('Linked contribution:', '').split('.')[0].trim()
        if (purposeMatch) catName = purposeMatch.toUpperCase()
      }

      categoryMap[catName] = (categoryMap[catName] || 0) + (Number(inc.amount) || 0)
    })

    return Object.entries(categoryMap).map(([catName, total], idx) => ({
      id: `b-sum-${idx}`,
      description: catName,
      amount: total
    }))
  }

  if (mode === 'by_category') {
    const categoryMap: Record<string, { count: number; total: number }> = {}

    validIncomes.forEach(inc => {
      let catName = 'OTHER INCOME / CONTRIBUTIONS'
      if (inc.categoryId) {
        const cat = categoriesList.find(c => c.id === inc.categoryId)
        if (cat?.name) catName = cat.name.toUpperCase()
      } else if (inc.description && inc.description.startsWith('Linked contribution:')) {
        const purposeMatch = inc.description.replace('Linked contribution:', '').split('.')[0].trim()
        if (purposeMatch) catName = purposeMatch.toUpperCase()
      }

      if (!categoryMap[catName]) {
        categoryMap[catName] = { count: 0, total: 0 }
      }
      categoryMap[catName].count += 1
      categoryMap[catName].total += Number(inc.amount) || 0
    })

    return Object.entries(categoryMap).map(([catName, data], idx) => {
      const countSuffix = data.count > 1 ? ` (${data.count} PAX / ENTRIES)` : ''
      return {
        id: `b-cat-${idx}`,
        description: `${catName}${countSuffix}`,
        amount: data.total
      }
    })
  }

  if (mode === 'members_vs_non_members') {
    const memberIncomes: EventIncome[] = []
    const nonMemberIncomes: EventIncome[] = []

    validIncomes.forEach(inc => {
      const rec = (inc.receivedFrom || '').trim()
      if (isMemberMatch(rec, membersList)) {
        memberIncomes.push(inc)
      } else {
        nonMemberIncomes.push(inc)
      }
    })

    const rows: LiquidationBudgetSource[] = []
    if (memberIncomes.length > 0) {
      const memberTotal = memberIncomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      rows.push({
        id: 'b-members-group',
        description: `MEMBER CONTRIBUTIONS & REGISTRATIONS (${memberIncomes.length} MEMBERS)`,
        amount: memberTotal
      })
    }
    if (nonMemberIncomes.length > 0) {
      const nonMemberTotal = nonMemberIncomes.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
      rows.push({
        id: 'b-non-members-group',
        description: `NON-MEMBER / GUEST / DONOR CONTRIBUTIONS (${nonMemberIncomes.length} GUESTS / DONORS)`,
        amount: nonMemberTotal
      })
    }
    return rows.length > 0 ? rows : [
      {
        id: 'b-default',
        description: `EVENT BUDGET / ALLOCATION FOR ${eventName.toUpperCase()}`,
        amount: 0
      }
    ]
  }

  if (mode === 'itemized_members_first') {
    const memberItems: { inc: EventIncome; name: string }[] = []
    const nonMemberItems: { inc: EventIncome; name: string }[] = []

    validIncomes.forEach(inc => {
      const rawName = (inc.receivedFrom || inc.description || 'EVENT INCOME').trim()
      if (isMemberMatch(rawName, membersList)) {
        memberItems.push({ inc, name: rawName })
      } else {
        nonMemberItems.push({ inc, name: rawName })
      }
    })

    memberItems.sort((a, b) => a.name.localeCompare(b.name))
    nonMemberItems.sort((a, b) => a.name.localeCompare(b.name))

    const mappedMembers: LiquidationBudgetSource[] = memberItems.map((item, idx) => ({
      id: `b-mem-${idx}-${item.inc.id || idx}`,
      description: `[MEMBER] ${item.name.toUpperCase()}`,
      amount: item.inc.amount
    }))

    const mappedNonMembers: LiquidationBudgetSource[] = nonMemberItems.map((item, idx) => ({
      id: `b-nonmem-${idx}-${item.inc.id || idx}`,
      description: `${item.name.toUpperCase()} (GUEST / SPONSOR)`,
      amount: item.inc.amount
    }))

    return [...mappedMembers, ...mappedNonMembers]
  }

  // mode === 'itemized_original' (or default)
  return validIncomes.map((inc, idx) => {
    const recFrom = (inc.receivedFrom || '').trim()
    const rawDesc = (inc.description || '').trim()
    const cleanDesc = (recFrom || rawDesc || 'EVENT INCOME').toUpperCase()

    return {
      id: inc.id || `b-${idx}`,
      description: cleanDesc,
      amount: inc.amount
    }
  })
}

interface Props {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventName: string
  incomes: EventIncome[]
  expenses: EventExpense[]
}

export const EventLiquidationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  eventId,
  eventName,
  incomes,
  expenses
}) => {
  const { user, profile } = useAuth()

  // Header & Letter Fields
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10))
  const [toName, setToName] = useState('Rev. Fr. ILDEFONSO DE GUZMAN JR.')
  const [toTitle, setToTitle] = useState('Parish Priest')
  const [fromName, setFromName] = useState(`MINISTRY OF ALTAR SERVERS - ${eventName}`)
  const [subject, setSubject] = useState(`Liquidation Report - ${eventName}`)
  const [remarks, setRemarks] = useState('')

  // Members & Categories metadata
  const [membersList, setMembersList] = useState<Member[]>([])
  const [categoriesList, setCategoriesList] = useState<EventFinanceCategory[]>([])
  const [budgetGroupMode, setBudgetGroupMode] = useState<BudgetGroupingMode>('by_category')

  // Tables
  const [budgetSources, setBudgetSources] = useState<LiquidationBudgetSource[]>([])
  const [liquidationExpenses, setLiquidationExpenses] = useState<LiquidationExpenseItem[]>([])

  // Layout & Spacing Controls
  const [tablePadding, setTablePadding] = useState<number>(1.8)
  const [sectionSpacing, setSectionSpacing] = useState<number>(6.0)
  const [signatureTopMargin, setSignatureTopMargin] = useState<number>(10.0)

  // Signatures & Export
  const [signatureConfig, setSignatureConfig] = useState<SignatureConfig>({
    enabled: true,
    signatories: []
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [activeViewTab, setActiveViewTab] = useState<'details' | 'signatories' | 'preview'>('details')

  // Live PDF Preview
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Initialize data once when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10)
      setDocDate(today)
      setToName('Rev. Fr. ILDEFONSO DE GUZMAN JR.')
      setToTitle('Parish Priest')
      setFromName(`MINISTRY OF ALTAR SERVERS - ${eventName}`)
      setSubject(`Liquidation Report - ${eventName}`)
      setRemarks(`Official liquidation report for ${eventName}`)
      setErrorMsg(null)
      setTablePadding(1.8)
      setSectionSpacing(6.0)
      setSignatureTopMargin(10.0)

      const validIncomes = incomes.filter(i => !i.isArchived)
      const defaultMode: BudgetGroupingMode = validIncomes.length > 5 ? 'by_category' : 'itemized_original'
      setBudgetGroupMode(defaultMode)

      // Load members, categories, and signature presets
      const loadModalData = async () => {
        let loadedMembers: Member[] = []
        let loadedCategories: EventFinanceCategory[] = []

        try {
          const [mems, cats] = await Promise.all([
            memberService.getMembers(false),
            eventFinanceService.getEventFinanceCategories(eventId, 'income')
          ])
          loadedMembers = mems || []
          loadedCategories = cats || []
          setMembersList(loadedMembers)
          setCategoriesList(loadedCategories)
        } catch (err) {
          console.warn('Failed to load members or categories for liquidation modal:', err)
        }

        // Initialize budget sources with loaded metadata
        const initialBudgets = generateBudgetSourcesFromIncomes(
          incomes,
          defaultMode,
          loadedMembers,
          loadedCategories,
          eventName
        )
        setBudgetSources(initialBudgets)
      }

      loadModalData()

      // 2. Map valid Expenses to Liquidated Expenditures
      const validExpenses = expenses.filter(e => !e.isArchived)
      const mappedExpenses: LiquidationExpenseItem[] = validExpenses.length > 0
        ? validExpenses.map((exp, idx) => ({
            id: exp.id || `e-${idx}`,
            orNumber: exp.orNumber || 'NO O.R',
            description: exp.spentOn
              ? (exp.description ? `${exp.spentOn} - ${exp.description}` : exp.spentOn)
              : (exp.description || 'Event Expenditure'),
            amount: exp.amount
          }))
        : [
            {
              id: 'e-default',
              orNumber: 'NO O.R',
              description: 'Expense item',
              amount: 0
            }
          ]
      setLiquidationExpenses(mappedExpenses)

      // 3. Load presets from settingsService or default
      const loadSignatories = async () => {
        try {
          const presets = await settingsService.getSignaturePresets()
          const presetsList = presets && presets.length > 0 ? presets : DEFAULT_SIGNATURE_PRESETS
          const matched = presetsList.find(p => 
            p.name.toLowerCase().includes('liquidation') || 
            p.name.toLowerCase().includes('treasury')
          ) || presetsList[0]

          if (matched && matched.signatories && matched.signatories.length > 0) {
            setSignatureConfig({
              enabled: true,
              signatories: matched.signatories.map(s => ({
                ...s,
                id: `sig-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
              }))
            })
            return
          }
        } catch (err) {
          console.warn('Failed to load presets for event liquidation:', err)
        }

        const defaultSignatories: SignatoryItem[] = [
          {
            id: 'sig-evt-1',
            label: 'Prepared by:',
            name: 'Bro. CHRYSLER DAVID',
            title: 'Treasurer, Ministry of Altar Servers',
            organization: 'Sacred Heart of Jesus Parish - MBS',
            column: 1
          },
          {
            id: 'sig-evt-2',
            label: 'Noted by:',
            name: 'Bro. KYLE VINCENT MADRIAGA',
            title: 'Coordinator, Ministry of Altar Servers',
            organization: 'Sacred Heart of Jesus Parish - MBS',
            column: 2
          },
          {
            id: 'sig-evt-3',
            label: 'Approved by:',
            name: 'Rev. Fr. ILDEFONSO DE GUZMAN JR.',
            title: 'Parish Priest',
            organization: 'Sacred Heart of Jesus Parish - MBS',
            column: 2
          }
        ]

        setSignatureConfig({
          enabled: true,
          signatories: defaultSignatories
        })
      }

      loadSignatories()
    }
  }, [isOpen])

  // Total Calculations
  const totalBudget = useMemo(() => {
    return budgetSources.reduce((sum, b) => {
      const val = typeof b.amount === 'string' ? Number(String(b.amount).replace(/,/g, '')) : Number(b.amount || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [budgetSources])

  const totalSpent = useMemo(() => {
    return liquidationExpenses.reduce((sum, e) => {
      const val = typeof e.amount === 'string' ? Number(String(e.amount).replace(/,/g, '')) : Number(e.amount || 0)
      return sum + (isNaN(val) ? 0 : val)
    }, 0)
  }, [liquidationExpenses])

  const netBalance = totalBudget - totalSpent

  // Budget Row Handlers
  const handleSelectBudgetGrouping = (mode: BudgetGroupingMode) => {
    setBudgetGroupMode(mode)
    const newBudgets = generateBudgetSourcesFromIncomes(
      incomes,
      mode,
      membersList,
      categoriesList,
      eventName
    )
    setBudgetSources(newBudgets)
  }

  const handleAddBudgetSource = () => {
    setBudgetSources(prev => [
      ...prev,
      {
        id: `budget-${Date.now()}`,
        description: '',
        amount: 0
      }
    ])
  }

  const handleUpdateBudgetSource = (index: number, field: keyof LiquidationBudgetSource, value: any) => {
    setBudgetSources(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleRemoveBudgetSource = (index: number) => {
    setBudgetSources(prev => prev.filter((_, i) => i !== index))
  }

  // Expense Row Handlers
  const handleAddExpenseItem = () => {
    setLiquidationExpenses(prev => [
      ...prev,
      {
        id: `exp-${Date.now()}`,
        orNumber: 'NO O.R',
        description: '',
        amount: 0
      }
    ])
  }

  const handleUpdateExpenseItem = (index: number, field: keyof LiquidationExpenseItem, value: any) => {
    setLiquidationExpenses(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })
  }

  const handleRemoveExpenseItem = (index: number) => {
    setLiquidationExpenses(prev => prev.filter((_, i) => i !== index))
  }

  // Build Request Object Helper
  const buildRequestObject = (): FinanceFundRequest => {
    const parsedBudgets: LiquidationBudgetSource[] = budgetSources
      .map(b => ({
        id: b.id,
        description: b.description.trim() || 'Budget Source',
        amount: typeof b.amount === 'string' ? Number(String(b.amount).replace(/,/g, '')) || 0 : Number(b.amount) || 0
      }))
      .filter(b => b.description || b.amount > 0)

    const parsedExpenses: LiquidationExpenseItem[] = liquidationExpenses
      .map(e => ({
        id: e.id,
        orNumber: (e.orNumber || '').trim() || 'NO O.R',
        description: e.description.trim() || 'Expenditure',
        amount: typeof e.amount === 'string' ? Number(String(e.amount).replace(/,/g, '')) || 0 : Number(e.amount) || 0
      }))
      .filter(e => e.description || e.amount > 0)

    return {
      id: eventId,
      referenceNumber: `EVT-${eventId.slice(0, 6).toUpperCase()}`,
      title: eventName,
      purpose: `Official Liquidation of Event Expenditures for ${eventName}`,
      description: remarks.trim() || `Official Liquidation Report for event: ${eventName}`,
      requestedAmount: totalBudget,
      releasedAmount: totalBudget,
      totalSpent: totalSpent,
      returnedAmount: netBalance > 0 ? netBalance : 0,
      status: 'liquidated',
      periodId: docDate.slice(0, 7),
      dateNeeded: docDate,
      requestedByUid: user?.uid || 'event-head',
      requestedByName: profile?.displayName || 'Event Head',
      createdByUid: user?.uid || 'event-head',
      createdByName: profile?.displayName || 'Event Head',
      liquidatedByName: profile?.displayName || 'Event Head',
      approvedByName: 'Bro. KYLE VINCENT MADRIAGA',
      liquidationTo: toName,
      liquidationFrom: fromName,
      liquidationDate: docDate,
      liquidationRemarks: remarks.trim(),
      budgetSources: parsedBudgets,
      liquidationExpenses: parsedExpenses,
      isArchived: false,
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    }
  }

  // Update Live PDF Preview when Preview Tab is Active
  useEffect(() => {
    let active = true
    if (activeViewTab === 'preview' && isOpen) {
      setLoadingPreview(true)
      const req = buildRequestObject()
      getLiquidationReportPdfBlobUrl(req, {
        liquidationTo: toName,
        liquidationToTitle: toTitle,
        liquidationFrom: fromName,
        liquidationSubject: subject,
        liquidationDate: docDate,
        signatureConfig,
        tablePadding,
        sectionSpacing,
        signatureTopMargin
      })
        .then(url => {
          if (active) {
            setPreviewPdfUrl(url)
            setLoadingPreview(false)
          }
        })
        .catch(err => {
          console.error('Preview error:', err)
          if (active) setLoadingPreview(false)
        })
    }
    return () => {
      active = false
    }
  }, [activeViewTab, isOpen, budgetSources, liquidationExpenses, signatureConfig, toName, toTitle, fromName, subject, docDate, remarks, tablePadding, sectionSpacing, signatureTopMargin])

  // PDF Export Generation
  const handleGeneratePdf = async () => {
    setIsGenerating(true)
    setErrorMsg(null)

    try {
      const virtualRequest = buildRequestObject()

      await downloadLiquidationReportPdf(virtualRequest, {
        liquidationTo: toName,
        liquidationToTitle: toTitle,
        liquidationFrom: fromName,
        liquidationSubject: subject,
        liquidationDate: docDate,
        signatureConfig,
        tablePadding,
        sectionSpacing,
        signatureTopMargin
      })
    } catch (err: any) {
      console.error('Failed to generate liquidation PDF:', err)
      setErrorMsg(err.message || 'Failed to generate liquidation PDF report.')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Event Financial Liquidation Report"
      subtitle={`Liquidation breakdown, disbursements and live preview for ${eventName}`}
      badge="Event Liquidation"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      }
      maxWidth="3xl"
    >
      <div className="space-y-5 p-1">
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold animate-fade-in">
            {errorMsg}
          </div>
        )}

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveViewTab('details')}
            className={`flex-1 py-2 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeViewTab === 'details'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>1. Breakdown</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('signatories')}
            className={`flex-1 py-2 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeViewTab === 'signatories'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>2. Signatories ({signatureConfig.signatories.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveViewTab('preview')}
            className={`flex-1 py-2 px-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeViewTab === 'preview'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span>3. Live PDF Preview & Spacing</span>
          </button>
        </div>

        {activeViewTab === 'details' ? (
          <div className="space-y-4">
            {/* Header / Recipient Fields */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Header Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">To (Recipient):</label>
                  <input
                    type="text"
                    value={toName}
                    onChange={e => setToName(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="Rev. Fr. ILDEFONSO DE GUZMAN JR."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Recipient Title:</label>
                  <input
                    type="text"
                    value={toTitle}
                    onChange={e => setToTitle(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="Parish Priest"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">From (Sender / Event):</label>
                  <input
                    type="text"
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder={`MINISTRY OF ALTAR SERVERS - ${eventName}`}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Liquidation Date:</label>
                  <input
                    type="date"
                    value={docDate}
                    onChange={e => setDocDate(e.target.value)}
                    className="w-full text-xs font-bold p-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 1: BUDGET SOURCES */}
            <div className="p-4 bg-emerald-50/40 border border-emerald-200/80 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    I. Budget Sources / Incomes Received
                  </h4>
                  <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                    Funding sources, solicitations, registration, or grants
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBudgetSource}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer self-start sm:self-auto"
                >
                  + Add Source
                </button>
              </div>

              {/* Quick Grouping & Formatting Toolbar */}
              <div className="p-2 bg-emerald-100/60 rounded-xl border border-emerald-200/60 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider">
                    Grouping & Sorting Presets:
                  </span>
                  <span className="text-[10px] text-emerald-700 italic">
                    (Click to auto-format rows; fully editable below)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('summarized')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'summarized'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Clean high-level category summary without pax counts"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10M4 18h7" />
                    </svg>
                    <span>Summarize</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('by_category')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'by_category'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Group all contributions by category/source with pax counts"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span>By Category</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('members_vs_non_members')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'members_vs_non_members'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Consolidated into Member total vs Non-Member / Guest total"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Members vs Non-Members</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('itemized_members_first')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'itemized_members_first'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Itemize all individual names with Members listed first (A-Z), followed by Non-Members (A-Z)"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span>Members First</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('single_total')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'single_total'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Single consolidated total row for entire event budget"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Total Only</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectBudgetGrouping('itemized_original')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      budgetGroupMode === 'itemized_original'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200/60'
                    }`}
                    title="Original raw itemized list as recorded"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Itemized (All)</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {budgetSources.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-emerald-100 shadow-2xs">
                    <input
                      type="text"
                      placeholder="Source description (e.g. Parish Grant, Sponsorship)"
                      value={item.description}
                      onChange={e => handleUpdateBudgetSource(idx, 'description', e.target.value)}
                      className="flex-1 text-xs font-bold p-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="relative w-32 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={e => handleUpdateBudgetSource(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs font-bold pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBudgetSource(idx)}
                      disabled={budgetSources.length === 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg cursor-pointer"
                      title="Remove row"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-emerald-200/60 text-xs font-black text-emerald-950">
                <span>Total Budget Received ({budgetSources.length} row{budgetSources.length === 1 ? '' : 's'}):</span>
                <span>₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* SECTION 2: LIQUIDATED EXPENDITURES */}
            <div className="p-4 bg-rose-50/40 border border-rose-200/80 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                    II. Liquidated Actual Expenditures
                  </h4>
                  <p className="text-[10px] text-rose-700 font-semibold mt-0.5">
                    Official list of disbursements with corresponding O.R. numbers
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddExpenseItem}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer"
                >
                  + Add Expense
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {liquidationExpenses.map((item, idx) => (
                  <div key={item.id || idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-rose-100 shadow-2xs">
                    <input
                      type="text"
                      placeholder="OR # / NO O.R"
                      value={item.orNumber}
                      onChange={e => handleUpdateExpenseItem(idx, 'orNumber', e.target.value)}
                      className="w-28 text-[11px] font-bold p-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 uppercase shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="Particulars / Item description"
                      value={item.description}
                      onChange={e => handleUpdateExpenseItem(idx, 'description', e.target.value)}
                      className="flex-1 text-xs font-bold p-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500"
                    />
                    <div className="relative w-28 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₱</span>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={item.amount || ''}
                        onChange={e => handleUpdateExpenseItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-full text-xs font-bold pl-6 pr-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500 text-right"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveExpenseItem(idx)}
                      disabled={liquidationExpenses.length === 1}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded-lg cursor-pointer"
                      title="Remove row"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-rose-200/60 text-xs font-black text-rose-950">
                <span>Total Actual Disbursements:</span>
                <span>₱{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* SECTION 3: LIQUIDATION SUMMARY SUMMARY CARD */}
            <div className={`p-4 rounded-2xl border ${
              netBalance > 0
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : netBalance < 0
                ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">
                    Net Balance / Result
                  </span>
                  <div className="text-xl font-black mt-0.5">
                    ₱{Math.abs(netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border shadow-2xs ${
                    netBalance > 0
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : netBalance < 0
                      ? 'bg-rose-100 text-rose-900 border-rose-300'
                      : 'bg-slate-100 text-slate-800 border-slate-300'
                  }`}>
                    {netBalance > 0 ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Excess (Returned to Fund)</span>
                      </>
                    ) : netBalance < 0 ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-rose-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Deficit (Reimbursement Due)</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                        </svg>
                        <span>Exact Balanced</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Remarks input */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                Liquidation Remarks / Notes (Optional):
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Add any additional context, summary of unliquidated items, or explanations..."
                className="w-full text-xs font-bold p-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        ) : activeViewTab === 'signatories' ? (
          <div className="space-y-4">
            <DynamicSignatureConfig
              value={signatureConfig}
              onChange={setSignatureConfig}
              defaultPresetName="Liquidation Report"
            />
          </div>
        ) : (
          /* PREVIEW & SPACING CONTROLS TAB */
          <div className="space-y-4">
            {/* Quick Spacing Controls Bar */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span>Page Spacing & Density Controls</span>
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Adjust line heights and section margins to perfectly fit 1 whole page.
                  </p>
                </div>

                {/* Preset density buttons */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => {
                      setTablePadding(1.2)
                      setSectionSpacing(3.5)
                      setSignatureTopMargin(5.0)
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Compact
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTablePadding(1.8)
                      setSectionSpacing(6.0)
                      setSignatureTopMargin(10.0)
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 transition cursor-pointer"
                  >
                    Standard
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTablePadding(2.4)
                      setSectionSpacing(9.0)
                      setSignatureTopMargin(16.0)
                    }}
                    className="px-2.5 py-1 text-[10px] font-bold rounded-lg text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  >
                    Spacious
                  </button>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
                {/* 1. Table Cell Padding */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px] text-slate-600">
                    <span>Table Row Height:</span>
                    <span className="text-blue-700 font-mono">{tablePadding.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="3.2"
                    step="0.2"
                    value={tablePadding}
                    onChange={e => setTablePadding(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Adjusts table rows padding</span>
                </div>

                {/* 2. Section Gap */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px] text-slate-600">
                    <span>Section Gap:</span>
                    <span className="text-blue-700 font-mono">{sectionSpacing.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="2.0"
                    max="14.0"
                    step="0.5"
                    value={sectionSpacing}
                    onChange={e => setSectionSpacing(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Spacing between tables</span>
                </div>

                {/* 3. Signature Top Space */}
                <div>
                  <div className="flex justify-between items-center mb-1 text-[11px] text-slate-600">
                    <span>Signature Space:</span>
                    <span className="text-blue-700 font-mono">{signatureTopMargin.toFixed(1)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="3.0"
                    max="30.0"
                    step="1.0"
                    value={signatureTopMargin}
                    onChange={e => setSignatureTopMargin(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[9px] text-slate-400 block mt-0.5">Gap before signatures</span>
                </div>
              </div>
            </div>

            {/* Embedded Live PDF Viewer */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 shadow-inner h-[520px] relative">
              {loadingPreview ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs z-10 gap-2">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold text-slate-600">Rendering live preview...</span>
                </div>
              ) : previewPdfUrl ? (
                <iframe
                  src={`${previewPdfUrl}#toolbar=0&navpanes=0`}
                  title="PDF Live Preview"
                  className="w-full h-full border-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs font-bold">
                  <span>No preview available</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer Actions */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={isGenerating || (budgetSources.length === 0 && liquidationExpenses.length === 0)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>{isGenerating ? 'Generating PDF...' : 'Download Official Liquidation PDF'}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}
