import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/features/authentication/AuthContext'
import { Navigate } from 'react-router-dom'
import { Loading } from '@/components/Loading'
import { AlertModal, PasswordConfirmModal } from '@/components/Dialog'
import { authService } from '@/services/authService'

// Import types
import type { FinanceIncome, DirectExpense, FinanceCategory, FinanceFundRequest, FinancePeriod, LedgerEntry } from '@/types/finance'

// Import services
import { categoryService } from '@/services/finance/categoryService'
import { incomeService } from '@/services/finance/incomeService'
import { expenseService } from '@/services/finance/expenseService'
import { fundRequestService } from '@/services/finance/fundRequestService'
import { ledgerService } from '@/services/finance/ledgerService'
import { financePeriodService } from '@/services/finance/financePeriodService'
import { reportService } from '@/services/finance/reportService'

// Import Finance Engine & Report PDF Generator
import { financeEngine } from '@/utils/financeEngine'
import { FinanceExportModal } from '@/features/finance/components/FinanceExportModal'

export const FinancePage: React.FC = () => {
  const { hasModuleAccess, canAction, profile } = useAuth()

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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

  // Form states - Fund Request (Formatted Text)
  const [reqTitle, setReqTitle] = useState('')
  const [reqPurpose, setReqPurpose] = useState('')
  const [reqAmount, setReqAmount] = useState('')
  const [reqDateNeeded, setReqDateNeeded] = useState(getLocalYYYYMMDD())
  const [reqDesc, setReqDesc] = useState('')

  // Form states - Release (Formatted Text)
  const [relToName, setRelToName] = useState('')
  const [relAmount, setRelAmount] = useState('')
  const [relDate, setRelDate] = useState(getLocalYYYYMMDD())
  const [relRemarks, setRelRemarks] = useState('')

  // Form states - Liquidation (Formatted Text)
  const [liqSpent, setLiqSpent] = useState('')
  const [liqReturned, setLiqReturned] = useState('')
  const [liqRemarks, setLiqRemarks] = useState('')

  // Filter States - General / Reports (Start and End of current month local time)
  const [reportStartDate, setReportStartDate] = useState(getLocalYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [reportEndDate, setReportEndDate] = useState(getLocalYYYYMMDD(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)))
  const [reportData, setReportData] = useState<any>(null)

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

  // Calculate current month identifier
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), [])

  // Calculate dashboard summary
  const summary = useMemo(() => {
    return financeEngine.computeMonthlySummary(ledgerEntries, requests, currentMonthStr)
  }, [ledgerEntries, requests, currentMonthStr])

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

  // Helper to parse comma formatted string to pure number
  const parseAmount = (val: string): number => {
    return Number(val.replace(/,/g, '')) || 0
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
    if (!reqTitle || !reqPurpose || !reqAmount || !reqDateNeeded) {
      setErrorMsg('Please populate all mandatory request fields.')
      return
    }
    if (isPeriodClosed(reqDateNeeded)) {
      setErrorMsg('The selected period is closed.')
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.createFundRequest(
        {
          title: reqTitle.trim(),
          purpose: reqPurpose.trim(),
          requestedAmount: parseAmount(reqAmount),
          requestedByUid: profile?.uid || 'Unknown',
          requestedByName: profile?.displayName || 'User',
          dateNeeded: reqDateNeeded,
          description: reqDesc.trim(),
          createdByUid: profile?.uid || 'System',
          createdByName: profile?.displayName || 'Admin'
        },
        profile?.uid || 'System',
        profile?.displayName || 'Admin',
        true // Submit immediately as pending
      )
      setReqTitle('')
      setReqPurpose('')
      setReqAmount('')
      setReqDesc('')
      setIsRequestModalOpen(false)
      setSuccessMsg('Fund request submitted successfully.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit request.')
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
        profile?.displayName || 'Admin'
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

  // Release Workflow
  const handleReleaseOpen = (req: FinanceFundRequest) => {
    setSelectedRequest(req)
    setRelToName(req.requestedByName)
    setRelAmount(req.requestedAmount.toLocaleString())
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
      await fundRequestService.releaseFunds(
        selectedRequest.id,
        {
          releasedToName: relToName.trim(),
          releasedAmount: parseAmount(relAmount),
          releasedDate: relDate,
          remarks: relRemarks.trim()
        },
        profile?.uid || 'System',
        profile?.displayName || 'Admin'
      )
      setIsReleaseModalOpen(false)
      setSelectedRequest(null)
      setRelRemarks('')
      setSuccessMsg('Funds released successfully.')
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
    setLiqSpent((req.releasedAmount || req.requestedAmount).toLocaleString())
    setLiqReturned('0')
    setIsLiquidationModalOpen(true)
  }

  const handleLiquidationSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRequest) return
    
    const releasedAmt = selectedRequest.releasedAmount || selectedRequest.requestedAmount
    const spent = parseAmount(liqSpent)
    const ret = parseAmount(liqReturned)

    if (spent + ret !== releasedAmt) {
      setErrorMsg(`Total spent (₱${spent.toLocaleString()}) and returned (₱${ret.toLocaleString()}) must equal the released amount (₱${releasedAmt.toLocaleString()}).`)
      return
    }

    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.submitLiquidation(
        selectedRequest.id,
        {
          totalSpent: spent,
          remainingAmount: 0,
          returnedAmount: ret,
          remarks: liqRemarks.trim()
        },
        profile?.uid || 'User',
        profile?.displayName || 'User'
      )
      setIsLiquidationModalOpen(false)
      setSelectedRequest(null)
      setLiqRemarks('')
      setSuccessMsg('Liquidation report submitted.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit liquidation.')
    } finally {
      setSaving(false)
    }
  }

  const handleReviewLiquidation = async (reqId: string) => {
    setSaving(true)
    setErrorMsg(null)
    try {
      await fundRequestService.reviewLiquidation(
        reqId,
        profile?.uid || 'Admin',
        profile?.displayName || 'Admin'
      )
      setSuccessMsg('Liquidation approved. Request closed.')
      await fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve liquidation.')
    } finally {
      setSaving(false)
    }
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
        }
      }
    })
  }

  const handleTriggerBulkRestore = async (type: 'income' | 'expense' | 'category' | 'request') => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    const uId = profile?.uid || 'System'
    const uName = profile?.displayName || 'Admin'

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
      {/* Mobile Tab Selector & Archive Toggle */}
      <div className="sm:hidden mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <select
            id="finance-tabs"
            name="finance-tabs"
            className="block w-full appearance-none rounded-xl border border-gray-200 bg-white py-3 pl-4 pr-10 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
          >
            <optgroup label="Overview & Reports">
              <option value="dashboard">Dashboard</option>
              <option value="reports">Financial Reports</option>
            </optgroup>
            <optgroup label="Transactions">
              <option value="requests">Fund Requests</option>
              <option value="income">Incomes</option>
              <option value="expenses">Direct Expenses</option>
              <option value="ledger">Ledger</option>
            </optgroup>
            <optgroup label="Settings">
              <option value="categories">Categories</option>
              <option value="closing">Lock Periods</option>
            </optgroup>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-blue-500">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          title={showArchived ? 'Hide Archives' : 'View Archives'}
          className={`flex items-center justify-center p-3 rounded-xl border transition-all cursor-pointer ${
            showArchived
              ? 'bg-amber-100 text-amber-900 border-amber-300'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </button>
      </div>

      {/* Desktop Tabs list */}
      <div className="hidden sm:flex border border-gray-200 bg-white p-2 rounded-xl shadow-2xs flex-wrap items-center gap-2">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
          ) },
          { key: 'requests', label: 'Fund Requests', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          ) },
          { key: 'income', label: 'Incomes', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          ) },
          { key: 'expenses', label: 'Expenses', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
          ) },
          { key: 'ledger', label: 'Ledger', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          ) },
          { key: 'reports', label: 'Reports', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          ) },
          { key: 'categories', label: 'Categories', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
          ) },
          { key: 'closing', label: 'Lock Periods', icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          ) }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center space-x-2 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === t.key
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <span className={activeTab === t.key ? 'text-blue-100' : 'text-gray-400'}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}

        {/* View Archives Global Toggle Button */}
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer sm:ml-auto ${
            showArchived
              ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-xs'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200'
          }`}
        >
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          <span>{showArchived ? 'Hide Archives' : 'View Archives'}</span>
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
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Record Income
                </button>
              </div>

              {/* Bulk Action Bar for Incomes */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showArchived ? (
                      <button
                        onClick={() => handleTriggerBulkRestore('income')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Restore Selected ({selectedIds.size})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTriggerBulkArchive('income')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Archive Selected ({selectedIds.size})</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleTriggerBulkDelete('income')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Permanently ({selectedIds.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
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
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleRestoreIncome(inc.id)}
                                className="text-emerald-600 hover:underline cursor-pointer font-bold"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, id: inc.id, type: 'income' })}
                                className="text-red-600 hover:underline cursor-pointer font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleOpenEditIncome(inc)}
                                className="text-blue-600 hover:underline cursor-pointer font-bold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchiveIncome(inc.id)}
                                className="text-red-600 hover:underline cursor-pointer font-bold"
                              >
                                Archive
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
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Record Expense
                </button>
              </div>

              {/* Bulk Action Bar for Expenses */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showArchived ? (
                      <button
                        onClick={() => handleTriggerBulkRestore('expense')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Restore Selected ({selectedIds.size})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTriggerBulkArchive('expense')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Archive Selected ({selectedIds.size})</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleTriggerBulkDelete('expense')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Permanently ({selectedIds.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
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
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleRestoreExpense(exp.id)}
                                className="text-emerald-600 hover:underline cursor-pointer font-bold"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, id: exp.id, type: 'expense' })}
                                className="text-red-600 hover:underline cursor-pointer font-bold"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleOpenEditExpense(exp)}
                                className="text-blue-600 hover:underline cursor-pointer font-bold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleArchiveExpense(exp.id)}
                                className="text-red-600 hover:underline cursor-pointer font-bold"
                              >
                                Archive
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
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      {selectedIds.size === categories.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <button
                  onClick={handleOpenAddCategory}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Add Category
                </button>
              </div>

              {/* Bulk Action Bar for Categories */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showArchived ? (
                      <button
                        onClick={() => handleTriggerBulkRestore('category')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Restore Selected ({selectedIds.size})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTriggerBulkArchive('category')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Archive Selected ({selectedIds.size})</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleTriggerBulkDelete('category')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Permanently ({selectedIds.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map((cat) => (
                  <div key={cat.id} className={`p-4 bg-white border rounded-xl shadow-2xs flex justify-between items-center ${cat.isArchived ? 'border-amber-200 bg-amber-50/30 opacity-75' : 'border-gray-200'} ${selectedIds.has(cat.id) ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}`}>
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
                    <div className="flex items-center gap-2">
                      {cat.isArchived ? (
                        <>
                          <button
                            onClick={() => handleRestoreCategory(cat.id, cat.name)}
                            className="text-emerald-600 hover:underline text-xs font-bold cursor-pointer"
                          >
                            Restore
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id, name: cat.name, type: 'category' })}
                            className="text-red-600 hover:underline text-xs font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenEditCategory(cat)}
                            className="text-blue-600 hover:underline text-xs font-bold cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleArchiveCategory(cat.id, cat.name)}
                            className="text-red-600 hover:underline text-xs font-bold cursor-pointer"
                          >
                            Archive
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
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-900">Fund Requests Workflow</h3>
                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  + Create Fund Request
                </button>
              </div>

              {/* Bulk Action Bar for Requests */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 p-3 rounded-xl shadow-xs animate-fade-in flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedIds.size}</span>
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {showArchived ? (
                      <button
                        onClick={() => handleTriggerBulkRestore('request')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Restore Selected ({selectedIds.size})</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTriggerBulkArchive('request')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        <span>Archive Selected ({selectedIds.size})</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleTriggerBulkDelete('request')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      <span>Delete Permanently ({selectedIds.size})</span>
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-xs border-separate border-spacing-0 min-w-max [&_th]:border-b [&_th]:border-gray-200 [&_td]:border-b [&_td]:border-gray-100">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={requests.length > 0 && selectedIds.size === requests.length}
                          onChange={() => handleSelectAll(requests.map(r => r.id))}
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
                    {requests.map((req) => (
                      <tr key={req.id} className={`border-b border-gray-100 hover:bg-gray-50/50 group ${req.isArchived ? 'opacity-60 bg-gray-50' : ''} ${selectedIds.has(req.id) ? 'bg-blue-50/40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(req.id)}
                            onChange={() => handleToggleSelect(req.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-mono font-bold text-gray-950">
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
                            {req.targetEventName && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                                Event: {req.targetEventName}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setHistoryRequest(req)}
                              className="text-blue-600 hover:text-blue-800 font-bold text-[9px] px-2 py-0.5 rounded-sm bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              View History
                            </button>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{req.purpose}</div>
                        </td>
                        <td className="p-3">{req.requestedByName}</td>
                        <td className="p-3 font-bold">₱{req.requestedAmount.toLocaleString()}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            req.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                            req.status === 'rejected' ? 'bg-red-50 text-red-700' :
                            req.status === 'released' ? 'bg-amber-50 text-amber-700' :
                            req.status === 'liquidated' ? 'bg-indigo-50 text-indigo-700' :
                            req.status === 'closed' ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-600'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3 space-x-2 whitespace-nowrap">
                          {req.isArchived ? (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleRestoreRequest(req.id)}
                                className="text-emerald-600 font-bold hover:underline cursor-pointer"
                              >
                                Restore
                              </button>
                              <button
                                onClick={() => setDeleteConfirm({ isOpen: true, id: req.id, type: 'request' })}
                                className="text-red-600 font-bold hover:underline cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          ) : (
                            <>
                              {req.status === 'pending' && (
                                <>
                                  <button onClick={() => handleApproveRequest(req.id)} className="text-emerald-600 font-bold hover:underline cursor-pointer">Approve</button>
                                  <button onClick={() => setShowRejectionInput(req.id)} className="text-red-600 font-bold hover:underline cursor-pointer">Reject</button>
                                </>
                              )}
                              {req.status === 'approved' && (
                                <button onClick={() => handleReleaseOpen(req)} className="text-amber-600 font-bold hover:underline cursor-pointer">Release Funds</button>
                              )}
                              {req.status === 'released' && (
                                <button onClick={() => handleLiquidationOpen(req)} className="text-indigo-600 font-bold hover:underline cursor-pointer">Liquidate</button>
                              )}
                              {req.status === 'liquidated' && (
                                <button onClick={() => handleReviewLiquidation(req.id)} className="text-emerald-700 font-bold hover:underline cursor-pointer">Review & Close</button>
                              )}
                              <button onClick={() => handleArchiveRequest(req.id)} className="text-gray-400 hover:text-red-600 text-xs font-semibold cursor-pointer">Archive</button>
                            </>
                          )}

                          {showRejectionInput === req.id && (
                            <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                              <input
                                type="text"
                                placeholder="Rejection reason..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                className="w-full text-xs p-1.5 border border-gray-300 rounded"
                              />
                              <button onClick={() => handleRejectRequest(req.id)} className="bg-red-600 text-white px-2.5 py-1 rounded text-[10px]">Submit Rejection</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
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
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                    className="p-1.5 border border-gray-300 rounded text-xs"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                    className="p-1.5 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExportCSV} className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-bold hover:bg-gray-50 bg-white cursor-pointer">Export CSV</button>
                  <button onClick={handleExportPDF} className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer">Download PDF</button>
                </div>
              </div>

              {/* Summaries */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Opening Balance', val: `₱${reportData.openingBalance.toLocaleString()}` },
                  { label: 'Total Inflow', val: `₱${reportData.totalIncome.toLocaleString()}` },
                  { label: 'Total Outflow', val: `₱${reportData.totalExpenses.toLocaleString()}` },
                  { label: 'Closing Balance', val: `₱${reportData.closingBalance.toLocaleString()}` }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 bg-white border border-gray-200 rounded-xl shadow-2xs">
                    <span className="text-[10px] text-gray-500 font-bold uppercase">{item.label}</span>
                    <div className="text-xl font-black mt-1 text-gray-900">{item.val}</div>
                  </div>
                ))}
              </div>

              {/* Categorized Breakdowns */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {reportData.incomeByCategory && reportData.incomeByCategory.filter((c: any) => c.total > 0).length > 0 && (
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase text-gray-500">Incomes by Source / Category</h4>
                    {reportData.incomeByCategory.filter((c: any) => c.total > 0).map((c: any) => (
                      <div key={c.categoryId} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2">
                        <span className="font-bold text-gray-700">{c.categoryName}</span>
                        <span className="font-black text-emerald-600">₱{c.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                {reportData.expenseByCategory && reportData.expenseByCategory.filter((c: any) => c.total > 0).length > 0 && (
                  <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-2xs space-y-3">
                    <h4 className="text-xs font-bold uppercase text-gray-500">Expenses by Category</h4>
                    {reportData.expenseByCategory.filter((c: any) => c.total > 0).map((c: any) => (
                      <div key={c.categoryId} className="flex justify-between items-center text-xs border-b border-gray-50 pb-2">
                        <span className="font-bold text-gray-700">{c.categoryName}</span>
                        <span className="font-black text-red-600">₱{c.total.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                              className="text-emerald-600 font-bold hover:underline cursor-pointer"
                            >
                              Reopen Period
                            </button>
                          ) : (
                            <button
                              onClick={() => handleClosePeriod(p.id)}
                              className="text-red-600 font-bold hover:underline cursor-pointer"
                            >
                              Close Period (Lock Month)
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
                            className="text-red-600 font-bold hover:underline cursor-pointer"
                          >
                            Close Period (Lock Month)
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">{dialog.title}</h4>
            <p className="text-xs text-gray-600 leading-relaxed">{dialog.message}</p>
            <div className="flex justify-end gap-2 pt-2">
              {dialog.isConfirm && (
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50 cursor-pointer"
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
                className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fund Request Workflow History Modal */}
      {historyRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Fund Request Workflow History</h4>
                <p className="text-[10px] text-gray-500 mt-0.5 font-mono">Ref: {historyRequest.referenceNumber}</p>
              </div>
              <button
                onClick={() => setHistoryRequest(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              <div className="relative border-l-2 border-gray-100 pl-4 ml-2 space-y-5 py-2">
                {/* 1. Request submission */}
                <div className="relative">
                  <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div>
                  <div className="text-xs font-bold text-gray-900">Request Submitted</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Requested amount: <strong className="text-gray-800">₱{historyRequest.requestedAmount.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.requestedByName}</strong>
                  </div>
                </div>

                {/* 2. Approval or Rejection */}
                {historyRequest.approvedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-900 text-emerald-700">✓ Approved</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Approved by <strong className="text-gray-800">{historyRequest.approvedByName}</strong> {historyRequest.approvalRemarks ? `("${historyRequest.approvalRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {historyRequest.rejectedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-900 text-red-600">✗ Rejected</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Rejected by <strong className="text-gray-800">{historyRequest.rejectedByName}</strong> {historyRequest.rejectionReason ? ` - Reason: "${historyRequest.rejectionReason}"` : ''}
                    </div>
                  </div>
                )}

                {/* 3. Funds Released */}
                {historyRequest.releasedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-900 text-amber-700">→ Funds Released</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Disbursed <strong className="text-gray-800">₱{historyRequest.releasedAmount?.toLocaleString()}</strong> by <strong className="text-gray-800">{historyRequest.releasedByName}</strong> to <strong className="text-gray-800">{historyRequest.releasedToName || historyRequest.requestedByName}</strong> on {historyRequest.releasedDate} {historyRequest.releaseRemarks ? `("${historyRequest.releaseRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {/* 4. Liquidation */}
                {historyRequest.liquidatedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-900 text-indigo-700">⟲ Liquidation Submitted</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Reported by <strong className="text-gray-800">{historyRequest.liquidatedByName}</strong> showing <strong className="text-gray-800">₱{historyRequest.totalSpent?.toLocaleString()}</strong> spent and <strong className="text-gray-800">₱{historyRequest.returnedAmount?.toLocaleString()}</strong> returned. {historyRequest.liquidationRemarks ? `("${historyRequest.liquidationRemarks}")` : ''}
                    </div>
                  </div>
                )}

                {/* 5. Closed */}
                {historyRequest.liquidationReviewedByName && (
                  <div className="relative">
                    <div className="absolute -left-[22px] mt-0.5 w-3.5 h-3.5 rounded-full bg-gray-500 border-2 border-white shadow-sm"></div>
                    <div className="text-xs font-bold text-gray-900 text-gray-700">🔒 Workflow Closed</div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      Reviewed & verified closed by <strong className="text-gray-800">{historyRequest.liquidationReviewedByName}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryRequest(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record / Edit Income Modal */}
      {isIncomeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">
              {editIncomeItem ? 'Edit Income Transaction' : 'Record Inflow Receipt'}
            </h4>
            <form onSubmit={handleSaveIncome} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Amount (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={incAmount} 
                  onChange={(e) => handleNumberChange(e.target.value, setIncAmount)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Source Name</label>
                <input type="text" required placeholder="e.g. Mass Donation" value={incSource} onChange={(e) => setIncSource(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Category</label>
                <select required value={incCategoryId} onChange={(e) => setIncCategoryId(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded mt-1 text-xs">
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Received From</label>
                <input type="text" required placeholder="Name/Institution" value={incReceivedFrom} onChange={(e) => setIncReceivedFrom(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Transaction Date</label>
                <input type="date" required value={incDate} onChange={(e) => setIncDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Description Notes</label>
                <textarea value={incDesc} onChange={(e) => setIncDesc(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" rows={2}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsIncomeModalOpen(false); setEditIncomeItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">
              {editExpenseItem ? 'Edit Direct Expense' : 'Record Direct Outflow'}
            </h4>
            <form onSubmit={handleSaveExpense} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Amount (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={expAmount} 
                  onChange={(e) => handleNumberChange(e.target.value, setExpAmount)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Category</label>
                <select required value={expCategoryId} onChange={(e) => setExpCategoryId(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded mt-1 text-xs">
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Spent By (Person)</label>
                <input type="text" required value={expSpentByName} onChange={(e) => setExpSpentByName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Transaction Date</label>
                <input type="date" required value={expDate} onChange={(e) => setExpDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Expense Purpose Description</label>
                <textarea required value={expDesc} onChange={(e) => setExpDesc(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" rows={2}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsExpenseModalOpen(false); setEditExpenseItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">
              {editCategoryItem ? 'Edit Category' : 'Add Finance Category'}
            </h4>
            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Category Name</label>
                <input type="text" required placeholder="e.g. Utility Bills" value={catName} onChange={(e) => setCatName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Display Color</label>
                <select value={catColor} onChange={(e) => setCatColor(e.target.value)} className="w-full p-2 border border-gray-300 bg-white rounded mt-1 text-xs">
                  <option value="blue">Blue</option>
                  <option value="emerald">Emerald Green</option>
                  <option value="red">Crimson Red</option>
                  <option value="amber">Amber Yellow</option>
                  <option value="purple">Royal Purple</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => { setIsCategoryModalOpen(false); setEditCategoryItem(null); }} 
                  className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer"
                >
                  {saving ? 'Saving...' : editCategoryItem ? 'Update Category' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Request Modal */}
      {isRequestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">Request Allocation Funds</h4>
            <form onSubmit={handleCreateRequest} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Title</label>
                <input type="text" required placeholder="e.g. Choir Food Supplies" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Purpose Description</label>
                <input type="text" required placeholder="Detailed objective" value={reqPurpose} onChange={(e) => setReqPurpose(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Requested Amount (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={reqAmount} 
                  onChange={(e) => handleNumberChange(e.target.value, setReqAmount)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Date Needed</label>
                <input type="date" required value={reqDateNeeded} onChange={(e) => setReqDateNeeded(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Description Explanation</label>
                <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" rows={2}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsRequestModalOpen(false)} className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Release Funds Modal */}
      {isReleaseModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">Release Approved Allocation</h4>

            {selectedRequest.targetEventName && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed">
                🏛️ <strong>Event Budget Allocation:</strong> Releasing these funds will automatically credit them to the event <strong>"{selectedRequest.targetEventName}"</strong> as Event Income in its financial ledger.
              </div>
            )}

            <form onSubmit={handleReleaseSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Released To (Name)</label>
                <input type="text" required value={relToName} onChange={(e) => setRelToName(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Released Amount (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={relAmount} 
                  onChange={(e) => handleNumberChange(e.target.value, setRelAmount)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Release Date</label>
                <input type="date" required value={relDate} onChange={(e) => setRelDate(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Release Remarks</label>
                <textarea value={relRemarks} onChange={(e) => setRelRemarks(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" rows={2}></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setIsReleaseModalOpen(false); setSelectedRequest(null); }} className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-750">Execute Release</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Liquidation Modal */}
      {isLiquidationModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-6 space-y-4 shadow-xl">
            <h4 className="text-sm font-bold text-gray-900">Record Liquidation Expenditures</h4>
            <div className="text-xs p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-600">
              Released Funds: <strong className="text-gray-900">₱{(selectedRequest.releasedAmount || selectedRequest.requestedAmount).toLocaleString()}</strong>
            </div>
            <form onSubmit={handleLiquidationSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Total Spent (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={liqSpent} 
                  onChange={(e) => handleNumberChange(e.target.value, setLiqSpent)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Returned Excess (₱)</label>
                <input 
                  type="text" 
                  required 
                  placeholder="0.00" 
                  value={liqReturned} 
                  onChange={(e) => handleNumberChange(e.target.value, setLiqReturned)} 
                  className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" 
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase">Liquidation remarks</label>
                <textarea value={liqRemarks} onChange={(e) => setLiqRemarks(e.target.value)} className="w-full p-2 border border-gray-300 rounded mt-1 text-xs" rows={2} required></textarea>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setIsLiquidationModalOpen(false); setSelectedRequest(null); }} className="px-4 py-2 border border-gray-200 text-xs font-semibold rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded hover:bg-indigo-700">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Dialogs */}
      <AlertModal
        isOpen={!!errorMsg}
        onClose={() => setErrorMsg(null)}
        variant="error"
        title="Finance Error"
        message={errorMsg ?? ''}
      />

      <AlertModal
        isOpen={!!successMsg}
        onClose={() => setSuccessMsg(null)}
        variant="success"
        title="Success"
        message={successMsg ?? ''}
      />

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

      {/* Finance PDF Export Modal with Dynamic Signatures */}
      <FinanceExportModal
        isOpen={isExportPdfModalOpen}
        onClose={() => setIsExportPdfModalOpen(false)}
        reportData={reportData}
        startDate={reportStartDate}
        endDate={reportEndDate}
      />
    </div>
  )
}
