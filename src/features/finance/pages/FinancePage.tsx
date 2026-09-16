import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { Navigate } from 'react-router-dom'
import { Loading } from '@/components/Loading'
import { PasswordConfirmModal } from '@/components/Dialog'
import { CustomSelect, BulkProgressBar } from '@/components'
import { authService } from '@/services/authService'

// Import types
import type { 
  FinanceIncome, 
  DirectExpense, 
  FinanceCategory, 
  FinanceFundRequest, 
  FundRequestSource,
  FinancePeriod, 
  LedgerEntry,
  FundRequisitionItem,
  LiquidationBudgetSource,
  LiquidationExpenseItem
} from '@/types/finance'

// Import services
import { categoryService } from '@/services/finance/categoryService'
import { incomeService } from '@/services/finance/incomeService'
import { expenseService } from '@/services/finance/expenseService'
import { fundRequestService } from '@/services/finance/fundRequestService'
import { ledgerService } from '@/services/finance/ledgerService'
import { financePeriodService } from '@/services/finance/financePeriodService'
import { reportService } from '@/services/finance/reportService'

// Import Finance Engine & Report PDF Generators
import { financeEngine } from '@/utils/financeEngine'
import { FinanceExportModal } from '@/features/finance/components/FinanceExportModal'
import { FundRequisitionExportModal } from '@/features/finance/components/FundRequisitionExportModal'
import { LiquidationExportModal } from '@/features/finance/components/LiquidationExportModal'
import { DirectLiquidationModal } from '@/features/finance/components/DirectLiquidationModal'
import { MemberCombobox } from '@/components/MemberCombobox'
import { useToast } from '@/context/ToastContext'

export const FinancePage: React.FC = () => {
  const { hasModuleAccess, canAction, profile, isAdmin } = useAuth()
  const { toast } = useToast()

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'income' | 'expenses' | 'requests' | 'categories' | 'ledger' | 'reports' | 'closing'>('dashboard')

  // Data states
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [incomes, setIncomes] = useState<FinanceIncome[]>([])
  const [expenses, setExpenses] = useState<DirectExpense[]>([])
  const [requests, setRequests] = useState<FinanceFundRequest[]>([])
  const [periods, setPeriods] = useState<FinancePeriod[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])

  // UI States
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  const setErrorMsg = (msg: string | null) => {
    if (msg) toast.error('Finance Notice', msg)
  }

  const setSuccessMsg = (msg: string | null) => {
    if (msg) toast.success('Operation Complete', msg)
  }

  // Custom Alert / Confirm Dialog state
  const [dialog, setDialog] = useState<{
    title: string
    message: string
    onConfirm: () => void
    isConfirm?: boolean
  } | null>(null)

  // Selected request for history modal
  const [historyRequest, setHistoryRequest] = useState<FinanceFundRequest | null>(null)

  // Modal open states
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false)
  const [isLiquidationModalOpen, setIsLiquidationModalOpen] = useState(false)
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false)

  // Document PDF Export Modals
  const [isRequisitionExportOpen, setIsRequisitionExportOpen] = useState(false)
  const [requisitionExportRequest, setRequisitionExportRequest] = useState<FinanceFundRequest | null>(null)
  const [isLiquidationExportOpen, setIsLiquidationExportOpen] = useState(false)
  const [liquidationExportRequest, setLiquidationExportRequest] = useState<FinanceFundRequest | null>(null)

  // Review Liquidation Modal state
  const [isReviewLiquidationModalOpen, setIsReviewLiquidationModalOpen] = useState(false)
  const [reviewLiquidationRequest, setReviewLiquidationRequest] = useState<FinanceFundRequest | null>(null)
  const [reviewRemarks, setReviewRemarks] = useState('')
  const [reviewRevisionReason, setReviewRevisionReason] = useState('')
  const [showRevisionSection, setShowRevisionSection] = useState(false)

  // Reopen Review Modal state
  const [reopenModalRequest, setReopenModalRequest] = useState<FinanceFundRequest | null>(null)
  const [reopenReason, setReopenReason] = useState('')

  // Cancel & Void Modal state
  const [cancelModalRequest, setCancelModalRequest] = useState<FinanceFundRequest | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [voidModalRequest, setVoidModalRequest] = useState<FinanceFundRequest | null>(null)
  const [voidReason, setVoidReason] = useState('')

  // Edit states
  const [editIncomeItem, setEditIncomeItem] = useState<FinanceIncome | null>(null)
  const [editExpenseItem, setEditExpenseItem] = useState<DirectExpense | null>(null)
  const [editCategoryItem, setEditCategoryItem] = useState<FinanceCategory | null>(null)

  // Show archives toggle
  const [showArchived, setShowArchived] = useState(false)

  // Multi-selection state for Bulk Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Reset selectedIds when switching tabs or toggling archives
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab, showArchived])

  // Password confirmation for permanent delete (single or bulk)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    id?: string
    ids?: string[]
    name?: string
    categories?: { id: string, name: string }[]
    type: 'income' | 'expense' | 'category' | 'request'
  }>({ isOpen: false, type: 'income' })

  // Selection states for workflows
  const [selectedRequest, setSelectedRequest] = useState<FinanceFundRequest | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [showRejectionInput, setShowRejectionInput] = useState<string | null>(null)

  // Helper to format Date local to user browser timezone instead of shifted UTC ISO strings
  const getLocalYYYYMMDD = (d: Date = new Date()): string => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const r = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${r}`
  }

  // Form states - Income (Formatted Text for comma support)
  const [incAmount, setIncAmount] = useState('')
  const [incSource, setIncSource] = useState('')
  const [incCategoryId, setIncCategoryId] = useState('')
  const [incReceivedFrom, setIncReceivedFrom] = useState('')
  const [incDate, setIncDate] = useState(getLocalYYYYMMDD())
  const [incDesc, setIncDesc] = useState('')

  // Form states - Direct Expense (Formatted Text)
  const [expAmount, setExpAmount] = useState('')
  const [expCategoryId, setExpCategoryId] = useState('')
  const [expSpentByName, setExpSpentByName] = useState(profile?.displayName || '')
  const [expDate, setExpDate] = useState(getLocalYYYYMMDD())
  const [expDesc, setExpDesc] = useState('')

  // Form states - Category
  const [catName, setCatName] = useState('')
  const catIcon = 'clipboard'
  const [catColor, setCatColor] = useState('blue')

  // Form states - Fund Request (Formatted Text & Dynamic Items)
  const [reqFundSource, setReqFundSource] = useState<FundRequestSource>('main_funds')
  const [fundSourceFilter, setFundSourceFilter] = useState<'all' | 'main_funds' | 'parish' | 'outside'>('all')
  const [reqTitle, setReqTitle] = useState('')
  const [reqPurpose, setReqPurpose] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [reqDateNeeded, setReqDateNeeded] = useState(getLocalYYYYMMDD())
  const [reqDesc, setReqDesc] = useState('')
  const [reqFromMinistry, setReqFromMinistry] = useState('The MINISTRY OF ALTAR SERVERS')
  const [reqVenue, setReqVenue] = useState('N/A')
  const [reqParticipants, setReqParticipants] = useState('N/A')
  const [reqAssembly, setReqAssembly] = useState('N/A')
  const [reqExpectedExpenses, setReqExpectedExpenses] = useState<FundRequisitionItem[]>([
    { id: 'item-1', intendedUse: '', unitPrice: '', quantity: '', amount: 0 }
  ])

  // Form states - Release (Formatted Text & Parish Office Tracking)
  const [relToName, setRelToName] = useState('')
  const [relAmount, setRelAmount] = useState('')
  const [relDate, setRelDate] = useState(getLocalYYYYMMDD())
  const [relRemarks, setRelRemarks] = useState('')
  const [relParishOfficeDisbursedBy, setRelParishOfficeDisbursedBy] = useState('Parish Office / Secretary')
  const [relParishOfficeReceivedBy, setRelParishOfficeReceivedBy] = useState('')
  const [relParishOfficeRemarks, setRelParishOfficeRemarks] = useState('')
  const [isOutsideLiquidationModalOpen, setIsOutsideLiquidationModalOpen] = useState(false)

  // Form states - Liquidation (Dynamic Tables & Summary)
  const [liqTo, setLiqTo] = useState('Rev. Fr. ILDEFONSO DE GUZMAN JR., Parish Priest')
  const [liqFrom, setLiqFrom] = useState('MINISTRY OF ALTAR SERVERS')
  const [liqDate, setLiqDate] = useState(getLocalYYYYMMDD())
  const [liqBudgetSources, setLiqBudgetSources] = useState<LiquidationBudgetSource[]>([])
  const [liqExpenses, setLiqExpenses] = useState<LiquidationExpenseItem[]>([])
  const [liqRemarks, setLiqRemarks] = useState('')

  // Filter States - General / Reports (Start and End of current month local time)
  const [reportStartDate, setReportStartDate] = useState(getLocalYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [reportEndDate, setReportEndDate] = useState(getLocalYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)))
  const [reportData, setReportData] = useState<any>(null)

  // Action Menu Dropdown state for requests table
  const [actionMenuReqId, setActionMenuReqId] = useState<string | null>(null)

  // Edit Fund Request Modal states
  const [isEditRequestModalOpen, setIsEditRequestModalOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<FinanceFundRequest | null>(null)
  const [editReqFundSource, setEditReqFundSource] = useState<FundRequestSource>('main_funds')
  const [editReqTitle, setEditReqTitle] = useState('')
  const [editReqPurpose, setEditReqPurpose] = useState('')
  const [editReqAmount, setEditReqAmount] = useState('')
  const [editReqDateNeeded, setEditReqDateNeeded] = useState(getLocalYYYYMMDD())
  const [editReqDesc, setEditReqDesc] = useState('')
  const [editReqFromMinistry, setEditReqFromMinistry] = useState('The MINISTRY OF ALTAR SERVERS')
  const [editReqVenue, setEditReqVenue] = useState('N/A')
  const [editReqParticipants, setEditReqParticipants] = useState('N/A')
  const [editReqAssembly, setEditReqAssembly] = useState('N/A')
  const [editReqExpectedExpenses, setEditReqExpectedExpenses] = useState<FundRequisitionItem[]>([
    { id: 'item-1', intendedUse: '', unitPrice: '', quantity: '', amount: 0 }
  ])

  // Check if page should render
  if (!hasModuleAccess('finance')) {
    return <Navigate to="/" replace />
  }

  // Load all foundational data
  const fetchData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [cats, incs, exps, reqs, pers, ledg] = await Promise.all([
        categoryService.getCategories(showArchived),
        incomeService.getIncomes(undefined, undefined, showArchived),
        expenseService.getExpenses(undefined, undefined, showArchived),
        fundRequestService.getFundRequests(undefined, undefined, showArchived),
        financePeriodService.getPeriods(),
        ledgerService.getLedgerEntries(undefined, undefined, showArchived)
      ])
      setCategories(cats)
      setIncomes(incs)
      setExpenses(exps)
      setRequests(reqs)
      setPeriods(pers)
      setLedgerEntries(ledg)
    } catch (err: any) {
      console.error(err)
      setErrorMsg('Failed to synchronize financial datasets.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [showArchived])

  // Close row action dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.action-menu-container')) {
        setActionMenuReqId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Calculate current month identifier
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), [])

  // Calculate dashboard summary
  const summary = useMemo(() => {
    return financeEngine.computeMonthlySummary(ledgerEntries, requests, currentMonthStr)
  }, [ledgerEntries, requests, currentMonthStr])

  // Pending requests count for tab notification badge
  const pendingRequestsCount = useMemo(() => {
    return requests.filter(r => r.status === 'pending' && !r.isArchived).length
  }, [requests])

  // Last 6 months trend calculations
  const monthlyTrends = useMemo(() => {
    const months: string[] = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      months.push(`${year}-${month}`)
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    const data = months.map(m => {
      const [year, month] = m.split('-')
      const monthIdx = parseInt(month, 10) - 1
      const monthLabel = `${monthNames[monthIdx]} '${year.slice(2)}`
      return {
        month: m,
        monthLabel,
        income: 0,
        expense: 0
      }
    })

    ledgerEntries.forEach(entry => {
      const entryMonth = entry.date.slice(0, 7)
      const matched = data.find(d => d.month === entryMonth)
      if (matched) {
        matched.income += entry.amountIn
        matched.expense += entry.amountOut
      }
    })

    return data
  }, [ledgerEntries])

  const trendChart = useMemo(() => {
    const maxVal = Math.max(...monthlyTrends.map(d => Math.max(d.income, d.expense)), 1000) * 1.15
    const w = 500
    const h = 200
    const padX = 50
    const padY = 30
    const chartW = w - padX - 20
    const chartH = h - padY - 20

    const getX = (index: number) => padX + index * (chartW / 5)
    const getY = (val: number) => h - padY - (val / maxVal) * chartH

    const incPoints = monthlyTrends.map((d, i) => `${getX(i)},${getY(d.income)}`).join(' ')
    const expPoints = monthlyTrends.map((d, i) => `${getX(i)},${getY(d.expense)}`).join(' ')

    const hasData = monthlyTrends.some(d => d.income > 0 || d.expense > 0)

    return { getX, getY, incPoints, expPoints, maxVal, data: monthlyTrends, w, h, padX, padY, chartW, chartH, hasData }
  }, [monthlyTrends])

  // Category map helper
  const categoryMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {}
    categories.forEach(c => {
      map[c.id] = { name: c.name, color: c.color || 'blue' }
    })
    return map
  }, [categories])

  // Load report data when dates change
  useEffect(() => {
    if (activeTab === 'reports') {
      const generate = async () => {
        try {
          const rep = await reportService.generateFinanceReport(reportStartDate, reportEndDate)
          setReportData(rep)
        } catch (err) {
          console.error(err)
        }
      }
      generate()
    }
  }, [activeTab, reportStartDate, reportEndDate, incomes, expenses, requests])

  // Financial Period Lock Helper
  const isPeriodClosed = (dateStr: string) => {
    const periodId = dateStr.slice(0, 7)
    const matched = periods.find(p => p.id === periodId)
    return matched ? matched.status === 'closed' : false
  }

  // Automatic Comma Formatter for real-time text input
  const handleNumberChange = (val: string, setter: (s: string) => void) => {
    // Keep only numbers and a single decimal point
    const clean = val.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    if (parts.length > 2) return // Ignore secondary decimal points
    
    // Add commas to the integer part
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    setter(parts.join('.'))
  }

  // Format single value string with real-time commas
  const formatCommaAmount = (val: string | number | undefined): string => {
    if (val === '' || val === undefined || val === null) return ''
    const str = String(val).replace(/,/g, '')
    const clean = str.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    if (parts.length > 2) return parts[0] + '.' + parts[1]
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  }

  // Helper to parse comma formatted string or number to pure number
  const parseAmount = (val: string | number | undefined): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val
    if (!val) return 0
    return Number(String(val).replace(/,/g, '')) || 0
  }

  // Category Modal Helpers
  const handleOpenAddCategory = () => {
    setEditCategoryItem(null)
    setCatName('')
    setCatColor('blue')
    setIsCategoryModalOpen(true)
  }

  const handleOpenEditCategory = (cat: FinanceCategory) => {
    setEditCategoryItem(cat)
    setCatName(cat.name)
    setCatColor(cat.color || 'blue')
    setIsCategoryModalOpen(true)
  }

  // Handle Save Category (Create or Edit)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!catName.trim()) return
    setSaving(true)
    setErrorMsg(null)
    try {
      if (editCategoryItem) {
        await categoryService.updateCategory(
          editCategoryItem.id,
          catName.trim(),
          catColor,
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Category updated successfully.')
      } else {
        await categoryService.createCategory(
          catName.trim(),
          catIcon,
          catColor,
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Category created successfully.')
      }
      setCatName('')
      setEditCategoryItem(null)
      setIsCategoryModalOpen(false)
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save category.')
    } finally {
      setSaving(false)
    }
  }

  // Open Income Modal Helpers
  const handleOpenAddIncome = () => {
    setEditIncomeItem(null)
    setIncAmount('')
    setIncSource('')
    setIncCategoryId('')
    setIncReceivedFrom('')
    setIncDate(getLocalYYYYMMDD())
    setIncDesc('')
    setIsIncomeModalOpen(true)
  }

  const handleOpenEditIncome = (inc: FinanceIncome) => {
    setEditIncomeItem(inc)
    const parts = inc.amount.toString().split('.')
    if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    setIncAmount(parts.join('.'))
    setIncSource(inc.source)
    setIncCategoryId(inc.categoryId)
    setIncReceivedFrom(inc.receivedFrom)
    setIncDate(inc.date)
    setIncDesc(inc.description || '')
    setIsIncomeModalOpen(true)
  }

  // Handle Save Income (Create or Edit)
  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!incAmount || !incSource || !incCategoryId || !incReceivedFrom) {
      setErrorMsg('Please populate all mandatory income fields.')
      return
    }
    if (isPeriodClosed(incDate)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      if (editIncomeItem) {
        await incomeService.updateIncome(
          editIncomeItem.id,
          {
            amount: parseAmount(incAmount),
            source: incSource.trim(),
            categoryId: incCategoryId,
            receivedFrom: incReceivedFrom.trim(),
            date: incDate,
            description: incDesc.trim()
          },
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Income transaction updated successfully.')
      } else {
        await incomeService.addIncome(
          {
            amount: parseAmount(incAmount),
            source: incSource.trim(),
            categoryId: incCategoryId,
            receivedFrom: incReceivedFrom.trim(),
            date: incDate,
            description: incDesc.trim(),
            createdByUid: profile?.uid || 'System',
            createdByName: profile?.displayName || 'Admin'
          },
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Income transaction recorded.')
      }
      setIncAmount('')
      setIncSource('')
      setIncCategoryId('')
      setIncReceivedFrom('')
      setIncDesc('')
      setEditIncomeItem(null)
      setIsIncomeModalOpen(false)
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save income.')
    } finally {
      setSaving(false)
    }
  }

  // Open Expense Modal Helpers
  const handleOpenAddExpense = () => {
    setEditExpenseItem(null)
    setExpAmount('')
    setExpCategoryId('')
    setExpSpentByName(profile?.displayName || '')
    setExpDate(getLocalYYYYMMDD())
    setExpDesc('')
    setIsExpenseModalOpen(true)
  }

  const handleOpenEditExpense = (exp: DirectExpense) => {
    setEditExpenseItem(exp)
    const parts = exp.amount.toString().split('.')
    if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    setExpAmount(parts.join('.'))
    setExpCategoryId(exp.categoryId)
    setExpSpentByName(exp.spentByName)
    setExpDate(exp.date)
    setExpDesc(exp.description || '')
    setIsExpenseModalOpen(true)
  }

  // Handle Save Expense (Create or Edit)
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expAmount || !expCategoryId || !expSpentByName) {
      setErrorMsg('Please populate all mandatory expense fields.')
      return
    }
    if (isPeriodClosed(expDate)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      if (editExpenseItem) {
        await expenseService.updateExpense(
          editExpenseItem.id,
          {
            amount: parseAmount(expAmount),
            categoryId: expCategoryId,
            spentByName: expSpentByName.trim(),
            date: expDate,
            description: expDesc.trim()
          },
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Direct expense updated successfully.')
      } else {
        await expenseService.addExpense(
          {
            amount: parseAmount(expAmount),
            categoryId: expCategoryId,
            spentByUid: profile?.uid || 'Unknown',
            spentByName: expSpentByName.trim(),
            date: expDate,
            description: expDesc.trim(),
            createdByUid: profile?.uid || 'System',
            createdByName: profile?.displayName || 'Admin'
          },
          profile?.uid || 'System',
          profile?.displayName || 'Admin'
        )
        setSuccessMsg('Direct expense transaction recorded.')
      }
      setExpAmount('')
      setExpCategoryId('')
      setExpDesc('')
      setEditExpenseItem(null)
      setIsExpenseModalOpen(false)
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save expense.')
    } finally {
      setSaving(false)
    }
  }

  // Handle Save Fund Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reqTitle || !reqPurpose || !reqDateNeeded) {
      setErrorMsg('Please populate all mandatory request fields.')
      return
    }
    if (isPeriodClosed(reqDateNeeded)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    const calculatedTotal = reqExpectedExpenses.reduce((sum, item) => sum + parseAmount(item.amount), 0)
    const finalAmount = calculatedTotal > 0 ? calculatedTotal : parseAmount(reqAmount)

    if (finalAmount <= 0) {
      setErrorMsg('Please enter a valid requested amount or add expected expense items.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.createFundRequest(
        {
          title: reqTitle.trim(),
          purpose: reqPurpose.trim(),
          requestedAmount: finalAmount,
          requestedByUid: profile?.uid || 'Unknown',
          requestedByName: profile?.displayName || 'User',
          dateNeeded: reqDateNeeded,
          description: reqDesc.trim(),
          fundSource: reqFundSource,
          fromMinistry: reqFromMinistry.trim() || 'The MINISTRY OF ALTAR SERVERS',
          venue: reqVenue.trim() || 'N/A',
          participants: reqParticipants.trim() || 'N/A',
          assembly: reqAssembly.trim() || 'N/A',
          expectedExpenses: reqExpectedExpenses.filter(item => item.intendedUse.trim() || parseAmount(item.amount) > 0),
          createdByUid: profile?.uid || 'System',
          createdByName: profile?.displayName || 'Admin'
        },
        profile?.uid || 'System',
        profile?.displayName || 'Admin',
        true // Submit immediately as pending
      )
      setReqFundSource('main_funds')
      setReqTitle('')
      setReqPurpose('')
      setReqAmount('')
      setReqDesc('')
      setReqVenue('N/A')
      setReqParticipants('N/A')
      setReqAssembly('N/A')
      setReqExpectedExpenses([{ id: 'item-1', intendedUse: '', unitPrice: '', quantity: '', amount: 0 }])
      setIsRequestModalOpen(false)
      setSuccessMsg('Fund request submitted successfully.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request.')
    } finally {
      setSaving(false)
    }
  }

  // Check if current user is the requester (to prevent self-approval, except for admins/coordinators)
  const isSelfRequest = (req: FinanceFundRequest) => {
    if (!profile) return false
    // Admin / Coordinator exemption: Administrators have authority to approve requests even if submitted by themselves
    if (isAdmin || profile.role === 'admin' || profile.role === 'coordinator') {
      return false
    }

    const currentUid = profile.uid?.trim()
    const currentName = profile.displayName?.trim().toLowerCase()
    const reqUid = req.requestedByUid?.trim() || req.createdByUid?.trim()
    const reqName = req.requestedByName?.trim().toLowerCase()

    const matchUid = Boolean(currentUid && reqUid && currentUid === reqUid)
    const matchName = Boolean(currentName && reqName && currentName === reqName)

    return matchUid || matchName
  }

  // Open Edit Fund Request Modal
  const handleOpenEditRequestModal = (req: FinanceFundRequest) => {
    setEditingRequest(req)
    setEditReqTitle(req.title || '')
    setEditReqPurpose(req.purpose || '')
    setEditReqAmount(req.requestedAmount ? String(req.requestedAmount) : '')
    setEditReqDateNeeded(req.dateNeeded || getLocalYYYYMMDD())
    setEditReqDesc(req.description || '')
    setEditReqFundSource(req.fundSource || 'main_funds')
    setEditReqFromMinistry(req.fromMinistry || 'The MINISTRY OF ALTAR SERVERS')
    setEditReqVenue(req.venue || 'N/A')
    setEditReqParticipants(req.participants || 'N/A')
    setEditReqAssembly(req.assembly || 'N/A')
    setEditReqExpectedExpenses(
      req.expectedExpenses && req.expectedExpenses.length > 0
        ? req.expectedExpenses.map((it, i) => ({
            id: it.id || `item-${i + 1}`,
            intendedUse: it.intendedUse || '',
            unitPrice: it.unitPrice || '',
            quantity: it.quantity || '',
            amount: it.amount || 0
          }))
        : [{ id: 'item-1', intendedUse: '', unitPrice: '', quantity: '', amount: 0 }]
    )
    setIsEditRequestModalOpen(true)
  }

  const handleAddEditReqExpenseRow = () => {
    setEditReqExpectedExpenses(prev => [
      ...prev,
      { id: `item-${Date.now()}-${prev.length + 1}`, intendedUse: '', unitPrice: '', quantity: '', amount: 0 }
    ])
  }

  const handleRemoveEditReqExpenseRow = (index: number) => {
    setEditReqExpectedExpenses(prev => {
      if (prev.length <= 1) {
        return [{ id: `item-${Date.now()}`, intendedUse: '', unitPrice: '', quantity: '', amount: 0 }]
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleUpdateEditReqExpenseRow = (index: number, field: keyof FundRequisitionItem, val: string) => {
    setEditReqExpectedExpenses(prev => {
      const updated = [...prev]
      const item = { ...updated[index] }

      if (field === 'amount') {
        const sanitized = val.replace(/[^0-9.]/g, '')
        const parts = sanitized.split('.')
        const formatted = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : sanitized
        item.amount = formatted
      } else {
        (item as any)[field] = val
      }

      updated[index] = item
      return updated
    })
  }

  // Handle Save Edit Fund Request
  const handleSaveEditRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingRequest) return
    if (!editReqTitle.trim() || !editReqPurpose.trim() || !editReqDateNeeded) {
      setErrorMsg('Please populate all mandatory request fields.')
      return
    }
    if (isPeriodClosed(editReqDateNeeded)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    const calculatedTotal = editReqExpectedExpenses.reduce((sum, item) => sum + parseAmount(item.amount), 0)
    const finalAmount = calculatedTotal > 0 ? calculatedTotal : parseAmount(editReqAmount)

    if (finalAmount <= 0) {
      setErrorMsg('Please enter a valid requested amount or add expected expense items.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.updateRequest(
        editingRequest.id,
        {
          title: editReqTitle.trim(),
          purpose: editReqPurpose.trim(),
          requestedAmount: finalAmount,
          dateNeeded: editReqDateNeeded,
          description: editReqDesc.trim(),
          fundSource: editReqFundSource,
          fromMinistry: editReqFromMinistry.trim() || 'The MINISTRY OF ALTAR SERVERS',
          venue: editReqVenue.trim() || 'N/A',
          participants: editReqParticipants.trim() || 'N/A',
          assembly: editReqAssembly.trim() || 'N/A',
          expectedExpenses: editReqExpectedExpenses.filter(item => item.intendedUse.trim() || parseAmount(item.amount) > 0)
        },
        profile?.uid || 'System',
        profile?.displayName || 'Admin'
      )
      setIsEditRequestModalOpen(false)
      setEditingRequest(null)
      setSuccessMsg('Fund request details updated successfully.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update request.')
    } finally {
      setSaving(false)
    }
  }

  // Approve Request Workflow
  const handleApproveRequest = async (reqId: string) => {
    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.approveRequest(
        reqId,
        'Approved by leader/treasurer',
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin',
        undefined,
        profile?.role,
        isAdmin || profile?.role === 'admin' || profile?.role === 'coordinator'
      )
      setSuccessMsg('Request approved.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve request.')
    } finally {
      setSaving(false)
    }
  }

  // Reject Request Workflow
  const handleRejectRequest = async (reqId: string) => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Please enter a rejection reason.')
      return
    }
    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.rejectRequest(
        reqId,
        rejectionReason.trim(),
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin'
      )
      setRejectionReason('')
      setShowRejectionInput(null)
      setSuccessMsg('Request rejected.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reject request.')
    } finally {
      setSaving(false)
    }
  }

  // Cancel Request Workflow
  const handleOpenCancelModal = (req: FinanceFundRequest) => {
    setCancelModalRequest(req)
    setCancelReason('')
  }

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cancelModalRequest) return
    if (!cancelReason.trim()) {
      setErrorMsg('Please specify a cancellation reason.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.cancelRequest(
        cancelModalRequest.id,
        cancelReason.trim(),
        profile?.uid || 'System',
        profile?.displayName || 'Admin'
      )
      setSuccessMsg(`Fund request ${cancelModalRequest.referenceNumber} has been cancelled.`)
      setCancelModalRequest(null)
      setCancelReason('')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to cancel fund request.')
    } finally {
      setSaving(false)
    }
  }

  // Void Request Workflow
  const handleOpenVoidModal = (req: FinanceFundRequest) => {
    setVoidModalRequest(req)
    setVoidReason('')
  }

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!voidModalRequest) return
    if (!voidReason.trim()) {
      setErrorMsg('Please specify a reason for voiding this request.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.voidRequest(
        voidModalRequest.id,
        voidReason.trim(),
        profile?.uid || 'System',
        profile?.displayName || 'Admin'
      )
      setSuccessMsg(`Fund request ${voidModalRequest.referenceNumber} has been voided.`)
      setVoidModalRequest(null)
      setVoidReason('')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to void fund request.')
    } finally {
      setSaving(false)
    }
  }

  // Release Workflow
  const handleReleaseOpen = (req: FinanceFundRequest) => {
    setSelectedRequest(req)
    setRelToName(req.requestedByName)
    setRelAmount(req.requestedAmount.toLocaleString())
    setRelDate(getLocalYYYYMMDD())
    setRelRemarks('')
    setRelParishOfficeDisbursedBy('Parish Office / Secretary')
    setRelParishOfficeReceivedBy(req.requestedByName)
    setRelParishOfficeRemarks('')
    setIsReleaseModalOpen(true)
  }

  const handleReleaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return
    if (isPeriodClosed(relDate)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      const isParish = selectedRequest.fundSource === 'parish'
      await fundRequestService.releaseFunds(
        selectedRequest.id,
        {
          releasedToName: isParish ? (relParishOfficeReceivedBy.trim() || relToName.trim()) : relToName.trim(),
          releasedAmount: parseAmount(relAmount),
          releasedDate: relDate,
          remarks: relRemarks.trim(),
          parishOfficeDisbursedDate: relDate,
          parishOfficeDisbursedAmount: parseAmount(relAmount),
          parishOfficeDisbursedBy: relParishOfficeDisbursedBy.trim(),
          parishOfficeReceivedBy: relParishOfficeReceivedBy.trim() || relToName.trim(),
          parishOfficeRemarks: relParishOfficeRemarks.trim()
        },
        profile?.uid || 'System',
        profile?.displayName || 'Admin'
      )
      setIsReleaseModalOpen(false)
      setSelectedRequest(null)
      setRelRemarks('')
      setRelParishOfficeRemarks('')
      setSuccessMsg(isParish ? 'Parish funds release and recipient logged successfully.' : 'Funds released successfully.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to release funds.')
    } finally {
      setSaving(false)
    }
  }

  // Liquidation Workflow
  const handleLiquidationOpen = (req: FinanceFundRequest) => {
    setSelectedRequest(req)
    setLiqTo(req.liquidationTo || 'Rev. Fr. ILDEFONSO DE GUZMAN JR., Parish Priest')
    setLiqFrom(req.liquidationFrom || 'MINISTRY OF ALTAR SERVERS')
    setLiqDate(req.liquidationDate || getLocalYYYYMMDD())
    
    // Initialize Budget Sources
    const initialSources: LiquidationBudgetSource[] = req.budgetSources && req.budgetSources.length > 0
      ? req.budgetSources.map(b => ({ ...b, amount: formatCommaAmount(b.amount) }))
      : [
          {
            id: 'b-1',
            description: `Parish (Request - ${req.referenceNumber})`,
            amount: formatCommaAmount(req.releasedAmount || req.requestedAmount || 0)
          }
        ]
    setLiqBudgetSources(initialSources)

    // Initialize Actual Expenses
    const initialExpenses: LiquidationExpenseItem[] = req.liquidationExpenses && req.liquidationExpenses.length > 0
      ? req.liquidationExpenses.map(e => ({ ...e, amount: formatCommaAmount(e.amount) }))
      : (req.expectedExpenses && req.expectedExpenses.length > 0)
      ? req.expectedExpenses.map((exp, idx) => ({
          id: `e-${idx + 1}`,
          orNumber: 'NO O.R',
          description: exp.intendedUse || 'Expenditure',
          amount: formatCommaAmount(exp.amount)
        }))
      : [
          {
            id: 'e-1',
            orNumber: 'NO O.R',
            description: req.purpose || req.title || 'Actual Expenditures',
            amount: formatCommaAmount(req.releasedAmount || req.requestedAmount || 0)
          }
        ]
    setLiqExpenses(initialExpenses)
    setLiqRemarks(req.liquidationRemarks || '')
    setIsLiquidationModalOpen(true)
  }

  const handleLiquidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return
    
    const totalBudget = liqBudgetSources.reduce((sum, b) => sum + parseAmount(b.amount), 0)
    const totalSpent = liqExpenses.reduce((sum, exp) => sum + parseAmount(exp.amount), 0)
    const returnedAmount = Math.max(0, totalBudget - totalSpent)
    const reimbursedAmount = Math.max(0, totalSpent - totalBudget)

    if (totalBudget <= 0 && totalSpent <= 0) {
      setErrorMsg('Please specify budget sources or actual expenses for this liquidation.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.submitLiquidation(
        selectedRequest.id,
        {
          totalSpent,
          remainingAmount: 0,
          returnedAmount,
          reimbursedAmount,
          remarks: liqRemarks.trim(),
          liquidationTo: liqTo.trim(),
          liquidationFrom: liqFrom.trim(),
          liquidationDate: liqDate,
          budgetSources: liqBudgetSources.filter(b => b.description.trim() || parseAmount(b.amount) > 0),
          liquidationExpenses: liqExpenses.filter(e => e.description.trim() || parseAmount(e.amount) > 0)
        },
        profile?.uid || 'User',
        profile?.displayName || 'User'
      )
      setIsLiquidationModalOpen(false)
      setSelectedRequest(null)
      setLiqRemarks('')
      setSuccessMsg('Liquidation report recorded successfully.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit liquidation.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenReviewModal = (req: FinanceFundRequest) => {
    setReviewLiquidationRequest(req)
    setReviewRemarks(req.liquidationReviewRemarks || '')
    setReviewRevisionReason('')
    setShowRevisionSection(false)
    setIsReviewLiquidationModalOpen(true)
  }

  const handleApproveLiquidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewLiquidationRequest) return

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.reviewLiquidation(
        reviewLiquidationRequest.id,
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin',
        reviewRemarks.trim() || undefined
      )
      setIsReviewLiquidationModalOpen(false)
      setReviewLiquidationRequest(null)
      setReviewRemarks('')
      setSuccessMsg('Liquidation report approved. Fund request closed.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve liquidation.')
    } finally {
      setSaving(false)
    }
  }

  const handleRequestRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewLiquidationRequest) return
    if (!reviewRevisionReason.trim()) {
      setErrorMsg('Please specify the required changes or reasons for revision.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.requestLiquidationRevision(
        reviewLiquidationRequest.id,
        reviewRevisionReason.trim(),
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin'
      )
      setIsReviewLiquidationModalOpen(false)
      setReviewLiquidationRequest(null)
      setReviewRevisionReason('')
      setShowRevisionSection(false)
      setSuccessMsg('Liquidation returned for revision. Requester can now update the expenditures.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request revision.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenReopenModal = (req: FinanceFundRequest) => {
    setReopenModalRequest(req)
    setReopenReason('')
  }

  const handleReopenLiquidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reopenModalRequest) return

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.reopenLiquidationReview(
        reopenModalRequest.id,
        reopenReason.trim(),
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin'
      )
      const reopenedReq = {
        ...reopenModalRequest,
        status: 'liquidated' as const,
        liquidationReopenedByName: profile?.displayName || 'Admin',
        liquidationReopenReason: reopenReason.trim() || undefined
      }
      setReopenModalRequest(null)
      setReopenReason('')
      setSuccessMsg('Closed liquidation reopened for review.')
      await fetchData()
      handleOpenReviewModal(reopenedReq)
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reopen liquidation for review.')
    } finally {
      setSaving(false)
    }
  }

  // Row Helpers: Requisition Expected Expenses
  const handleAddReqExpenseRow = () => {
    setReqExpectedExpenses(prev => [
      ...prev,
      { id: `item-${Date.now()}`, intendedUse: '', unitPrice: '', quantity: '', amount: '' }
    ])
  }

  const handleUpdateReqExpenseRow = (index: number, field: keyof FundRequisitionItem, value: any) => {
    setReqExpectedExpenses(prev => {
      const next = [...prev]
      const current = { ...next[index] }

      if (field === 'amount') {
        current.amount = formatCommaAmount(value)
      } else {
        (current as any)[field] = value

        // Auto-compute amount whenever unitPrice or quantity is modified
        if (field === 'unitPrice' || field === 'quantity') {
          const extractNum = (v: any) => {
            if (typeof v === 'number') return isNaN(v) ? 0 : v
            if (!v) return 0
            const match = String(v).replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
            return match ? parseFloat(match[0]) : 0
          }

          const uPrice = extractNum(current.unitPrice)
          const qty = extractNum(current.quantity)
          if (uPrice > 0 && qty > 0) {
            const computed = uPrice * qty
            const formatted = computed % 1 === 0 ? computed.toString() : computed.toFixed(2)
            current.amount = formatCommaAmount(formatted)
          }
        }
      }

      next[index] = current
      return next
    })
  }

  const handleRemoveReqExpenseRow = (index: number) => {
    setReqExpectedExpenses(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [{ id: `item-${Date.now()}`, intendedUse: '', unitPrice: '', quantity: '', amount: '' }]
    })
  }

  // Row Helpers: Liquidation Budget Sources
  const handleAddLiqBudgetRow = () => {
    setLiqBudgetSources(prev => [
      ...prev,
      { id: `b-${Date.now()}`, description: '', amount: '' }
    ])
  }

  const handleUpdateLiqBudgetRow = (index: number, field: keyof LiquidationBudgetSource, value: any) => {
    setLiqBudgetSources(prev => {
      const next = [...prev]
      const finalVal = field === 'amount' ? formatCommaAmount(value) : value
      next[index] = { ...next[index], [field]: finalVal }
      return next
    })
  }

  const handleRemoveLiqBudgetRow = (index: number) => {
    setLiqBudgetSources(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [{ id: `b-${Date.now()}`, description: '', amount: '' }]
    })
  }

  // Row Helpers: Liquidation Actual Expenses
  const handleAddLiqExpenseRow = () => {
    setLiqExpenses(prev => [
      ...prev,
      { id: `e-${Date.now()}`, orNumber: 'NO O.R', description: '', amount: '' }
    ])
  }

  const handleUpdateLiqExpenseRow = (index: number, field: keyof LiquidationExpenseItem, value: any) => {
    setLiqExpenses(prev => {
      const next = [...prev]
      const finalVal = field === 'amount' ? formatCommaAmount(value) : value
      next[index] = { ...next[index], [field]: finalVal }
      return next
    })
  }

  const handleRemoveLiqExpenseRow = (index: number) => {
    setLiqExpenses(prev => {
      const next = prev.filter((_, i) => i !== index)
      return next.length > 0 ? next : [{ id: `e-${Date.now()}`, orNumber: 'NO O.R', description: '', amount: '' }]
    })
  }

  // Soft Archiving & Restoring Operations
  const handleArchiveIncome = async (id: string) => {
    setDialog({
      title: 'Archive Income',
      message: 'Are you sure you want to archive this income entry?',
      isConfirm: true,
      onConfirm: async () => {
        try {
          await incomeService.archiveIncome(id, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg('Income record archived.')
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to archive income.')
        }
      }
    })
  }

  const handleRestoreIncome = async (id: string) => {
    try {
      await incomeService.restoreIncome(id, profile?.uid || 'System', profile?.displayName || 'Admin')
      setSuccessMsg('Income record restored.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore income.')
    }
  }

  const handleArchiveExpense = async (id: string) => {
    setDialog({
      title: 'Archive Expense',
      message: 'Are you sure you want to archive this expense entry?',
      isConfirm: true,
      onConfirm: async () => {
        try {
          await expenseService.archiveExpense(id, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg('Expense record archived.')
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to archive expense.')
        }
      }
    })
  }

  const handleRestoreExpense = async (id: string) => {
    try {
      await expenseService.restoreExpense(id, profile?.uid || 'System', profile?.displayName || 'Admin')
      setSuccessMsg('Direct expense record restored.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore expense.')
    }
  }

  const handleArchiveRequest = async (id: string) => {
    setDialog({
      title: 'Archive Fund Request',
      message: 'Are you sure you want to archive this fund request?',
      isConfirm: true,
      onConfirm: async () => {
        try {
          await fundRequestService.archiveRequest(id, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg('Fund request archived.')
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to archive request.')
        }
      }
    })
  }

  const handleRestoreRequest = async (id: string) => {
    try {
      await fundRequestService.restoreRequest(id, profile?.uid || 'System', profile?.displayName || 'Admin')
      setSuccessMsg('Fund request restored.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore request.')
    }
  }

  const handleArchiveCategory = async (id: string, name: string) => {
    setDialog({
      title: 'Archive Category',
      message: `Are you sure you want to archive the category "${name}"?`,
      isConfirm: true,
      onConfirm: async () => {
        try {
          await categoryService.archiveCategory(id, name, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg('Category archived.')
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to archive category.')
        }
      }
    })
  }

  const handleRestoreCategory = async (id: string, name: string) => {
    try {
      await categoryService.restoreCategory(id, name, profile?.uid || 'System', profile?.displayName || 'Admin')
      setSuccessMsg(`Category "${name}" restored.`)
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to restore category.')
    }
  }

  // Selection Helpers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = (allIds: string[]) => {
    if (selectedIds.size === allIds.length && allIds.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  // Bulk Trigger Helpers
  const handleTriggerBulkDelete = (type: 'income' | 'expense' | 'category' | 'request') => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)

    if (type === 'category') {
      const cats = categories.filter(c => selectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name }))
      setDeleteConfirm({
        isOpen: true,
        ids,
        categories: cats,
        type: 'category'
      })
    } else {
      setDeleteConfirm({
        isOpen: true,
        ids,
        type
      })
    }
  }

  const handleTriggerBulkArchive = async (type: 'income' | 'expense' | 'category' | 'request') => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const uId = profile?.uid || 'System'
    const uName = profile?.displayName || 'Admin'

    setDialog({
      title: `Bulk Archive ${ids.length} Item(s)`,
      message: `Are you sure you want to archive ${ids.length} selected item(s)?`,
      isConfirm: true,
      onConfirm: async () => {
        setBulkActionLoading(true)
        try {
          if (type === 'income') {
            await incomeService.bulkArchiveIncomes(ids, uId, uName)
            setSuccessMsg(`${ids.length} income transaction(s) archived.`)
          } else if (type === 'expense') {
            await expenseService.bulkArchiveExpenses(ids, uId, uName)
            setSuccessMsg(`${ids.length} direct expense(s) archived.`)
          } else if (type === 'category') {
            const cats = categories.filter(c => selectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name }))
            await categoryService.bulkArchiveCategories(cats, uId, uName)
            setSuccessMsg(`${cats.length} category(ies) archived.`)
          } else if (type === 'request') {
            await fundRequestService.bulkArchiveRequests(ids, uId, uName)
            setSuccessMsg(`${ids.length} fund request(s) archived.`)
          }
          setSelectedIds(new Set())
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to bulk archive items.')
        } finally {
          setBulkActionLoading(false)
        }
      }
    })
  }

  const handleTriggerBulkRestore = async (type: 'income' | 'expense' | 'category' | 'request') => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const uId = profile?.uid || 'System'
    const uName = profile?.displayName || 'Admin'

    setBulkActionLoading(true)
    try {
      if (type === 'income') {
        await incomeService.bulkRestoreIncomes(ids, uId, uName)
        setSuccessMsg(`${ids.length} income transaction(s) restored.`)
      } else if (type === 'expense') {
        await expenseService.bulkRestoreExpenses(ids, uId, uName)
        setSuccessMsg(`${ids.length} direct expense(s) restored.`)
      } else if (type === 'category') {
        const cats = categories.filter(c => selectedIds.has(c.id)).map(c => ({ id: c.id, name: c.name }))
        await categoryService.bulkRestoreCategories(cats, uId, uName)
        setSuccessMsg(`${cats.length} category(ies) restored.`)
      } else if (type === 'request') {
        await fundRequestService.bulkRestoreRequests(ids, uId, uName)
        setSuccessMsg(`${ids.length} fund request(s) restored.`)
      }
      setSelectedIds(new Set())
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to bulk restore items.')
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Permanent Delete Password Verification Handlers
  const handleConfirmDelete = async (password: string) => {
    if (!deleteConfirm.id && (!deleteConfirm.ids || deleteConfirm.ids.length === 0)) return
    try {
      await authService.verifyPassword(password)

      const uId = profile?.uid || 'System'
      const uName = profile?.displayName || 'Admin'

      if (deleteConfirm.ids && deleteConfirm.ids.length > 0) {
        // Bulk deletion
        if (deleteConfirm.type === 'income') {
          await incomeService.bulkDeleteIncomes(deleteConfirm.ids, uId, uName)
          setSuccessMsg(`${deleteConfirm.ids.length} income transactions permanently deleted.`)
        } else if (deleteConfirm.type === 'expense') {
          await expenseService.bulkDeleteExpenses(deleteConfirm.ids, uId, uName)
          setSuccessMsg(`${deleteConfirm.ids.length} direct expenses permanently deleted.`)
        } else if (deleteConfirm.type === 'category' && deleteConfirm.categories) {
          await categoryService.bulkDeleteCategories(deleteConfirm.categories, uId, uName)
          setSuccessMsg(`${deleteConfirm.categories.length} categories permanently deleted.`)
        } else if (deleteConfirm.type === 'request') {
          await fundRequestService.bulkDeleteRequests(deleteConfirm.ids, uId, uName)
          setSuccessMsg(`${deleteConfirm.ids.length} fund requests permanently deleted.`)
        }
      } else if (deleteConfirm.id) {
        // Single deletion
        if (deleteConfirm.type === 'income') {
          await incomeService.deleteIncome(deleteConfirm.id, uId, uName)
          setSuccessMsg('Income transaction permanently deleted.')
        } else if (deleteConfirm.type === 'expense') {
          await expenseService.deleteExpense(deleteConfirm.id, uId, uName)
          setSuccessMsg('Direct expense record permanently deleted.')
        } else if (deleteConfirm.type === 'category') {
          await categoryService.deleteCategory(deleteConfirm.id, deleteConfirm.name || '', uId, uName)
          setSuccessMsg(`Category "${deleteConfirm.name || ''}" permanently deleted.`)
        } else if (deleteConfirm.type === 'request') {
          await fundRequestService.deleteRequest(deleteConfirm.id, uId, uName)
          setSuccessMsg('Fund request permanently deleted.')
        }
      }

      setDeleteConfirm({ isOpen: false, type: 'income' })
      setSelectedIds(new Set())
      await fetchData()
    } catch (err: any) {
      console.error(err)
      throw new Error(err.message || 'Verification failed. Password may be incorrect.')
    }
  }

  // Financial Period Operations
  const handleClosePeriod = async (periodId: string) => {
    setDialog({
      title: 'Close Financial Period',
      message: `Are you sure you want to CLOSE the period ${periodId}? This will lock all transactions.`,
      isConfirm: true,
      onConfirm: async () => {
        try {
          await financePeriodService.closePeriod(periodId, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg(`Period ${periodId} successfully closed.`)
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to close period.')
        }
      }
    })
  }

  const handleReopenPeriod = async (periodId: string) => {
    if (!canAction('canReopenFinancePeriod')) {
      setDialog({
        title: 'Unauthorized Action',
        message: 'Unauthorized. Only the Coordinator is allowed to reopen a closed financial period.',
        onConfirm: () => {}
      })
      return
    }
    setDialog({
      title: 'Reopen Financial Period',
      message: `Are you sure you want to REOPEN the period ${periodId}?`,
      isConfirm: true,
      onConfirm: async () => {
        try {
          await financePeriodService.reopenPeriod(periodId, profile?.uid || 'System', profile?.displayName || 'Admin')
          setSuccessMsg(`Period ${periodId} successfully reopened.`)
          await fetchData()
        } catch (err: any) {
          setErrorMsg(err.message || 'Failed to reopen period.')
        }
      }
    })
  }

  // Exports
  const handleExportCSV = () => {
    if (!reportData) return
    const headers = ['Date', 'Type', 'Description', 'Reference Number', 'Amount In', 'Amount Out', 'Running Balance']
    const rows = reportData.ledgerEntries.map((e: LedgerEntry) => [
      e.date,
      e.type,
      e.description,
      e.referenceNumber || '',
      e.amountIn,
      e.amountOut,
      e.runningBalance
    ])

    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `mats_ledger_${reportStartDate}_to_${reportEndDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportPDF = () => {
    if (!reportData) return
    setIsExportPdfModalOpen(true)
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <Loading variant="spinner" label="Loading Treasury & Ministry Finance..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Sleek Modern Tabs Navigation Bar (Mobile Swipeable & Desktop Responsive) */}
      <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden py-0.5 px-0.5 flex-1">
          {[
            { 
              key: 'dashboard', 
              label: 'Dashboard', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              ) 
            },
            { 
              key: 'requests', 
              label: 'Fund Requests', 
              badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ) 
            },
            { 
              key: 'income', 
              label: 'Incomes', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              ) 
            },
            { 
              key: 'expenses', 
              label: 'Expenses', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
                </svg>
              ) 
            },
            { 
              key: 'ledger', 
              label: 'Ledger', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              ) 
            },
            { 
              key: 'reports', 
              label: 'Reports', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              ) 
            },
            { 
              key: 'categories', 
              label: 'Categories', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              ) 
            },
            { 
              key: 'closing', 
              label: 'Lock Periods', 
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) 
            }
          ].map((t) => {
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key as any)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                }`}
              >
                <span className={isActive ? 'text-blue-100' : 'text-slate-400'}>
                  {t.icon}
                </span>
                <span className="whitespace-nowrap">{t.label}</span>
                {t.badge !== undefined && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                    isActive ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Global Archive Filter Toggle */}
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          title={showArchived ? 'Hide Archived Records' : 'Show Archived Records'}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all shrink-0 cursor-pointer ${
            showArchived
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border-slate-200/80 shadow-2xs'
          }`}
        >
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span className="hidden md:inline">{showArchived ? 'Hide Archives' : 'Archives'}</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-gray-200">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div>
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Current Balance */}
                <div className={`p-5 rounded-2xl border transition-all shadow-2xs flex flex-col justify-between ${
                  summary.currentBalance > 0
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                    : summary.currentBalance < 0
                    ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Current Balance</span>
                    <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-2xl sm:text-3xl font-black ${
                      summary.currentBalance > 0 ? 'text-emerald-700' : summary.currentBalance < 0 ? 'text-rose-700' : 'text-gray-900'
                    }`}>
                      ₱{summary.currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Total Income − Total Expenses
                    </span>
                  </div>
                </div>

                {/* Monthly Income */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Monthly Income</span>
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600">
                      ₱{summary.incomeThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      This month's collections
                    </span>
                  </div>
                </div>

                {/* Monthly Expenses */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Monthly Expenses</span>
                    <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-red-600">
                      ₱{summary.expensesThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      This month's disbursements
                    </span>
                  </div>
                </div>

                {/* Pending Actions */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Pending Actions</span>
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-amber-600">
                      {summary.pendingRequestsCount + summary.pendingLiquidationsCount}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Requests needing action
                    </span>
                  </div>
                </div>
              </div>

              {/* Graphical Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Monthly Cash Flow Trend</h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Income
                      </span>
                      <span className="flex items-center gap-1.5 text-red-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Expense
                      </span>
                    </div>
                  </div>

                  <div className="relative h-48 w-full">
                    {/* SVG Glow Filters Definitions */}
                    <svg className="absolute w-0 h-0">
                      <defs>
                        <filter id="glow-income" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10B981" floodOpacity="0.3"/>
                        </filter>
                        <filter id="glow-expense" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#EF4444" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                    </svg>

                    <svg viewBox={`0 0 ${trendChart.w} ${trendChart.h}`} className="w-full h-full overflow-visible">
                      {/* Grid Lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                        const yVal = ratio * trendChart.maxVal
                        const yPos = trendChart.getY(yVal)
                        return (
                          <g key={idx}>
                            <line 
                              x1={trendChart.padX} 
                              y1={yPos} 
                              x2={trendChart.w - 20} 
                              y2={yPos} 
                              stroke="#F1F5F9" 
                              strokeWidth="1"
                            />
                            <text 
                              x={trendChart.padX - 8} 
                              y={yPos + 3} 
                              textAnchor="end" 
                              className="text-[8px] fill-gray-400 font-bold"
                            >
                              ₱{Math.round(yVal).toLocaleString()}
                            </text>
                          </g>
                        )
                      })}

                      {/* X Axis Labels */}
                      {trendChart.data.map((d, i) => (
                        <text
                          key={i}
                          x={trendChart.getX(i)}
                          y={trendChart.h - 10}
                          textAnchor="middle"
                          className="text-[8px] fill-gray-500 font-bold"
                        >
                          {d.monthLabel}
                        </text>
                      ))}

                      {/* Income Line Path */}
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={trendChart.incPoints}
                        filter="url(#glow-income)"
                      />

                      {/* Expense Line Path */}
                      <polyline
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={trendChart.expPoints}
                        filter="url(#glow-expense)"
                      />

                      {/* Point Dots */}
                      {trendChart.data.map((d, i) => (
                        <g key={i}>
                          {/* Income Point */}
                          <circle
                            cx={trendChart.getX(i)}
                            cy={trendChart.getY(d.income)}
                            r="4"
                            fill="#FFFFFF"
                            stroke="#10B981"
                            strokeWidth="2"
                          />
                          {/* Expense Point */}
                          <circle
                            cx={trendChart.getX(i)}
                            cy={trendChart.getY(d.expense)}
                            r="4"
                            fill="#FFFFFF"
                            stroke="#EF4444"
                            strokeWidth="2"
                          />
                        </g>
                      ))}
                    </svg>

                    {/* Zero State Overlay */}
                    {!trendChart.hasData && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No transaction data recorded yet</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Transaction Highlights</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {[...ledgerEntries].reverse().slice(0, 5).map((e) => (
                      <div key={e.id} className="flex justify-between items-center text-xs p-2 hover:bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-bold text-gray-800 line-clamp-1">{e.description}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{e.date}</div>
                        </div>
                        <span className={`font-black ${e.amountIn > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {e.amountIn > 0 ? `+₱${e.amountIn.toLocaleString()}` : `-₱${e.amountOut.toLocaleString()}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Income Tab */}
          {activeTab === 'income' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900">Recorded Income Receipts</h3>
                <button
                  onClick={handleOpenAddIncome}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 transition-all"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Record Income</span>
                </button>
              </div>

              {/* Bulk Action Bar for Incomes */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  {bulkActionLoading ? (
                    <div className="flex-1 min-w-[260px]">
                      <BulkProgressBar
                        active={true}
                        label="Processing selected income records..."
                        itemCount={selectedIds.size}
                        variant="emerald"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {showArchived ? (
                        <button
                          onClick={() => handleTriggerBulkRestore('income')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restore Selected ({selectedIds.size})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerBulkArchive('income')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive Selected ({selectedIds.size})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleTriggerBulkDelete('income')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Permanently ({selectedIds.size})</span>
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-max [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={incomes.length > 0 && selectedIds.size === incomes.length}
                          onChange={() => handleSelectAll(incomes.map(i => i.id))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Reference No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Source</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.map((inc) => (
                      <tr key={inc.id} className={`border-b border-gray-100 hover:bg-gray-50/50 group ${inc.isArchived ? 'opacity-60 bg-gray-50' : ''} ${selectedIds.has(inc.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(inc.id)}
                            onChange={() => handleToggleSelect(inc.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-950">
                          {inc.referenceNumber}
                          {inc.isArchived && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Archived
                            </span>
                          )}
                        </td>
                        <td className="p-3">{inc.date}</td>
                        <td className="p-3">{inc.source}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${categoryMap[inc.categoryId]?.color || 'blue'}-50 text-${categoryMap[inc.categoryId]?.color || 'blue'}-700 border border-${categoryMap[inc.categoryId]?.color || 'blue'}-200`}>
                            {categoryMap[inc.categoryId]?.name || 'General'}
                          </span>
                        </td>
                        <td className="p-3 font-black text-emerald-600">₱{inc.amount.toLocaleString()}</td>
                        <td className="p-3 whitespace-nowrap">
                          {inc.isArchived ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRestoreIncome(inc.id)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Restore</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, id: inc.id, type: 'income' })}
                                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditIncome(inc)}
                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleArchiveIncome(inc.id)}
                                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-bold px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                                <span>Archive</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {incomes.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 font-medium italic">
                          No income records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Direct Expenses Tab */}
          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900">Direct Expense Payments</h3>
                <button
                  onClick={handleOpenAddExpense}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 transition-all"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Record Expense</span>
                </button>
              </div>

              {/* Bulk Action Bar for Expenses */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  {bulkActionLoading ? (
                    <div className="flex-1 min-w-[260px]">
                      <BulkProgressBar
                        active={true}
                        label="Processing selected expense records..."
                        itemCount={selectedIds.size}
                        variant="rose"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {showArchived ? (
                        <button
                          onClick={() => handleTriggerBulkRestore('expense')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restore Selected ({selectedIds.size})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerBulkArchive('expense')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive Selected ({selectedIds.size})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleTriggerBulkDelete('expense')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Permanently ({selectedIds.size})</span>
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-max [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={expenses.length > 0 && selectedIds.size === expenses.length}
                          onChange={() => handleSelectAll(expenses.map(e => e.id))}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Reference No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">Spent By</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id} className={`border-b border-gray-100 hover:bg-gray-50/50 group ${exp.isArchived ? 'opacity-60 bg-gray-50' : ''} ${selectedIds.has(exp.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(exp.id)}
                            onChange={() => handleToggleSelect(exp.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-950">
                          {exp.referenceNumber}
                          {exp.isArchived && (
                            <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Archived
                            </span>
                          )}
                        </td>
                        <td className="p-3">{exp.date}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            {exp.sourceType === 'event_expense' && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 shrink-0">
                                Event: {exp.sourceEventName || 'Event'}
                              </span>
                            )}
                            <span className="font-medium text-gray-800">{exp.description}</span>
                          </div>
                        </td>
                        <td className="p-3">{exp.spentByName}</td>
                        <td className="p-3 font-black text-red-600">₱{exp.amount.toLocaleString()}</td>
                        <td className="p-3 whitespace-nowrap">
                          {exp.isArchived ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRestoreExpense(exp.id)}
                                className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold px-2.5 py-1 bg-emerald-50/80 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Restore</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, id: exp.id, type: 'expense' })}
                                className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditExpense(exp)}
                                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2.5 py-1 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={() => handleArchiveExpense(exp.id)}
                                className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-bold px-2.5 py-1 bg-amber-50/80 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                                <span>Archive</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-gray-400 font-medium italic">
                          No expense records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-bold text-gray-900">Expense Categories</h3>
                  {categories.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleSelectAll(categories.map(c => c.id))}
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 px-2.5 py-1 rounded-lg cursor-pointer shadow-2xs transition-all"
                    >
                      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{selectedIds.size === categories.length ? 'Deselect All' : 'Select All'}</span>
                    </button>
                  )}
                </div>
                <button
                  onClick={handleOpenAddCategory}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 transition-all"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Category</span>
                </button>
              </div>

              {/* Bulk Action Bar for Categories */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  {bulkActionLoading ? (
                    <div className="flex-1 min-w-[260px]">
                      <BulkProgressBar
                        active={true}
                        label="Processing selected category classifications..."
                        itemCount={selectedIds.size}
                        variant="indigo"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {showArchived ? (
                        <button
                          onClick={() => handleTriggerBulkRestore('category')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restore Selected ({selectedIds.size})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerBulkArchive('category')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive Selected ({selectedIds.size})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleTriggerBulkDelete('category')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Permanently ({selectedIds.size})</span>
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className={`p-4 bg-white border rounded-2xl shadow-2xs flex justify-between items-center ${cat.isArchived ? 'border-amber-200 bg-amber-50/30 opacity-75' : 'border-gray-200'} ${selectedIds.has(cat.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(cat.id)}
                        onChange={() => handleToggleSelect(cat.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-gray-800">{cat.name}</span>
                          {cat.isArchived && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Archived
                            </span>
                          )}
                        </div>
                        <span className={`text-[10px] text-${cat.color}-600 capitalize font-bold`}>{cat.color || 'blue'} theme</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {cat.isArchived ? (
                        <>
                          <button
                            onClick={() => handleRestoreCategory(cat.id, cat.name)}
                            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-800 font-bold px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Restore</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name, type: 'category' })}
                            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg className="w-3 h-3 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleArchiveCategory(cat.id, cat.name)}
                            className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-bold px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                            </svg>
                            <span>Archive</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <div className="col-span-full p-8 text-center text-gray-400 font-medium italic bg-white rounded-xl border border-gray-200">
                    No categories found.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fund Requests Tab */}
          {activeTab === 'requests' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Fund Requests Workflow</h3>
                  <p className="text-[11px] text-gray-500">Manage ministry fund requisition, approvals, disbursements, and liquidations.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Fund Source Filter */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setFundSourceFilter('all')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                        fundSourceFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All ({requests.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundSourceFilter('main_funds')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        fundSourceFilter === 'main_funds'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-blue-700'
                      }`}
                    >
                      <span>Main Funds</span>
                      <span className="text-[10px] opacity-80 font-mono">({requests.filter(r => r.fundSource === 'main_funds' || (!r.fundSource && r.fundSource !== 'parish' && r.fundSource !== 'outside')).length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundSourceFilter('parish')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        fundSourceFilter === 'parish'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-emerald-700'
                      }`}
                    >
                      <span>Parish</span>
                      <span className="text-[10px] opacity-80 font-mono">({requests.filter(r => r.fundSource === 'parish').length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFundSourceFilter('outside')}
                      className={`px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        fundSourceFilter === 'outside'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-purple-700'
                      }`}
                    >
                      <span>Outside</span>
                      <span className="text-[10px] opacity-80 font-mono">({requests.filter(r => r.fundSource === 'outside').length})</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOutsideLiquidationModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/80 rounded-xl text-xs font-bold cursor-pointer shadow-2xs transition-all shrink-0"
                    title="Record an outside liquidation report without touching church funds"
                  >
                    <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>+ Outside Liquidation</span>
                  </button>

                  <button
                    onClick={() => setIsRequestModalOpen(true)}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md shadow-blue-600/20 transition-all w-full sm:w-auto shrink-0"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Create Fund Request</span>
                  </button>
                </div>
              </div>

              {/* Bulk Action Bar for Requests */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  {bulkActionLoading ? (
                    <div className="flex-1 min-w-[260px]">
                      <BulkProgressBar
                        active={true}
                        label="Processing selected fund requests..."
                        itemCount={selectedIds.size}
                        variant="blue"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {showArchived ? (
                        <button
                          onClick={() => handleTriggerBulkRestore('request')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restore Selected ({selectedIds.size})</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTriggerBulkArchive('request')}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          <span>Archive Selected ({selectedIds.size})</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleTriggerBulkDelete('request')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-rose-600/20 active:scale-95"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete Permanently ({selectedIds.size})</span>
                      </button>
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Card List View (< md) */}
              <div className="md:hidden space-y-3">
                {(() => {
                  const filtered = requests.filter(r => {
                    if (fundSourceFilter === 'main_funds') return r.fundSource === 'main_funds' || (!r.fundSource)
                    if (fundSourceFilter === 'parish') return r.fundSource === 'parish'
                    if (fundSourceFilter === 'outside') return r.fundSource === 'outside'
                    return true
                  })

                  if (requests.length > 0) {
                    return (
                      <>
                        <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                          <label className="flex items-center gap-2 cursor-pointer font-medium">
                            <input
                              type="checkbox"
                              checked={filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))}
                              onChange={() => handleSelectAll(filtered.map(r => r.id))}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                            />
                            <span>Select All ({filtered.length})</span>
                          </label>
                          <span className="text-[11px] font-bold text-gray-400">{filtered.length} of {requests.length} Requests</span>
                        </div>

                        {filtered.length === 0 ? (
                          <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-2xl border border-gray-200">
                            No requests found matching the "{fundSourceFilter === 'parish' ? 'Parish' : fundSourceFilter === 'outside' ? 'Outside' : 'Main Funds'}" filter.
                          </div>
                        ) : (
                          filtered.map((req, idx) => (
                            <div
                              key={req.id}
                              className={`bg-white rounded-2xl border p-4 shadow-2xs space-y-3 transition-all ${
                                req.isArchived ? 'opacity-70 bg-gray-50 border-gray-200' : 'border-gray-200'
                              } ${selectedIds.has(req.id) ? 'ring-2 ring-blue-500/30 border-blue-300 bg-blue-50/20' : ''}`}
                            >
                              {/* Top Row: Select, Reference, Fund Source & Status */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <input
                                    type="checkbox"
                                    checked={selectedIds.has(req.id)}
                                    onChange={() => handleToggleSelect(req.id)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                  />
                                  <span className="font-mono font-bold text-xs text-gray-950">
                                    {req.referenceNumber}
                                  </span>
                                  {req.fundSource === 'parish' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Parish
                                    </span>
                                  ) : req.fundSource === 'outside' ? (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                      Outside
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                      Main Funds
                                    </span>
                                  )}
                                  {req.fundSource === 'parish' && req.parishApprovedByFr && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-0.5">
                                      <span>✓ Fr. Approved</span>
                                    </span>
                                  )}
                                  {req.isArchived && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                      Archived
                                    </span>
                                  )}
                                </div>

                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  req.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                  req.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  req.status === 'released' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                  req.status === 'liquidated' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                  req.status === 'closed' ? 'bg-gray-100 text-gray-700 border border-gray-200' :
                                  req.status === 'cancelled' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                                  req.status === 'voided' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                  'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {req.status === 'released' ? 'Waiting for Liquidation' : req.status}
                                </span>
                              </div>

                      {/* Request Details */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-sm text-gray-900 leading-snug">{req.title}</h4>
                        </div>
                        {req.targetEventName && (
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                              Event: {req.targetEventName}
                            </span>
                          </div>
                        )}
                        {req.purpose && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{req.purpose}</p>
                        )}
                        {req.fundSource === 'parish' && (req.parishOfficeReceivedBy || req.parishOfficeDisbursedBy) && (
                          <div className="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded-lg text-[11px] space-y-0.5">
                            <div className="font-bold text-emerald-900 flex items-center gap-1 text-[10px] uppercase">
                              <svg className="w-3 h-3 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                              <span>Parish Office Handover</span>
                            </div>
                            <div className="text-emerald-950 font-medium">
                              Received by: <strong>{req.parishOfficeReceivedBy || req.releasedToName}</strong>
                              {req.parishOfficeDisbursedBy && <span className="text-emerald-700"> (from {req.parishOfficeDisbursedBy})</span>}
                            </div>
                          </div>
                        )}
                        {req.status === 'released' && req.liquidationRevisionReason && (
                          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[10px] uppercase">
                              <svg className="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>Revision Requested {req.liquidationRevisionRequestedByName ? `by ${req.liquidationRevisionRequestedByName}` : ''}</span>
                            </div>
                            <p className="text-xs text-amber-900 font-medium">"{req.liquidationRevisionReason}"</p>
                          </div>
                        )}
                      </div>

                      {/* Info & Amount Badges */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-gray-100">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-gray-400 block uppercase">Requester</span>
                          <span className="font-semibold text-gray-800 text-[11px] truncate block">
                            {req.requestedByName}
                          </span>
                        </div>
                        <div className="space-y-0.5 text-right">
                          <span className="text-[10px] font-semibold text-gray-400 block uppercase">Requested Amount</span>
                          <span className="font-black text-blue-700 font-mono text-sm block">
                            ₱{req.requestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {req.dateNeeded && (
                          <div className="col-span-2 flex items-center justify-between text-[11px] text-gray-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                            <span>Date Needed: <strong>{req.dateNeeded}</strong></span>
                            {req.releasedAmount !== undefined && req.releasedAmount > 0 && (
                              <span className="text-amber-800 font-semibold">
                                Disbursed: ₱{req.releasedAmount.toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rejection input when triggered on mobile */}
                      {showRejectionInput === req.id && (
                        <div className="p-2.5 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2 animate-fade-in">
                          <label className="block text-[10px] font-bold uppercase text-rose-800">Rejection Reason</label>
                          <input
                            type="text"
                            placeholder="Reason for rejection..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full text-xs p-2 border border-rose-300 rounded-lg bg-white focus:ring-2 focus:ring-rose-500"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setShowRejectionInput(null); setRejectionReason(''); }}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectRequest(req.id)}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer"
                            >
                              Confirm Rejection
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action Bar for Mobile */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                        {req.isArchived ? (
                          <div className="flex items-center gap-2 w-full">
                            <button
                              onClick={() => handleRestoreRequest(req.id)}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              <span>Restore</span>
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ isOpen: true, id: req.id, type: 'request' })}
                              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
                            >
                              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Primary Lifecycle Button */}
                            <div className="flex-1 min-w-[130px]">
                              {req.status === 'pending' && (
                                isSelfRequest(req) ? (
                                  <div
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed"
                                    title="Self-approval not permitted. Another administrator must approve your fund request."
                                  >
                                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    <span>Requester (Self)</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleApproveRequest(req.id)}
                                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Approve</span>
                                  </button>
                                )
                              )}

                              {req.status === 'approved' && (
                                <button
                                  onClick={() => handleReleaseOpen(req)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm shadow-amber-600/20 transition cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  <span>Release Funds</span>
                                </button>
                              )}

                              {req.status === 'released' && (
                                <button
                                  type="button"
                                  onClick={() => handleLiquidationOpen(req)}
                                  className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white ${
                                    req.liquidationRevisionReason ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                  } rounded-xl shadow-sm transition cursor-pointer`}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                  </svg>
                                  <span>{req.liquidationRevisionReason ? 'Edit & Re-liquidate' : 'Liquidate'}</span>
                                </button>
                              )}

                              {req.status === 'liquidated' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewModal(req)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/20 transition cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Review & Close</span>
                                </button>
                              )}

                              {req.status === 'closed' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReviewModal(req)}
                                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>View & Re-review</span>
                                </button>
                              )}

                              {(req.status === 'cancelled' || req.status === 'voided' || req.status === 'rejected') && (
                                <button
                                  type="button"
                                  onClick={() => setHistoryRequest(req)}
                                  className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition cursor-pointer"
                                >
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>Workflow History</span>
                                </button>
                              )}
                            </div>

                            {/* History Icon Button */}
                            {req.status !== 'cancelled' && req.status !== 'voided' && req.status !== 'rejected' && (
                              <button
                                type="button"
                                onClick={() => setHistoryRequest(req)}
                                className="inline-flex items-center justify-center p-2 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition cursor-pointer shadow-2xs"
                                title="Workflow History"
                              >
                                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </button>
                            )}

                            {/* Dropdown Menu Container */}
                            <div className="relative action-menu-container">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setActionMenuReqId(actionMenuReqId === req.id ? null : req.id)
                                }}
                                className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-bold border rounded-xl transition-all cursor-pointer shadow-2xs ${
                                  actionMenuReqId === req.id
                                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <span>Actions</span>
                                <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>

                              {actionMenuReqId === req.id && (
                                <div className={`absolute right-0 ${idx > 0 && (idx >= filtered.length - 2 || filtered.length <= 3) ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'} w-56 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xl z-50 py-1 text-xs animate-fade-in divide-y divide-slate-100`}>
                                  {/* Group: PDF Documents */}
                                  <div className="py-1">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      Documents & Exports
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuReqId(null)
                                        setRequisitionExportRequest(req)
                                        setIsRequisitionExportOpen(true)
                                      }}
                                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-blue-700 font-semibold cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span>Requisition PDF</span>
                                    </button>

                                    {(req.status === 'liquidated' || req.status === 'closed' || !!req.totalSpent || (req.budgetSources && req.budgetSources.length > 0)) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          setLiquidationExportRequest(req)
                                          setIsLiquidationExportOpen(true)
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                        <span>Liquidation PDF</span>
                                      </button>
                                    )}
                                  </div>

                                  {/* Group: Workflow Operations */}
                                  <div className="py-1">
                                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                      Management
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuReqId(null)
                                        setHistoryRequest(req)
                                      }}
                                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Workflow History</span>
                                    </button>

                                    {/* Edit Details (Draft, Pending, Approved, Rejected) */}
                                    {['draft', 'pending', 'approved', 'rejected'].includes(req.status) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          handleOpenEditRequestModal(req)
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span>Edit Details</span>
                                      </button>
                                    )}

                                    {req.status === 'liquidated' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            handleOpenReviewModal(req)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-emerald-700 font-semibold cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span>Review & Audit</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            handleLiquidationOpen(req)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                          <span>Edit Liquidation</span>
                                        </button>
                                      </>
                                    )}

                                    {req.status === 'closed' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            handleOpenReviewModal(req)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-emerald-700 font-semibold cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span>View & Re-review</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            handleOpenReopenModal(req)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                          </svg>
                                          <span>Reopen for Review</span>
                                        </button>
                                      </>
                                    )}

                                    {req.status === 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          setShowRejectionInput(req.id)
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <span>Reject Request</span>
                                      </button>
                                    )}

                                    {(req.status === 'pending' || req.status === 'approved') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          handleOpenCancelModal(req)
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                        <span>Cancel Request</span>
                                      </button>
                                    )}

                                    {(req.status === 'released' || req.status === 'liquidated') && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          handleOpenVoidModal(req)
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                        <span>Void Transaction</span>
                                      </button>
                                    )}

                                    {/* Delete Unreleased / Mistaken Request */}
                                    {['draft', 'pending', 'rejected', 'cancelled'].includes(req.status) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActionMenuReqId(null)
                                          setDeleteConfirm({ isOpen: true, id: req.id, type: 'request' })
                                        }}
                                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer"
                                      >
                                        <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span>Delete Request</span>
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActionMenuReqId(null)
                                        handleArchiveRequest(req.id)
                                      }}
                                      className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                      </svg>
                                      <span>Archive</span>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </>
            )
          }
          return (
            <div className="p-8 text-center text-gray-400 font-medium italic bg-white rounded-2xl border border-gray-200">
              No fund requests found.
            </div>
          )
        })()}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block bg-white rounded-xl border border-gray-200 shadow-2xs overflow-x-auto min-h-[380px] pb-28">
        <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-[850px] [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={(() => {
                    const filtered = requests.filter(r => {
                      if (fundSourceFilter === 'main_funds') return r.fundSource === 'main_funds' || (!r.fundSource)
                      if (fundSourceFilter === 'parish') return r.fundSource === 'parish'
                      if (fundSourceFilter === 'outside') return r.fundSource === 'outside'
                      return true
                    })
                    return filtered.length > 0 && filtered.every(r => selectedIds.has(r.id))
                  })()}
                  onChange={() => {
                    const filtered = requests.filter(r => {
                      if (fundSourceFilter === 'main_funds') return r.fundSource === 'main_funds' || (!r.fundSource)
                      if (fundSourceFilter === 'parish') return r.fundSource === 'parish'
                      if (fundSourceFilter === 'outside') return r.fundSource === 'outside'
                      return true
                    })
                    handleSelectAll(filtered.map(r => r.id))
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                />
              </th>
              <th className="p-3">Reference No</th>
              <th className="p-3">Title & Log</th>
              <th className="p-3">Requester</th>
              <th className="p-3">Amount</th>
              <th className="p-3">Status</th>
              <th className="p-3">Action Workflow</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const filtered = requests.filter(r => {
                if (fundSourceFilter === 'main_funds') return r.fundSource === 'main_funds' || (!r.fundSource)
                if (fundSourceFilter === 'parish') return r.fundSource === 'parish'
                if (fundSourceFilter === 'outside') return r.fundSource === 'outside'
                return true
              })

              if (filtered.length === 0) {
                return (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-400 font-medium italic">
                      {requests.length === 0 
                        ? 'No fund requests found.'
                        : `No fund requests found matching the "${fundSourceFilter === 'parish' ? 'Parish' : fundSourceFilter === 'outside' ? 'Outside' : 'Main Funds'}" filter.`}
                    </td>
                  </tr>
                )
              }

              return filtered.map((req, idx) => (
                <tr key={req.id} className={`border-b border-gray-100 hover:bg-gray-50/50 group ${req.isArchived ? 'opacity-60 bg-gray-50' : ''} ${selectedIds.has(req.id) ? 'bg-blue-50/40' : ''}`}>
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(req.id)}
                      onChange={() => handleToggleSelect(req.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                    />
                  </td>
                  <td className="p-3 font-mono font-bold text-gray-950 whitespace-nowrap">
                    {req.referenceNumber}
                    {req.isArchived && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-800">{req.title}</span>
                      {req.fundSource === 'parish' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Parish
                        </span>
                      ) : req.fundSource === 'outside' ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          Outside
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          Main Funds
                        </span>
                      )}
                      {req.fundSource === 'parish' && req.parishApprovedByFr && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-0.5">
                          <span>✓ Fr. Approved</span>
                        </span>
                      )}
                      {req.targetEventName && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                          Event: {req.targetEventName}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setHistoryRequest(req)}
                        className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-bold text-[10px] px-2 py-0.5 rounded-md bg-blue-50/80 border border-blue-200/80 hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>History</span>
                      </button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{req.purpose}</div>
                    {req.fundSource === 'parish' && (req.parishOfficeReceivedBy || req.parishOfficeDisbursedBy) && (
                      <div className="mt-1 text-[11px] text-emerald-800 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>
                          Office Handover: Received by <strong>{req.parishOfficeReceivedBy || req.releasedToName}</strong>
                          {req.parishOfficeDisbursedBy && <span className="text-gray-500"> (from {req.parishOfficeDisbursedBy})</span>}
                        </span>
                      </div>
                    )}
                    {req.status === 'released' && req.liquidationRevisionReason && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-0.5 max-w-md">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-800">
                          <svg className="w-3 h-3 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span>Revision Requested {req.liquidationRevisionRequestedByName ? `by ${req.liquidationRevisionRequestedByName}` : ''}</span>
                        </div>
                        <div className="text-amber-950 font-medium text-[11px]">"{req.liquidationRevisionReason}"</div>
                      </div>
                    )}
                  </td>
                  <td className="p-3">{req.requestedByName}</td>
                  <td className="p-3 font-bold">₱{req.requestedAmount.toLocaleString()}</td>
                  <td className="p-3">
                    {req.status === 'released' && req.liquidationRevisionReason ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-900 border border-amber-300">
                        Revision Req.
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                        req.status === 'rejected' ? 'bg-red-50 text-red-700' :
                        req.status === 'released' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        req.status === 'liquidated' ? 'bg-indigo-50 text-indigo-700' :
                        req.status === 'closed' ? 'bg-gray-100 text-gray-600' :
                        req.status === 'cancelled' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                        req.status === 'voided' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {req.status === 'released' ? 'Waiting for Liquidation' : req.status}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {req.isArchived ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleRestoreRequest(req.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ isOpen: true, id: req.id, type: 'request' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                        >
                          <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                                {/* 1. Primary Lifecycle Action Button */}
                                {req.status === 'pending' && (
                                  isSelfRequest(req) ? (
                                    <div
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl cursor-not-allowed"
                                      title="Self-approval not permitted. Another administrator must approve your fund request."
                                    >
                                      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                      <span>Requester (Self)</span>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleApproveRequest(req.id)}
                                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span>Approve</span>
                                    </button>
                                  )
                                )}

                                {req.status === 'approved' && (
                                  <button
                                    onClick={() => handleReleaseOpen(req)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md shadow-amber-600/20 transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                    <span>Release Funds</span>
                                  </button>
                                )}

                                {req.status === 'released' && (
                                  <button
                                    type="button"
                                    onClick={() => handleLiquidationOpen(req)}
                                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white ${
                                      req.liquidationRevisionReason ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                                    } rounded-xl shadow-md transition cursor-pointer`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                    <span>{req.liquidationRevisionReason ? 'Edit & Re-liquidate' : 'Liquidate'}</span>
                                  </button>
                                )}

                                {req.status === 'liquidated' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReviewModal(req)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>Review & Close</span>
                                  </button>
                                )}

                                {req.status === 'closed' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReviewModal(req)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition cursor-pointer"
                                  >
                                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>View & Re-review</span>
                                  </button>
                                )}

                                {/* 2. Actions & PDF Menu Dropdown */}
                                <div className="relative action-menu-container">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActionMenuReqId(actionMenuReqId === req.id ? null : req.id)
                                    }}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold border rounded-xl transition-all cursor-pointer shadow-2xs ${
                                      actionMenuReqId === req.id
                                        ? 'bg-slate-100 border-slate-300 text-slate-900'
                                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                    }`}
                                  >
                                    <span>Actions</span>
                                    <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>

                                  {actionMenuReqId === req.id && (
                                    <div className={`absolute right-0 ${idx > 0 && (idx >= filtered.length - 2 || filtered.length <= 3) ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'} w-56 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-2xl z-50 py-1 text-xs animate-fade-in divide-y divide-slate-100`}>
                                      {/* Group: PDF Documents */}
                                      <div className="py-1">
                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                          Documents & Exports
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            setRequisitionExportRequest(req)
                                            setIsRequisitionExportOpen(true)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-blue-700 font-semibold cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                          <span>Requisition PDF</span>
                                        </button>

                                        {(req.status === 'liquidated' || req.status === 'closed' || !!req.totalSpent || (req.budgetSources && req.budgetSources.length > 0)) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              setLiquidationExportRequest(req)
                                              setIsLiquidationExportOpen(true)
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                            </svg>
                                            <span>Liquidation PDF</span>
                                          </button>
                                        )}
                                      </div>

                                      {/* Group: Workflow Operations */}
                                      <div className="py-1">
                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                          Management
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            setHistoryRequest(req)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <span>Workflow History</span>
                                        </button>

                                        {/* Edit Details (Draft, Pending, Approved, Rejected) */}
                                        {['draft', 'pending', 'approved', 'rejected'].includes(req.status) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              handleOpenEditRequestModal(req)
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            <span>Edit Details</span>
                                          </button>
                                        )}

                                        {req.status === 'liquidated' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActionMenuReqId(null)
                                                handleOpenReviewModal(req)
                                              }}
                                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-emerald-700 font-semibold cursor-pointer"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              <span>Review & Audit</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActionMenuReqId(null)
                                                handleLiquidationOpen(req)
                                              }}
                                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-indigo-50 text-indigo-700 font-semibold cursor-pointer"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                              </svg>
                                              <span>Edit Liquidation</span>
                                            </button>
                                          </>
                                        )}

                                        {req.status === 'closed' && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActionMenuReqId(null)
                                                handleOpenReviewModal(req)
                                              }}
                                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-emerald-700 font-semibold cursor-pointer"
                                            >
                                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              <span>View & Re-review</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActionMenuReqId(null)
                                                handleOpenReopenModal(req)
                                              }}
                                              className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-800 font-semibold cursor-pointer"
                                            >
                                              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                              </svg>
                                              <span>Reopen for Review</span>
                                            </button>
                                          </>
                                        )}

                                        {req.status === 'pending' && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              setShowRejectionInput(req.id)
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>Reject Request</span>
                                          </button>
                                        )}

                                        {(req.status === 'pending' || req.status === 'approved') && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              handleOpenCancelModal(req)
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                            <span>Cancel Request</span>
                                          </button>
                                        )}

                                        {(req.status === 'released' || req.status === 'liquidated') && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              handleOpenVoidModal(req)
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-medium cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                            </svg>
                                            <span>Void Transaction</span>
                                          </button>
                                        )}

                                        {/* Delete Unreleased / Mistaken Request */}
                                        {['draft', 'pending', 'rejected', 'cancelled'].includes(req.status) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActionMenuReqId(null)
                                              setDeleteConfirm({ isOpen: true, id: req.id, type: 'request' })
                                            }}
                                            className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-rose-50 text-rose-700 font-semibold cursor-pointer"
                                          >
                                            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                            <span>Delete Request</span>
                                          </button>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActionMenuReqId(null)
                                            handleArchiveRequest(req.id)
                                          }}
                                          className="w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-500 hover:text-red-600 font-medium cursor-pointer"
                                        >
                                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                          </svg>
                                          <span>Archive</span>
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {showRejectionInput === req.id && (
                              <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fade-in">
                                <input
                                  type="text"
                                  placeholder="Reason for rejection..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-rose-500"
                                />
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => { setShowRejectionInput(null); setRejectionReason(''); }}
                                    className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectRequest(req.id)}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold shadow-xs cursor-pointer"
                                  >
                                    Confirm Rejection
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Ledger Tab */}
          {activeTab === 'ledger' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Chronological Finance Ledger</h3>
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-max [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-3">Date</th>
                      <th className="p-3">Reference No</th>
                      <th className="p-3">Description</th>
                      <th className="p-3">In</th>
                      <th className="p-3">Out</th>
                      <th className="p-3">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="p-3">{e.date}</td>
                        <td className="p-3 font-mono font-bold">{e.referenceNumber || '-'}</td>
                        <td className="p-3">{e.description}</td>
                        <td className="p-3 font-semibold text-emerald-600">{e.amountIn > 0 ? `+₱${e.amountIn.toLocaleString()}` : '-'}</td>
                        <td className="p-3 font-semibold text-red-600">{e.amountOut > 0 ? `-₱${e.amountOut.toLocaleString()}` : '-'}</td>
                        <td className="p-3 font-black text-gray-900">₱{e.runningBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && reportData && (
            <div className="space-y-6 animate-fade-in">
              {/* Report Header Filter & Actions */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    Financial Statement Coverage
                  </span>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">From</span>
                      <input
                        type="date"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="text-xs font-bold bg-transparent text-slate-800 outline-none cursor-pointer"
                      />
                    </div>
                    <span className="text-slate-400 font-bold text-xs">to</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">To</span>
                      <input
                        type="date"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="text-xs font-bold bg-transparent text-slate-800 outline-none cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button 
                    onClick={handleExportCSV} 
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold shadow-2xs transition cursor-pointer flex-1 sm:flex-none"
                  >
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Export CSV</span>
                  </button>
                  <button 
                    onClick={handleExportPDF} 
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 transition cursor-pointer flex-1 sm:flex-none"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards (Matching Dashboard Card Design) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Opening Balance */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Opening Balance</span>
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
                      ₱{reportData.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Carried forward before period
                    </span>
                  </div>
                </div>

                {/* 2. Total Inflow */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Total Inflow</span>
                    <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
                      ₱{reportData.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Collections, donations & grants
                    </span>
                  </div>
                </div>

                {/* 3. Total Outflow */}
                <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Total Outflow</span>
                    <div className="p-2 rounded-xl bg-red-50 border border-red-100 text-red-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="text-2xl sm:text-3xl font-black text-red-600 font-mono">
                      ₱{reportData.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Direct expenses & releases
                    </span>
                  </div>
                </div>

                {/* 4. Closing Balance */}
                <div className={`p-5 rounded-2xl border transition-all shadow-2xs flex flex-col justify-between ${
                  reportData.closingBalance > 0
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                    : reportData.closingBalance < 0
                    ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Closing Balance</span>
                    <div className={`p-2 rounded-xl border ${
                      reportData.closingBalance > 0
                        ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                        : reportData.closingBalance < 0
                        ? 'bg-rose-100 border-rose-200 text-rose-700'
                        : 'bg-blue-50 border-blue-100 text-blue-600'
                    }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className={`text-2xl sm:text-3xl font-black font-mono ${
                      reportData.closingBalance > 0 ? 'text-emerald-700' : reportData.closingBalance < 0 ? 'text-rose-700' : 'text-gray-900'
                    }`}>
                      ₱{reportData.closingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 block mt-1">
                      Opening + Inflow − Outflow
                    </span>
                  </div>
                </div>
              </div>

              {/* Categorized Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Incomes Breakdown */}
                <div className="p-5 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">Incomes by Category</h4>
                        <span className="text-[10px] text-gray-400 font-semibold">Inflow revenue sources</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ₱{reportData.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {reportData.incomeByCategory && reportData.incomeByCategory.filter((c: any) => c.total > 0).length > 0 ? (
                    <div className="space-y-3">
                      {reportData.incomeByCategory.filter((c: any) => c.total > 0).map((c: any) => {
                        const percent = reportData.totalIncome > 0 ? Math.round((c.total / reportData.totalIncome) * 100) : 0
                        return (
                          <div key={c.categoryId} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-800">{c.categoryName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 font-mono">({percent}%)</span>
                                <span className="font-black text-emerald-600 font-mono">
                                  ₱{c.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium italic">
                      No income recorded in this period.
                    </div>
                  )}
                </div>

                {/* Expenses Breakdown */}
                <div className="p-5 sm:p-6 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-gray-800 tracking-wider">Expenses by Category</h4>
                        <span className="text-[10px] text-gray-400 font-semibold">Outflow disbursements</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-700 border border-rose-200">
                      ₱{reportData.totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {reportData.expenseByCategory && reportData.expenseByCategory.filter((c: any) => c.total > 0).length > 0 ? (
                    <div className="space-y-3">
                      {reportData.expenseByCategory.filter((c: any) => c.total > 0).map((c: any) => {
                        const percent = reportData.totalExpenses > 0 ? Math.round((c.total / reportData.totalExpenses) * 100) : 0
                        return (
                          <div key={c.categoryId} className="p-3 bg-slate-50/60 rounded-xl border border-slate-100 space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-800">{c.categoryName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400 font-mono">({percent}%)</span>
                                <span className="font-black text-rose-600 font-mono">
                                  ₱{c.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-rose-500 h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-gray-400 text-xs font-medium italic">
                      No expenses recorded in this period.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Periods Tab */}
          {activeTab === 'closing' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900">Financial Periods Closing</h3>
              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-max [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-3">Period</th>
                      <th className="p-3">Lock Status</th>
                      <th className="p-3">Closed By</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Add current month option dynamically if not registered */}
                    {periods.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50 group">
                        <td className="p-3 font-bold">{p.id}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.status === 'closed' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-gray-500">{p.closedByName || '-'}</td>
                        <td className="p-3">
                          {p.status === 'closed' ? (
                            <button
                              onClick={() => handleReopenPeriod(p.id)}
                              className="inline-flex items-center gap-1 text-xs text-indigo-700 hover:text-indigo-800 font-bold px-2.5 py-1 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                              <span>Reopen Period</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleClosePeriod(p.id)}
                              className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                              <span>Lock Period</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {/* Allow closing current month if not listed yet */}
                    {!periods.find(p => p.id === currentMonthStr) && (
                      <tr className="border-b border-gray-100">
                        <td className="p-3 font-bold">{currentMonthStr}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">Open</span></td>
                        <td className="p-3">-</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleClosePeriod(currentMonthStr)}
                            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-800 font-bold px-2.5 py-1 bg-rose-50/80 hover:bg-rose-100 border border-rose-200/80 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            <svg className="w-3.5 h-3.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            <span>Lock Period</span>
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}

      {/* Custom Dialog Modal (Alert / Confirm) */}
      {dialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                Notice
              </span>
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900">{dialog.title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed mt-1">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              {dialog.isConfirm && (
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  dialog.onConfirm()
                  setDialog(null)
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fund Request Workflow History Modal */}
      {historyRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Audit Trail
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">Fund Request History</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-gray-500 font-mono">Ref: {historyRequest.referenceNumber}</span>
                  {historyRequest.fundSource === 'parish' ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Parish Funds
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      Main Funds
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryRequest(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="relative border-l-2 border-indigo-100 pl-4 ml-2 space-y-5 py-2">
                {/* 1. Request submission */}
                <div className="relative">
                  <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                  <div className="text-xs font-bold text-gray-900">Request Submitted</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    Requested amount: <strong className="text-gray-800">₱{historyRequest.requestedAmount.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.requestedByName}</strong>
                  </div>
                </div>

                {/* 2. Approval or Rejection */}
                {historyRequest.approvedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-emerald-700">Approved</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Approved by <strong className="text-gray-800">{historyRequest.approvedByName}</strong> {historyRequest.approvalRemarks ? `("${historyRequest.approvalRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {historyRequest.rejectedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-red-600">Rejected</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Rejected by <strong className="text-gray-800">{historyRequest.rejectedByName}</strong> {historyRequest.rejectionReason ? ` - Reason: "${historyRequest.rejectionReason}"` : ''}
                    </div>
                  </div>
                )}

                {/* 3. Funds Released */}
                {historyRequest.releasedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-amber-700">Funds Released</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Disbursed <strong className="text-gray-800">₱{historyRequest.releasedAmount?.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.releasedByName}</strong> to <strong className="text-gray-800">{historyRequest.releasedToName || historyRequest.requestedByName}</strong> on {historyRequest.releasedDate} {historyRequest.releaseRemarks ? `("${historyRequest.releaseRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {/* 4. Liquidation */}
                {historyRequest.liquidatedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-indigo-700">Liquidation Submitted</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Reported by <strong className="text-gray-800">{historyRequest.liquidatedByName}</strong> showing <strong className="text-gray-800">₱{historyRequest.totalSpent?.toLocaleString()}</strong> spent and <strong className="text-gray-800">₱{historyRequest.returnedAmount?.toLocaleString()}</strong> returned. {historyRequest.liquidationRemarks ? `("${historyRequest.liquidationRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {/* 5. Closed */}
                {historyRequest.liquidationReviewedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-gray-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-700">Workflow Closed</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Reviewed & verified closed by <strong className="text-gray-800">{historyRequest.liquidationReviewedByName}</strong> {historyRequest.liquidationReviewRemarks ? `("${historyRequest.liquidationReviewRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {/* 5.1 Reopened for Review */}
                {historyRequest.liquidationReopenedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-amber-700">Reopened for Review</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Reopened by <strong className="text-gray-800">{historyRequest.liquidationReopenedByName}</strong> {historyRequest.liquidationReopenReason ? ` - Reason: "${historyRequest.liquidationReopenReason}"` : ''}
                    </div>
                  </div>
                )}

                {/* 6. Cancelled */}
                {historyRequest.cancelledByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-slate-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-slate-700">Request Cancelled</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Cancelled by <strong className="text-gray-800">{historyRequest.cancelledByName}</strong> {historyRequest.cancellationReason ? ` - Reason: "${historyRequest.cancellationReason}"` : ''}
                    </div>
                  </div>
                )}

                {/* 7. Voided */}
                {historyRequest.voidedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-rose-700">Request Voided</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Voided by <strong className="text-gray-800">{historyRequest.voidedByName}</strong> {historyRequest.voidReason ? ` - Reason: "${historyRequest.voidReason}"` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-3.5 border-t border-gray-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setHistoryRequest(null)}
                className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl cursor-pointer shadow-2xs transition"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record / Edit Income Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  General Ledger Inflow
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">
                  {editIncomeItem ? 'Edit Income Transaction' : 'Record Inflow Receipt'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setIsIncomeModalOpen(false); setEditIncomeItem(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveIncome} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Amount & Classification Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Amount & Classification</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Amount (₱) *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="0.00" 
                      value={incAmount} 
                      onChange={(e) => handleNumberChange(e.target.value, setIncAmount)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <CustomSelect
                      label="Category"
                      required
                      value={incCategoryId}
                      onChange={(e) => setIncCategoryId(e.target.value)}
                      options={[
                        { value: '', label: '-- Choose Category --' },
                        ...categories.map(c => ({ value: c.id, label: c.name }))
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Source Name / Revenue Tag *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Mass Donation, Solicitation, Church Subsidy" 
                    value={incSource} 
                    onChange={(e) => setIncSource(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-xs" 
                  />
                </div>
              </div>

              {/* Transaction Metadata Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">2. Transaction Metadata</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Received From *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Name or Parish / Institution" 
                      value={incReceivedFrom} 
                      onChange={(e) => setIncReceivedFrom(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Transaction Date *</label>
                    <input 
                      type="date" 
                      required 
                      value={incDate} 
                      onChange={(e) => setIncDate(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-xs" 
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Description & Notes</label>
                  <textarea 
                    value={incDesc} 
                    onChange={(e) => setIncDesc(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 text-xs" 
                    rows={2}
                    placeholder="Additional details, official receipt or voucher reference..."
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsIncomeModalOpen(false); setEditIncomeItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Saving...' : editIncomeItem ? 'Update Income' : 'Save Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record / Edit Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                  General Ledger Outflow
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">
                  {editExpenseItem ? 'Edit Direct Expense' : 'Record Direct Outflow'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setIsExpenseModalOpen(false); setEditExpenseItem(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveExpense} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Amount & Category Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Outflow & Category</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Amount (₱) *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="0.00" 
                      value={expAmount} 
                      onChange={(e) => handleNumberChange(e.target.value, setExpAmount)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 font-bold text-xs" 
                    />
                  </div>
                  <div>
                    <CustomSelect
                      label="Category"
                      required
                      value={expCategoryId}
                      onChange={(e) => setExpCategoryId(e.target.value)}
                      options={[
                        { value: '', label: '-- Choose Category --' },
                        ...categories.map(c => ({ value: c.id, label: c.name }))
                      ]}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Spent By (Person / Officer) *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Juan Dela Cruz" 
                    value={expSpentByName} 
                    onChange={(e) => setExpSpentByName(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 font-semibold text-xs" 
                  />
                </div>
              </div>

              {/* Purpose & Date Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">2. Purpose & Transaction Date</h5>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Transaction Date *</label>
                  <input 
                    type="date" 
                    required 
                    value={expDate} 
                    onChange={(e) => setExpDate(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 font-semibold text-xs" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Expense Purpose Description *</label>
                  <textarea 
                    required 
                    value={expDesc} 
                    onChange={(e) => setExpDesc(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 text-xs" 
                    rows={2}
                    placeholder="Specific itemized description or reason for direct disbursement..."
                  ></textarea>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsExpenseModalOpen(false); setEditExpenseItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Saving...' : editExpenseItem ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Category Modal */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                  Treasury Classification
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">
                  {editCategoryItem ? 'Edit Category' : 'Add Finance Category'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => { setIsCategoryModalOpen(false); setEditCategoryItem(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveCategory} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Category Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Utility Bills, Donations, Liturgical Supplies" 
                    value={catName} 
                    onChange={(e) => setCatName(e.target.value)} 
                    className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 font-semibold text-xs" 
                  />
                </div>
                <div>
                  <CustomSelect
                    label="Display Color Accent"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    options={[
                      { value: 'blue', label: 'Blue' },
                      { value: 'emerald', label: 'Emerald Green' },
                      { value: 'red', label: 'Crimson Red' },
                      { value: 'amber', label: 'Amber Yellow' },
                      { value: 'purple', label: 'Royal Purple' }
                    ]}
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsCategoryModalOpen(false); setEditCategoryItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md shadow-purple-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Saving...' : editCategoryItem ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  Procurement & Requisition
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">Request Allocation Funds</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleCreateRequest} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Top Metadata Grid */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Request Details & Source</h5>
                
                {/* Fund Source Selection Cards */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1.5">Request Source / Charge To *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setReqFundSource('main_funds')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        reqFundSource === 'main_funds'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${reqFundSource === 'main_funds' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${reqFundSource === 'main_funds' ? 'text-blue-950' : 'text-slate-800'}`}>
                            Main Ministry Funds
                          </span>
                          {reqFundSource === 'main_funds' && (
                            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Disbursed from MAS internal treasury balance
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReqFundSource('parish')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        reqFundSource === 'parish'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${reqFundSource === 'parish' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${reqFundSource === 'parish' ? 'text-emerald-950' : 'text-slate-800'}`}>
                            Parish Funds
                          </span>
                          {reqFundSource === 'parish' && (
                            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Requested from Parish Priest / Parish Treasury
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setReqFundSource('outside')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        reqFundSource === 'outside'
                          ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${reqFundSource === 'outside' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${reqFundSource === 'outside' ? 'text-purple-950' : 'text-slate-800'}`}>
                            Outside / Sponsor Funds
                          </span>
                          {reqFundSource === 'outside' && (
                            <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Sponsors or personal advances (Zero Ledger impact)
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Request Title *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Replenishing of Liturgical Supplies" 
                      value={reqTitle} 
                      onChange={(e) => setReqTitle(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Purpose / Intended Objective *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Detailed purpose" 
                      value={reqPurpose} 
                      onChange={(e) => setReqPurpose(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Date Needed *</label>
                    <input 
                      type="date" 
                      required 
                      value={reqDateNeeded} 
                      onChange={(e) => setReqDateNeeded(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">From (Requester Unit)</label>
                    <input 
                      type="text" 
                      value={reqFromMinistry} 
                      onChange={(e) => setReqFromMinistry(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Activity / Logistics Metadata */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">2. Logistics & Activity Info</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Participants</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or 15 Servers" 
                      value={reqParticipants} 
                      onChange={(e) => setReqParticipants(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Venue</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or Parish Hall" 
                      value={reqVenue} 
                      onChange={(e) => setReqVenue(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Assembly / Gathering Time</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or 6:00 AM" 
                      value={reqAssembly} 
                      onChange={(e) => setReqAssembly(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Expected Expenses Table */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>3. Expected Expenses Breakdown</span>
                    </h5>
                    <p className="text-[10px] text-gray-500">I-lista ang mga bibilhin o gastusin (tulad ng nasa requisition format).</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddReqExpenseRow}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>+ Add Item Row</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="p-2 text-left min-w-[140px]">Intended Use</th>
                        <th className="p-2 text-center min-w-[120px]">Unit Price</th>
                        <th className="p-2 text-center min-w-[110px]">Quantity</th>
                        <th className="p-2 text-right min-w-[100px]">Amount (₱)</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reqExpectedExpenses.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-gray-50/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. Candle Sticks"
                              value={item.intendedUse}
                              onChange={(e) => handleUpdateReqExpenseRow(idx, 'intendedUse', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. ₱175 per plastic"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateReqExpenseRow(idx, 'unitPrice', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-center"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. 2 plastic 6 pairs"
                              value={item.quantity}
                              onChange={(e) => handleUpdateReqExpenseRow(idx, 'quantity', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-center"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.amount !== undefined && item.amount !== null ? String(item.amount) : ''}
                              onChange={(e) => handleUpdateReqExpenseRow(idx, 'amount', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-right font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveReqExpenseRow(idx)}
                              className="text-gray-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td colSpan={3} className="p-2.5 text-slate-800 text-right uppercase text-[11px]">
                          Total Calculated Requisition Amount:
                        </td>
                        <td className="p-2.5 text-right font-black text-sm text-blue-700 font-mono">
                          ₱{reqExpectedExpenses.reduce((s, i) => s + parseAmount(i.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Description & Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Additional Notes / Description Explanation</label>
                <textarea 
                  value={reqDesc} 
                  onChange={(e) => setReqDesc(e.target.value)} 
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs" 
                  rows={2}
                  placeholder="Any further justifications or details..."
                ></textarea>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => setIsRequestModalOpen(false)} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Submitting...' : 'Submit Fund Requisition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fund Request Modal */}
      {isEditRequestModalOpen && editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                    Edit Requisition
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Status: {editingRequest.status}
                  </span>
                </div>
                <h4 className="text-base font-black text-gray-900 mt-0.5">Edit Fund Request Details</h4>
                <p className="text-[10px] font-mono text-gray-500">Ref: {editingRequest.referenceNumber} • Requester: {editingRequest.requestedByName}</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsEditRequestModalOpen(false); setEditingRequest(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveEditRequest} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Fund Source Selection */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Channel & Core Request Info</h5>
                <div>
                  <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1.5">Fund Source / Channel *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditReqFundSource('main_funds')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        editReqFundSource === 'main_funds'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${editReqFundSource === 'main_funds' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${editReqFundSource === 'main_funds' ? 'text-blue-950' : 'text-slate-800'}`}>
                            Main Ministry Funds
                          </span>
                          {editReqFundSource === 'main_funds' && (
                            <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Disbursed from MAS internal treasury balance
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditReqFundSource('parish')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        editReqFundSource === 'parish'
                          ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${editReqFundSource === 'parish' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${editReqFundSource === 'parish' ? 'text-emerald-950' : 'text-slate-800'}`}>
                            Parish Funds
                          </span>
                          {editReqFundSource === 'parish' && (
                            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Requested from Parish Priest / Parish Treasury
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditReqFundSource('outside')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        editReqFundSource === 'outside'
                          ? 'bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${editReqFundSource === 'outside' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'}`}>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-black ${editReqFundSource === 'outside' ? 'text-purple-950' : 'text-slate-800'}`}>
                            Outside / Sponsor Funds
                          </span>
                          {editReqFundSource === 'outside' && (
                            <span className="h-2 w-2 rounded-full bg-purple-600"></span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Sponsors or personal advances (Zero Ledger impact)
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Request Title *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Replenishing of Liturgical Supplies" 
                      value={editReqTitle} 
                      onChange={(e) => setEditReqTitle(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Purpose / Intended Objective *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="Detailed purpose" 
                      value={editReqPurpose} 
                      onChange={(e) => setEditReqPurpose(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Date Needed *</label>
                    <input 
                      type="date" 
                      required 
                      value={editReqDateNeeded} 
                      onChange={(e) => setEditReqDateNeeded(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">From (Requester Unit)</label>
                    <input 
                      type="text" 
                      value={editReqFromMinistry} 
                      onChange={(e) => setEditReqFromMinistry(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Activity / Logistics Metadata */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">2. Logistics & Activity Info</h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Participants</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or 15 Servers" 
                      value={editReqParticipants} 
                      onChange={(e) => setEditReqParticipants(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Venue</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or Parish Hall" 
                      value={editReqVenue} 
                      onChange={(e) => setEditReqVenue(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Assembly / Gathering Time</label>
                    <input 
                      type="text" 
                      placeholder="e.g. N/A or 6:00 AM" 
                      value={editReqAssembly} 
                      onChange={(e) => setEditReqAssembly(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 font-semibold text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Expected Expenses Table */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>3. Expected Expenses Breakdown</span>
                    </h5>
                    <p className="text-[10px] text-gray-500">I-lista ang mga bibilhin o gastusin (tulad ng nasa requisition format).</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddEditReqExpenseRow}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg border border-blue-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>+ Add Item Row</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="p-2 text-left min-w-[140px]">Intended Use</th>
                        <th className="p-2 text-center min-w-[120px]">Unit Price</th>
                        <th className="p-2 text-center min-w-[110px]">Quantity</th>
                        <th className="p-2 text-right min-w-[100px]">Amount (₱)</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {editReqExpectedExpenses.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-gray-50/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. Candle Sticks"
                              value={item.intendedUse}
                              onChange={(e) => handleUpdateEditReqExpenseRow(idx, 'intendedUse', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. ₱175 per plastic"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateEditReqExpenseRow(idx, 'unitPrice', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-center"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. 2 plastic 6 pairs"
                              value={item.quantity}
                              onChange={(e) => handleUpdateEditReqExpenseRow(idx, 'quantity', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-center"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={item.amount !== undefined && item.amount !== null ? String(item.amount) : ''}
                              onChange={(e) => handleUpdateEditReqExpenseRow(idx, 'amount', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-right font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveEditReqExpenseRow(idx)}
                              className="text-gray-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                              title="Remove item"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold">
                      <tr>
                        <td colSpan={3} className="p-2.5 text-slate-800 text-right uppercase text-[11px]">
                          Total Calculated Requisition Amount:
                        </td>
                        <td className="p-2.5 text-right font-black text-sm text-blue-700 font-mono">
                          ₱{editReqExpectedExpenses.reduce((s, i) => s + parseAmount(i.amount), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Description & Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Additional Notes / Description Explanation</label>
                <textarea 
                  value={editReqDesc} 
                  onChange={(e) => setEditReqDesc(e.target.value)} 
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs" 
                  rows={2}
                  placeholder="Any further justifications or details..."
                ></textarea>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsEditRequestModalOpen(false); setEditingRequest(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Funds Modal */}
      {isReleaseModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                  selectedRequest.fundSource === 'parish'
                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    : 'text-amber-600 bg-amber-50 border-amber-100'
                }`}>
                  {selectedRequest.fundSource === 'parish' ? 'Parish Office Disbursement' : 'Disbursement Authorization'}
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">
                  {selectedRequest.fundSource === 'parish' ? 'Record Parish Cash Release & Handover' : 'Release Approved Allocation'}
                </h4>
                <p className="text-[10px] font-mono text-gray-500">Ref: {selectedRequest.referenceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsReleaseModalOpen(false); setSelectedRequest(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleReleaseSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Event Allocation Notice */}
              {selectedRequest.targetEventName && (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs text-indigo-950 leading-relaxed flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-600 text-white shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-black text-indigo-900 uppercase text-[10px] block tracking-wide">Event Budget Allocation</span>
                    <p className="text-indigo-800 text-[11px] mt-0.5">
                      Releasing these funds will automatically credit them to <strong>"{selectedRequest.targetEventName}"</strong> as Event Income in its financial ledger.
                    </p>
                  </div>
                </div>
              )}

              {/* Parish Workflow Notice */}
              {selectedRequest.fundSource === 'parish' && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-xs text-emerald-950 leading-relaxed flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-black text-emerald-900 uppercase text-[10px] block tracking-wide">Parish Fund Workflow Tracking</span>
                    <p className="text-emerald-800 text-[11px] mt-0.5">
                      Log who in the ministry received the cash from the Parish Office. Once recorded, status will transition to <strong>Waiting for Liquidation</strong>. This does not deduct from the ministry treasury ledger.
                    </p>
                  </div>
                </div>
              )}

              {/* Disbursement Details Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                  {selectedRequest.fundSource === 'parish' ? 'Parish Office Release & Handover Details' : 'Disbursement Details'}
                </h5>

                {selectedRequest.fundSource === 'parish' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                          Disbursed By (Parish Office / Secretary) *
                        </label>
                        <input
                          type="text"
                          required
                          value={relParishOfficeDisbursedBy}
                          onChange={(e) => setRelParishOfficeDisbursedBy(e.target.value)}
                          placeholder="e.g. Parish Secretary / Office Staff"
                          className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
                        />
                      </div>
                      <div>
                        <MemberCombobox
                          label="Received from Office By (Ministry Rep)"
                          placeholder="Search member or type recipient..."
                          value={relParishOfficeReceivedBy}
                          required
                          allowCustom={true}
                          onChange={(name) => setRelParishOfficeReceivedBy(name)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Amount Released (₱) *</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="0.00" 
                          value={relAmount} 
                          onChange={(e) => handleNumberChange(e.target.value, setRelAmount)} 
                          className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-bold text-xs" 
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">Requested: ₱{selectedRequest.requestedAmount.toLocaleString()}</span>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Release / Handover Date *</label>
                        <input 
                          type="date" 
                          required 
                          value={relDate} 
                          onChange={(e) => setRelDate(e.target.value)} 
                          className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-semibold text-xs" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Parish Office Voucher / Remarks</label>
                      <textarea 
                        value={relParishOfficeRemarks} 
                        onChange={(e) => setRelParishOfficeRemarks(e.target.value)} 
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 text-xs" 
                        rows={2}
                        placeholder="e.g. Office Voucher #1234, cash received in envelope..."
                      ></textarea>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <MemberCombobox
                          label="Released To (Person / Custodian)"
                          placeholder="Search member or type recipient..."
                          value={relToName}
                          required
                          allowCustom={true}
                          onChange={(name) => setRelToName(name)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Released Amount (₱) *</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="0.00" 
                          value={relAmount} 
                          onChange={(e) => handleNumberChange(e.target.value, setRelAmount)} 
                          className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 font-bold text-xs" 
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">Requested: ₱{selectedRequest.requestedAmount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Release Date *</label>
                      <input 
                        type="date" 
                        required 
                        value={relDate} 
                        onChange={(e) => setRelDate(e.target.value)} 
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 font-semibold text-xs" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Release Remarks / Voucher Notes</label>
                      <textarea 
                        value={relRemarks} 
                        onChange={(e) => setRelRemarks(e.target.value)} 
                        className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-xs" 
                        rows={2}
                        placeholder="Disbursement authorization note or reference number..."
                      ></textarea>
                    </div>
                  </>
                )}
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsReleaseModalOpen(false); setSelectedRequest(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition cursor-pointer ${
                    selectedRequest.fundSource === 'parish'
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  }`}
                >
                  {saving ? 'Recording Release...' : selectedRequest.fundSource === 'parish' ? 'Confirm Parish Release' : 'Execute Release'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Liquidation Modal */}
      {isLiquidationModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Liquidation Statement
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">Record Liquidation Expenditures</h4>
                <p className="text-[10px] font-mono text-gray-500">Voucher Ref: {selectedRequest.referenceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsLiquidationModalOpen(false); setSelectedRequest(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleLiquidationSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Header Info */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Liquidation Memo Header</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">To (Parish Priest / Addressee) *</label>
                    <input 
                      type="text" 
                      required 
                      value={liqTo} 
                      onChange={(e) => setLiqTo(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">From *</label>
                    <input 
                      type="text" 
                      required 
                      value={liqFrom} 
                      onChange={(e) => setLiqFrom(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Liquidation Date *</label>
                    <input 
                      type="date" 
                      required 
                      value={liqDate} 
                      onChange={(e) => setLiqDate(e.target.value)} 
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 font-semibold text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Activity / Requisition Title</label>
                    <input 
                      type="text" 
                      disabled
                      value={selectedRequest.title} 
                      className="w-full p-2.5 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 font-semibold text-xs" 
                    />
                  </div>
                </div>
              </div>

              {/* Live KPI Metric Cards */}
              {(() => {
                const curBudget = liqBudgetSources.reduce((s, b) => s + parseAmount(b.amount), 0)
                const curSpent = liqExpenses.reduce((s, e) => s + parseAmount(e.amount), 0)
                const curReturned = Math.max(0, curBudget - curSpent)
                const curReimbursed = Math.max(0, curSpent - curBudget)

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">Total Budget</span>
                      <span className="text-sm font-black text-indigo-900 font-mono">₱{curBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">Total Expenses</span>
                      <span className="text-sm font-black text-rose-700 font-mono">₱{curSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">Returned (Sukli)</span>
                      <span className={`text-sm font-black font-mono ${curReturned > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                        ₱{curReturned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-2xs">
                      <span className="text-[10px] font-bold uppercase text-gray-500 block">Reimbursed (Abono)</span>
                      <span className={`text-sm font-black font-mono ${curReimbursed > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                        ₱{curReimbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Table 1: BUDGET INFO | SPONSORS */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>2. Budget Info | Sponsors</span>
                    </h5>
                    <p className="text-[10px] text-gray-500">I-lista ang pondo mula sa Parish o mga donors/sponsors.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLiqBudgetRow}
                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>+ Add Budget Source</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[420px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="p-2 text-left">Expense / Source Description</th>
                        <th className="p-2 text-right w-40">Amount (₱)</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liqBudgetSources.map((source, idx) => (
                        <tr key={source.id || idx} className="hover:bg-gray-50/50">
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. Parish (Request) o Sponsor Name"
                              value={source.description}
                              onChange={(e) => handleUpdateLiqBudgetRow(idx, 'description', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={source.amount !== undefined && source.amount !== null ? String(source.amount) : ''}
                              onChange={(e) => handleUpdateLiqBudgetRow(idx, 'amount', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-right font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLiqBudgetRow(idx)}
                              className="text-gray-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table 2: EXPENSES (Actual Receipts) */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span>3. Actual Expenses & Receipts</span>
                    </h5>
                    <p className="text-[10px] text-gray-500">I-lista ang mga actual na resibo (O.R.) at mga nagastos.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddLiqExpenseRow}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg border border-indigo-200 text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>+ Add Receipt / Expense</span>
                  </button>
                </div>

                <div className="border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[480px]">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="p-2 text-center w-36">O.R. Number</th>
                        <th className="p-2 text-left">Expense Description</th>
                        <th className="p-2 text-right w-36">Amount (₱)</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {liqExpenses.map((exp, idx) => (
                        <tr key={exp.id || idx} className="hover:bg-gray-50/50">
                          <td className="p-1.5">
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                placeholder="e.g. 9240"
                                value={exp.orNumber}
                                onChange={(e) => handleUpdateLiqExpenseRow(idx, 'orNumber', e.target.value)}
                                className="w-full p-1.5 border border-gray-300 rounded-lg text-xs font-mono text-center"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateLiqExpenseRow(idx, 'orNumber', exp.orNumber === 'NO O.R' ? '' : 'NO O.R')}
                                className={`px-1.5 py-1 text-[9px] font-bold rounded border ${exp.orNumber === 'NO O.R' ? 'bg-slate-200 text-slate-800 border-slate-300' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                title="Toggle NO O.R"
                              >
                                NO
                              </button>
                            </div>
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              placeholder="e.g. Catering, Banana, Tube Ice..."
                              value={exp.description}
                              onChange={(e) => handleUpdateLiqExpenseRow(idx, 'description', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs"
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={exp.amount !== undefined && exp.amount !== null ? String(exp.amount) : ''}
                              onChange={(e) => handleUpdateLiqExpenseRow(idx, 'amount', e.target.value)}
                              className="w-full p-1.5 border border-gray-300 rounded-lg text-xs text-right font-bold"
                            />
                          </td>
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLiqExpenseRow(idx)}
                              className="text-gray-400 hover:text-red-600 font-bold p-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Liquidation Remarks</label>
                <textarea 
                  value={liqRemarks} 
                  onChange={(e) => setLiqRemarks(e.target.value)} 
                  className="w-full p-2.5 border border-gray-300 rounded-xl text-xs" 
                  rows={2}
                  placeholder="Summary notes regarding the expenditures and receipts..."
                ></textarea>
              </div>

              {/* Sticky Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button 
                  type="button" 
                  onClick={() => { setIsLiquidationModalOpen(false); setSelectedRequest(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Submitting...' : 'Submit Liquidation Statement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Fund Request Modal */}
      {cancelModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Requisition Cancellation
                </span>
                <h4 className="text-base font-black text-gray-900 mt-0.5">Cancel Fund Request</h4>
                <p className="text-[10px] text-gray-500 font-mono">Ref: {cancelModalRequest.referenceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => { setCancelModalRequest(null); setCancelReason(''); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleConfirmCancel} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Request Title:</span>
                  <span className="font-bold text-gray-900 truncate max-w-[200px]">{cancelModalRequest.title}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Requested Amount:</span>
                  <span className="font-black text-blue-700 font-mono">₱{cancelModalRequest.requestedAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Requester:</span>
                  <span className="font-semibold text-gray-800">{cancelModalRequest.requestedByName}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Activity was postponed, budget no longer required..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-slate-500"
                />
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setCancelModalRequest(null); setCancelReason(''); }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving || !cancelReason.trim()}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Void Fund Request Modal */}
      {voidModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-rose-200 w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200">
                  Voucher Annulment
                </span>
                <h4 className="text-base font-black text-rose-950 mt-0.5">Void Fund Request Voucher</h4>
                <p className="text-[10px] text-rose-600 font-mono">Ref: {voidModalRequest.referenceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => { setVoidModalRequest(null); setVoidReason(''); }}
                className="text-rose-400 hover:text-rose-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-rose-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleConfirmVoid} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Warning Card */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-950">
                <div className="flex items-start gap-2">
                  <div className="p-1 rounded-lg bg-rose-600 text-white shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="font-medium text-[11px] leading-relaxed">
                    Voiding this request will annul its status. If funds were previously disbursed (₱{(voidModalRequest.releasedAmount || voidModalRequest.requestedAmount).toLocaleString()}), this will reverse its financial ledger outflow and soft-archive any linked event income.
                  </p>
                </div>
                <div className="pt-2 border-t border-rose-200/70 text-[11px] flex justify-between">
                  <span>Title: <strong>{voidModalRequest.title}</strong></span>
                  <span>Amount: <strong>₱{(voidModalRequest.releasedAmount || voidModalRequest.requestedAmount).toLocaleString()}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Void Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Duplicate disbursement voucher, issued in error..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setVoidModalRequest(null); setVoidReason(''); }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving || !voidReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 disabled:opacity-50 transition cursor-pointer"
                >
                  {saving ? 'Voiding...' : 'Confirm Void'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reopen Closed Liquidation Review Modal */}
      {reopenModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-amber-200 w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-amber-100 flex items-center justify-between bg-amber-50/50">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                  Audit & Re-evaluation
                </span>
                <h4 className="text-base font-black text-amber-950 mt-0.5">Reopen Closed Liquidation</h4>
                <p className="text-[10px] text-amber-700 font-mono">Ref: {reopenModalRequest.referenceNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => { setReopenModalRequest(null); setReopenReason(''); }}
                className="text-amber-400 hover:text-amber-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-amber-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleReopenLiquidationSubmit} className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Info Card */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-950">
                <div className="flex items-start gap-2">
                  <div className="p-1 rounded-lg bg-amber-600 text-white shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="font-medium text-[11px] leading-relaxed">
                    Ibabalik ang status ng request na ito mula sa <strong>Closed</strong> patungo sa <strong>Liquidated</strong> upang ma-review, maiwasto, o ma-audit muli ang mga resibo at expenditures.
                  </p>
                </div>
                <div className="pt-2 border-t border-amber-200/70 text-[11px] flex justify-between">
                  <span>Title: <strong>{reopenModalRequest.title}</strong></span>
                  <span>Amount: <strong>₱{(reopenModalRequest.releasedAmount || reopenModalRequest.requestedAmount).toLocaleString()}</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                  Reason for Reopening *
                </label>
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Hal: Karagdagang pagsusuri sa mga opisyal na resibo, pagwawasto ng halaga..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Sticky Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setReopenModalRequest(null); setReopenReason(''); }}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !reopenReason.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{saving ? 'Reopening...' : 'Reopen for Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Password Confirmation Modal for Permanent Deletion */}
      <PasswordConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
        onConfirm={handleConfirmDelete}
        title={
          deleteConfirm.ids && deleteConfirm.ids.length > 0
            ? `Permanently Delete ${deleteConfirm.ids.length} ${
                deleteConfirm.type === 'income' ? 'Income Transactions' :
                deleteConfirm.type === 'expense' ? 'Direct Expenses' :
                deleteConfirm.type === 'category' ? 'Categories' :
                'Fund Requests'
              }`
            : `Permanently Delete ${
                deleteConfirm.type === 'income' ? 'Income Transaction' :
                deleteConfirm.type === 'expense' ? 'Direct Expense' :
                deleteConfirm.type === 'category' ? `Category "${deleteConfirm.name || ''}"` :
                'Fund Request'
              }`
        }
        message={
          deleteConfirm.ids && deleteConfirm.ids.length > 0
            ? `Are you sure you want to permanently delete ${deleteConfirm.ids.length} selected ${deleteConfirm.type} records? This action cannot be undone. Please enter your password to confirm.`
            : `Are you sure you want to permanently delete this ${deleteConfirm.type} record? This action cannot be undone. Please enter your password to confirm.`
        }
        confirmLabel="Delete Permanently"
      />

      {/* Review Liquidation Modal */}
      {isReviewLiquidationModalOpen && reviewLiquidationRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    reviewLiquidationRequest.status === 'closed'
                      ? 'text-gray-700 bg-gray-100 border-gray-300'
                      : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  }`}>
                    {reviewLiquidationRequest.status === 'closed' ? 'Closed Liquidation (Audited)' : 'Audit & Review'}
                  </span>
                  {reviewLiquidationRequest.liquidationReopenReason && reviewLiquidationRequest.status === 'liquidated' && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                      Reopened for Review
                    </span>
                  )}
                </div>
                <h4 className="text-base font-black text-gray-900 mt-0.5">
                  {reviewLiquidationRequest.status === 'closed' ? 'Liquidation Audit Summary' : 'Review Liquidation Report'}
                </h4>
                <p className="text-[10px] font-mono text-gray-500">
                  Ref: {reviewLiquidationRequest.referenceNumber} • Title: {reviewLiquidationRequest.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsReviewLiquidationModalOpen(false); setReviewLiquidationRequest(null); }}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              {/* Top Financial Breakdown Cards */}
              {(() => {
                const totalBudget = (reviewLiquidationRequest.budgetSources || []).reduce((s, b) => s + parseAmount(b.amount), 0) || (reviewLiquidationRequest.releasedAmount || reviewLiquidationRequest.requestedAmount || 0)
                const totalSpent = (reviewLiquidationRequest.liquidationExpenses || []).reduce((s, e) => s + parseAmount(e.amount), 0) || (reviewLiquidationRequest.totalSpent || 0)
                const returned = Math.max(0, totalBudget - totalSpent)
                const reimbursed = Math.max(0, totalSpent - totalBudget)

                return (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Total Budget Received</span>
                        <span className="text-sm font-black text-indigo-900 font-mono">
                          ₱{totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Total Expenses Spent</span>
                        <span className="text-sm font-black text-rose-700 font-mono">
                          ₱{totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Surplus (Isasauli)</span>
                        <span className={`text-sm font-black font-mono ${returned > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          ₱{returned.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[10px] font-bold uppercase text-gray-500 block">Reimbursement (Abono)</span>
                        <span className={`text-sm font-black font-mono ${reimbursed > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
                          ₱{reimbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Settlement Notice */}
                    {returned > 0 && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          <strong>Surplus Settlement:</strong> ₱{returned.toLocaleString('en-US', { minimumFractionDigits: 2 })} remaining balance must be returned to the parish/ministry fund.
                        </span>
                      </div>
                    )}
                    {reimbursed > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>
                          <strong>Reimbursement Claim:</strong> ₱{reimbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })} out-of-pocket expenses to be reimbursed to {reviewLiquidationRequest.requestedByName}.
                        </span>
                      </div>
                    )}
                    {returned === 0 && reimbursed === 0 && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>
                          <strong>Balanced:</strong> Total expenditures exactly match the released budget amount.
                        </span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Memo Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">Memo & Metadata</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Addressee (To)</span>
                    <span className="font-semibold text-gray-800">{reviewLiquidationRequest.liquidationTo || '--'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Sender (From)</span>
                    <span className="font-semibold text-gray-800">{reviewLiquidationRequest.liquidationFrom || '--'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Liquidation Date</span>
                    <span className="font-semibold text-gray-800">{reviewLiquidationRequest.liquidationDate || '--'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Liquidated By</span>
                    <span className="font-semibold text-gray-800">{reviewLiquidationRequest.liquidatedByName || reviewLiquidationRequest.requestedByName || '--'}</span>
                  </div>
                </div>
              </div>

              {/* Table: Budget Sources */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>Budget Sources & Sponsors</span>
                </h5>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5">Source / Sponsor Description</th>
                        <th className="p-2.5 text-right w-36">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(reviewLiquidationRequest.budgetSources || []).map((b, idx) => (
                        <tr key={b.id || idx}>
                          <td className="p-2.5 font-medium text-gray-800">{b.description || '--'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                            ₱{parseAmount(b.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {(!reviewLiquidationRequest.budgetSources || reviewLiquidationRequest.budgetSources.length === 0) && (
                        <tr>
                          <td className="p-2.5 font-medium text-gray-800">Parish / Main Funds (Request #{reviewLiquidationRequest.referenceNumber})</td>
                          <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                            ₱{(reviewLiquidationRequest.releasedAmount || reviewLiquidationRequest.requestedAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Table: Actual Expenses */}
              <div className="p-3.5 bg-white rounded-xl border border-gray-200 space-y-2 shadow-2xs">
                <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span>Actual Expense Breakdown & Receipts</span>
                </h5>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 w-28">O.R. No</th>
                        <th className="p-2.5">Item Description</th>
                        <th className="p-2.5 text-right w-36">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(reviewLiquidationRequest.liquidationExpenses || []).map((exp, idx) => (
                        <tr key={exp.id || idx}>
                          <td className="p-2.5 font-mono text-gray-600 font-semibold">{exp.orNumber || 'NO O.R'}</td>
                          <td className="p-2.5 font-medium text-gray-800">{exp.description || '--'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                            ₱{parseAmount(exp.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      {(!reviewLiquidationRequest.liquidationExpenses || reviewLiquidationRequest.liquidationExpenses.length === 0) && (
                        <tr>
                          <td colSpan={3} className="p-3 text-center text-gray-400 italic">No expense items recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {reviewLiquidationRequest.liquidationRemarks && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block mb-0.5">Liquidation Remarks</span>
                  <p className="text-gray-700 font-medium italic">"{reviewLiquidationRequest.liquidationRemarks}"</p>
                </div>
              )}

              {/* Auditor Notes if Already Closed */}
              {reviewLiquidationRequest.status === 'closed' && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-900 flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Audited & Approved by {reviewLiquidationRequest.liquidationReviewedByName || 'Admin'}</span>
                    </span>
                    {reviewLiquidationRequest.liquidationReviewedAt && (
                      <span className="text-[10px] text-emerald-700 font-medium">
                        {new Date(reviewLiquidationRequest.liquidationReviewedAt?.toDate ? reviewLiquidationRequest.liquidationReviewedAt.toDate() : reviewLiquidationRequest.liquidationReviewedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {reviewLiquidationRequest.liquidationReviewRemarks && (
                    <p className="text-emerald-950 font-medium italic pl-5">
                      "{reviewLiquidationRequest.liquidationReviewRemarks}"
                    </p>
                  )}
                </div>
              )}

              {/* Request Changes / Revision Form Section */}
              {showRevisionSection ? (
                <form onSubmit={handleRequestRevisionSubmit} className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-amber-900 uppercase tracking-tight flex items-center gap-1.5">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Request Changes / Return for Revision</span>
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowRevisionSection(false)}
                      className="text-xs font-bold text-gray-500 hover:text-gray-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800 font-medium">
                    I-specify ang mga kailangang baguhin o itama (hal. kulang na resibo, maling halaga). Ibabalik ang status sa <strong>Released</strong> upang mabago ng requester ang liquidation details.
                  </p>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                      Reason for Revision / Required Changes *
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={reviewRevisionReason}
                      onChange={(e) => setReviewRevisionReason(e.target.value)}
                      placeholder="Hal: Pakilagay ang O.R. number sa supplies at pakitama ang halaga ng transpo..."
                      className="w-full p-2.5 border border-amber-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRevisionSection(false)}
                      className="px-3 py-1.5 border border-gray-200 text-xs font-semibold rounded-xl bg-white hover:bg-gray-50 cursor-pointer"
                    >
                      Back to Review
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                      {saving ? 'Returning...' : 'Confirm & Request Changes'}
                    </button>
                  </div>
                </form>
              ) : reviewLiquidationRequest.status === 'closed' ? (
                /* Closed View Toolbar & Reopen Option */
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setLiquidationExportRequest(reviewLiquidationRequest)
                        setIsLiquidationExportOpen(true)
                      }}
                      className="px-3.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>Preview Liquidation PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const req = reviewLiquidationRequest
                        setIsReviewLiquidationModalOpen(false)
                        handleOpenReopenModal(req)
                      }}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-600/20"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Reopen for Review / Adjustments</span>
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => { setIsReviewLiquidationModalOpen(false); setReviewLiquidationRequest(null); }}
                      className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                    >
                      Close Review
                    </button>
                  </div>
                </div>
              ) : (
                /* Approval Form & Toolbar */
                <form onSubmit={handleApproveLiquidationSubmit} className="space-y-3 pt-2">
                  {/* Action Toolbar */}
                  <div className="flex items-center justify-between gap-2 flex-wrap p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          setLiquidationExportRequest(reviewLiquidationRequest)
                          setIsLiquidationExportOpen(true)
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Preview PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const req = reviewLiquidationRequest
                          setIsReviewLiquidationModalOpen(false)
                          handleLiquidationOpen(req)
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-200 text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <span>Edit / Adjust Liquidation</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowRevisionSection(true)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl border border-amber-200 text-xs flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                    >
                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Request Changes / Revision</span>
                    </button>
                  </div>

                  {/* Reviewer Audit Remarks */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                      Audit / Approval Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      value={reviewRemarks}
                      onChange={(e) => setReviewRemarks(e.target.value)}
                      placeholder="e.g. Audited and verified by Parish Finance Council"
                      className="w-full p-2.5 border border-gray-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setIsReviewLiquidationModalOpen(false); setReviewLiquidationRequest(null); }}
                      className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{saving ? 'Approving & Closing...' : 'Approve Liquidation & Close'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finance PDF Export Modal with Dynamic Signatures */}
      <FinanceExportModal
        isOpen={isExportPdfModalOpen}
        onClose={() => setIsExportPdfModalOpen(false)}
        reportData={reportData}
        startDate={reportStartDate}
        endDate={reportEndDate}
      />

      {/* Fund Requisition Voucher PDF Modal with Dynamic Signatures */}
      <FundRequisitionExportModal
        isOpen={isRequisitionExportOpen}
        onClose={() => {
          setIsRequisitionExportOpen(false)
          setRequisitionExportRequest(null)
        }}
        request={requisitionExportRequest}
      />

      {/* Liquidation Report PDF Modal with Dynamic Signatures */}
      <LiquidationExportModal
        isOpen={isLiquidationExportOpen}
        onClose={() => {
          setIsLiquidationExportOpen(false)
          setLiquidationExportRequest(null)
        }}
        request={liquidationExportRequest}
      />

      {/* Outside / Direct Liquidation Modal */}
      <DirectLiquidationModal
        isOpen={isOutsideLiquidationModalOpen}
        onClose={() => setIsOutsideLiquidationModalOpen(false)}
        onSuccess={fetchData}
      />
    </div>
  )
}
