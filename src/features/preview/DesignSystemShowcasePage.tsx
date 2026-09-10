import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// High-fidelity standard SVG icons
const Icons = {
  Dashboard: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  Wallet: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  TrendUp: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
    </svg>
  ),
  TrendDown: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
    </svg>
  ),
  FileText: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Clock: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Search: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  ),
  Check: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  ),
  Close: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  ChevronDown: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  ),
  ChevronLeft: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  ChevronRight: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  Plus: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  ),
  Trash: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  ),
  Edit: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
  Download: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  Users: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  ),
  Calendar: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  AlertCircle: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
  CheckCircle: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  MoreVertical: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
    </svg>
  ),
  Filter: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  ),
  QrCode: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.008v.008H6.75V6.75zM6.75 16.5h.008v.008H6.75V16.5zM16.5 6.75h.008v.008H16.5V6.75zM13.5 13.5h3.75m0 3.75h3.75m-3.75 3.75h3.75m-7.5-3.75h3.75m0 3.75H13.5m0-7.5h.008v.008H13.5V13.5z" />
    </svg>
  ),
  Inbox: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.375l2.25-9A2.25 2.25 0 015.65 3.75h12.7a2.25 2.25 0 012.19 1.75l2.25 9m-19.5 0v6.75A2.25 2.25 0 004.5 21.75h15a2.25 2.25 0 002.25-2.25v-6.75" />
    </svg>
  ),
  Spinner: ({ className = "w-4 h-4" }: { className?: string }) => (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  ),
}

// 21 Navigation Section List
const SECTIONS = [
  { id: 'sec-buttons', label: '1. Buttons & Actions' },
  { id: 'sec-inputs', label: '2. Form Inputs & Controls' },
  { id: 'sec-combobox', label: '3. Searchable Combobox' },
  { id: 'sec-modals', label: '4. Modal & Dialog System' },
  { id: 'sec-confirmations', label: '5. Confirmation & Alerts' },
  { id: 'sec-toasts', label: '6. Toast Notification Stacks' },
  { id: 'sec-cards', label: '7. Cards & Surface Elevation' },
  { id: 'sec-table', label: '8. Standard & Dense Table' },
  { id: 'sec-pagination', label: '9. Pagination Controls' },
  { id: 'sec-badges', label: '10. Badges & Status Pills' },
  { id: 'sec-tabs', label: '11. Tabs & Segmented Switchers' },
  { id: 'sec-header', label: '12. Page Header Standard' },
  { id: 'sec-filters', label: '13. Filter Bar Standard' },
  { id: 'sec-empty', label: '14. Empty States' },
  { id: 'sec-loading', label: '15. Loading & Skeletons' },
  { id: 'sec-errors', label: '16. Error & Banner Alerts' },
  { id: 'sec-dropdowns', label: '17. Dropdown & Context Menus' },
  { id: 'sec-navigation', label: '18. Navigation Components' },
  { id: 'sec-public', label: '19. Public Schedule Banner' },
  { id: 'sec-dense', label: '20. Dense Data Financial UI' },
  { id: 'sec-doc', label: '21. Full-Screen Document View' },
]

export function DesignSystemShowcasePage() {
  const [activeSection, setActiveSection] = useState('sec-buttons')
  const [viewportMode, setViewportMode] = useState<'responsive' | 'desktop' | 'tablet' | 'mobile'>('responsive')
  const isMobile = viewportMode === 'mobile'

  const [financePillTab, setFinancePillTab] = useState<'dashboard' | 'requests' | 'incomes' | 'expenses'>('dashboard')
  
  // Combobox State
  const [comboboxQuery, setComboboxQuery] = useState('')
  const [comboboxSelected, setComboboxSelected] = useState<string | null>('Bro. Gabriel Dela Cruz')
  const [comboboxOpen, setComboboxOpen] = useState(false)
  
  // Modals & Toasts
  const [activeModal, setActiveModal] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Array<{ id: number; type: 'success' | 'info' | 'warning' | 'error'; title: string; message: string }>>([
    { id: 1, type: 'success', title: 'System Connected', message: 'Design system tokens loaded successfully.' }
  ])
  
  // Table State
  const [selectedRows, setSelectedRows] = useState<number[]>([0, 2])
  const [tableDense, setTableDense] = useState(false)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)

  // Filter State
  const [filterSearch, setFilterSearch] = useState('')
  const [filterMinistry, setFilterMinistry] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMinistryOpen, setFilterMinistryOpen] = useState(false)
  const [filterStatusOpen, setFilterStatusOpen] = useState(false)

  // Amount with auto-comma state
  const [currencyAmount, setCurrencyAmount] = useState('15,450.00')

  // Dynamic Item Computation State (Finance Form)
  const [calcQty, setCalcQty] = useState('4')
  const [calcUnitPrice, setCalcUnitPrice] = useState('450')

  // Contact number validation state (11 digits mobile, 7-10 landline)
  const [contactValue, setContactValue] = useState('09171234567')
  const [contactMode, setContactMode] = useState<'mobile' | 'landline'>('mobile')

  // Bulk Actions & Processing State
  const [bulkLoadingAction, setBulkLoadingAction] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<number | null>(null)
  const [buttonLoadingDemo, setButtonLoadingDemo] = useState(false)

  // Currency auto-comma formatter
  const handleCurrencyChange = (val: string) => {
    const clean = val.replace(/[^0-9.]/g, '')
    const parts = clean.split('.')
    if (parts.length > 2) return
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    setCurrencyAmount(parts.join('.'))
  }

  // Contact number handler
  const handleContactChange = (val: string) => {
    const digits = val.replace(/[^0-9]/g, '')
    const maxDigits = contactMode === 'mobile' ? 11 : 10
    setContactValue(digits.slice(0, maxDigits))
  }

  const rawContactDigits = contactValue.replace(/[^0-9]/g, '')
  const isMobileValid = contactMode === 'mobile' && rawContactDigits.length === 11 && rawContactDigits.startsWith('09')
  const isLandlineValid = contactMode === 'landline' && rawContactDigits.length >= 7 && rawContactDigits.length <= 10
  const isContactValid = contactMode === 'mobile' ? isMobileValid : isLandlineValid

  // Bulk action async simulation handler
  const handleBulkAction = (actionName: string) => {
    if (selectedRows.length === 0 || bulkLoadingAction) return
    setBulkLoadingAction(actionName)
    
    setTimeout(() => {
      if (actionName === 'approve') {
        triggerToast('success', 'Bulk Approval Complete', `${selectedRows.length} vouchers were authorized and marked Released.`)
      } else if (actionName === 'export') {
        triggerToast('info', 'Bulk Export Ready', `Generated PDF package for ${selectedRows.length} vouchers.`)
      } else if (actionName === 'delete') {
        triggerToast('error', 'Bulk Delete Complete', `${selectedRows.length} records were permanently removed.`)
      }
      setSelectedRows([])
      setBulkLoadingAction(null)
    }, 1400)
  }

  // Batch process async simulation handler
  const handleSimulateBatchProcess = () => {
    if (batchProgress !== null) return
    setBatchProgress(10)
    const interval = setInterval(() => {
      setBatchProgress(prev => {
        if (prev === null) {
          clearInterval(interval)
          return null
        }
        if (prev >= 100) {
          clearInterval(interval)
          setTimeout(() => {
            setBatchProgress(null)
            triggerToast('success', 'Batch Synchronization Complete', 'Successfully processed and synchronized 25 member records.')
          }, 300)
          return 100
        }
        return prev + 20
      })
    }, 350)
  }

  const members = [
    { id: '1', ref: 'REQ-2026-0042', name: 'Bro. Gabriel Dela Cruz', role: 'Head Coordinator', ministry: 'Knights of the Altar', amount: 'PHP 4,850.00', status: 'Released' },
    { id: '2', ref: 'REQ-2026-0043', name: 'Sis. Maria Elena Santos', role: 'Lector Coordinator', ministry: 'Lectors & Commentators', amount: 'PHP 2,400.00', status: 'Pending' },
    { id: '3', ref: 'REQ-2026-0044', name: 'Bro. John Mark Bautista', role: 'Senior Minister', ministry: 'Liturgical Servants', amount: 'PHP 3,100.00', status: 'Closed' },
    { id: '4', ref: 'REQ-2026-0045', name: 'Sis. Anna Therese Lim', role: 'Choir Director', ministry: 'Music Ministry', amount: 'PHP 1,500.00', status: 'Released' },
    { id: '5', ref: 'REQ-2026-0046', name: 'Bro. Rafael De Guzman', role: 'Lead Usher', ministry: 'Hospitality Ministry', amount: 'PHP 850.00', status: 'Archived' },
  ]

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(comboboxQuery.toLowerCase()) ||
    m.ministry.toLowerCase().includes(comboboxQuery.toLowerCase())
  )

  const triggerToast = (type: 'success' | 'info' | 'warning' | 'error', title: string, message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4500)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModal(null)
        setComboboxOpen(false)
        setActionMenuOpen(false)
        setFilterMinistryOpen(false)
        setFilterStatusOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white w-full overflow-x-hidden">
      {/* Top Header - Authentic MATS White Theme */}
      <header className="sticky top-0 z-40 bg-white text-slate-900 border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="h-9 w-9 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center font-black text-white shadow-sm shadow-blue-500/25">
              M
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-bold tracking-tight text-slate-900 text-xs sm:text-sm truncate">MATS Design Standard</span>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 shrink-0">
                  Finance-Aligned
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block truncate">
                Official 21-Component Standard Aligned with Finance & Reports
              </p>
            </div>
          </div>

          {/* Viewport Simulation Controls */}
          <div className="flex items-center justify-between sm:justify-end space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setViewportMode('responsive')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition font-bold text-[11px] ${
                  viewportMode === 'responsive' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Responsive
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('desktop')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition font-bold text-[11px] hidden md:block ${
                  viewportMode === 'desktop' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('tablet')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition font-bold text-[11px] ${
                  viewportMode === 'tablet' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tablet
              </button>
              <button
                type="button"
                onClick={() => setViewportMode('mobile')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg transition font-bold text-[11px] ${
                  viewportMode === 'mobile' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mobile
              </button>
            </div>

            <Link
              to="/"
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 transition border border-slate-200/80 shadow-2xs shrink-0"
            >
              <span>Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8 gap-6 min-w-0">
        {/* Left Navigation Sidebar */}
        <aside className="w-64 shrink-0 hidden lg:block">
          <div className="sticky top-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-3 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3 py-2">
              Design Components (21)
            </h2>
            {SECTIONS.map((sec) => (
              <a
                key={sec.id}
                href={`#${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                className={`block px-3 py-2 rounded-xl text-xs font-bold transition truncate ${
                  activeSection === sec.id
                    ? 'bg-blue-50 text-blue-700 shadow-2xs ring-1 ring-blue-600/10'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {sec.label}
              </a>
            ))}
          </div>
        </aside>

        {/* Content Area */}
        <main className={`flex-1 min-w-0 w-full transition-all duration-300 mx-auto space-y-6 ${
          viewportMode === 'mobile' ? 'max-w-[390px] border-x border-slate-300 bg-white p-3.5 sm:p-4 rounded-3xl shadow-xl' :
          viewportMode === 'tablet' ? 'max-w-[768px] border-x border-slate-300 bg-white p-4 sm:p-6 rounded-3xl shadow-xl' :
          viewportMode === 'desktop' ? 'max-w-[1280px]' : 'w-full'
        }`}>

          {/* Top Banner - Authentic MATS Blue Header */}
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-blue-600/20 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-4 sm:p-6 text-white shadow-md">
            <div className={`relative z-10 flex ${isMobile ? 'flex-col items-start' : 'flex-col md:flex-row md:items-center'} justify-between gap-4`}>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Phase 1 Design Preview</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-white/40"></span>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                    Ready for Approval
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black text-white break-words">MATS Component & UI/UX Standards</h1>
                <p className="text-xs text-blue-100/90 max-w-xl leading-relaxed">
                  Standardized UI system strictly aligned with the authentic Finance and Reports design language.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 1: BUTTONS */}
          <section id="sec-buttons" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">1. Buttons and Action Controls</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Variants, heights (36px Dense, 40px Default, 44px Public), and touch states.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Variants (40px Default Height)</h3>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button type="button" className="h-10 px-3.5 sm:px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm shadow-blue-500/25 ring-1 ring-blue-700/20 transition active:scale-98 inline-flex items-center space-x-1.5">
                    <Icons.Plus className="w-4 h-4 shrink-0" />
                    <span>Primary</span>
                  </button>
                  <button type="button" className="h-10 px-3.5 sm:px-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200/80 shadow-2xs transition active:scale-98 inline-flex items-center space-x-1.5">
                    <Icons.Edit className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Secondary</span>
                  </button>
                  <button type="button" className="h-10 px-3.5 sm:px-4 rounded-xl hover:bg-slate-100 text-slate-600 font-bold text-xs transition active:scale-98 inline-flex items-center space-x-1.5">
                    <span>Ghost</span>
                  </button>
                  <button type="button" className="h-10 px-3.5 sm:px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm shadow-rose-500/25 ring-1 ring-rose-700/20 transition active:scale-98 inline-flex items-center space-x-1.5">
                    <Icons.Trash className="w-4 h-4 shrink-0" />
                    <span>Danger</span>
                  </button>
                  <button type="button" className="h-10 px-3.5 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-500/25 ring-1 ring-emerald-700/20 transition active:scale-98 inline-flex items-center space-x-1.5">
                    <Icons.Check className="w-4 h-4 shrink-0" />
                    <span>Success</span>
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Sizes Hierarchy</h3>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button type="button" className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition inline-flex items-center space-x-1.5">
                    <Icons.Plus className="w-3.5 h-3.5" />
                    <span>Dense 36px</span>
                  </button>
                  <button type="button" className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center space-x-2">
                    <Icons.Plus className="w-4 h-4" />
                    <span>Standard 40px</span>
                  </button>
                  <button type="button" className="h-11 px-4 sm:px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md transition inline-flex items-center space-x-2">
                    <Icons.Plus className="w-4 h-4" />
                    <span>Public 44px (Touch)</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Button Loading States</h3>
                  <button
                    type="button"
                    onClick={() => setButtonLoadingDemo(!buttonLoadingDemo)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    {buttonLoadingDemo ? 'Stop Loading' : 'Simulate Loading'}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={buttonLoadingDemo}
                    className="h-10 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm disabled:opacity-75 inline-flex items-center space-x-2 transition"
                  >
                    {buttonLoadingDemo ? (
                      <>
                        <Icons.Spinner className="w-4 h-4 text-white" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Check className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={buttonLoadingDemo}
                    className="h-10 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-sm disabled:opacity-75 inline-flex items-center space-x-2 transition"
                  >
                    {buttonLoadingDemo ? (
                      <>
                        <Icons.Spinner className="w-4 h-4 text-white" />
                        <span>Deleting Records...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Trash className="w-4 h-4" />
                        <span>Delete Selection</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: FORM INPUTS WITH VALIDATION */}
          <section id="sec-inputs" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">2. Form Inputs & Front-End Validations</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-comma currency formatting, 11-digit mobile and 7-10 landline validation with live status.
              </p>
            </div>

            <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
              {/* Dynamic Currency / Amount with Auto Comma */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-bold text-slate-900 truncate">
                    Disbursement Amount <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md shrink-0">
                    Auto-Comma
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold font-mono text-xs">
                    PHP
                  </span>
                  <input
                    type="text"
                    value={currencyAmount}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 pl-14 pr-4 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  Automatically adds thousand commas (<span className="font-mono font-bold text-blue-700">{currencyAmount || '0.00'}</span>).
                </p>
              </div>

              {/* Dynamic Contact Number with 11-digit mobile / 7-10 landline rule */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-slate-900 truncate">
                      Contact Number <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md shrink-0">
                      {contactMode === 'mobile' ? '11 Digits' : '7-10 Digits'}
                    </span>
                  </div>

                  {/* Mode Switcher Buttons */}
                  <div className={`flex items-center bg-slate-200/60 p-0.5 rounded-lg border border-slate-300/50 text-[10px] font-bold ${isMobile ? 'w-full grid grid-cols-2' : 'w-fit'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setContactMode('mobile')
                        setContactValue('09171234567')
                      }}
                      className={`px-2.5 py-1 rounded-md transition text-center ${contactMode === 'mobile' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Mobile (09xx)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setContactMode('landline')
                        setContactValue('81234567')
                      }}
                      className={`px-2.5 py-1 rounded-md transition text-center ${contactMode === 'landline' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Landline (7-10)
                    </button>
                  </div>
                </div>

                {/* Input with dedicated right padding (pr-10) and right status icon */}
                <div className="relative">
                  <input
                    type="text"
                    value={contactValue}
                    onChange={(e) => handleContactChange(e.target.value)}
                    placeholder={contactMode === 'mobile' ? "09171234567" : "81234567"}
                    className={`w-full h-10 pl-3.5 pr-10 rounded-xl border bg-white font-mono text-xs font-bold transition focus:outline-none focus:ring-2 ${
                      isContactValid
                        ? 'border-emerald-300 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-600'
                        : 'border-rose-300 text-rose-900 bg-rose-50/20 focus:ring-rose-500/20 focus:border-rose-600'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {isContactValid ? (
                      <Icons.CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Icons.AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    )}
                  </div>
                </div>

                {/* Helper Text and Live Digit Count */}
                <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-medium pt-0.5">
                  <span className={isContactValid ? 'text-slate-500' : 'text-rose-600 font-semibold'}>
                    {contactMode === 'mobile'
                      ? (isMobileValid ? 'Valid 11-digit mobile format.' : 'Mobile must be 11 digits starting with 09.')
                      : (isLandlineValid ? 'Valid landline length.' : 'Landline must be 7 to 10 digits.')}
                  </span>
                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${isContactValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {rawContactDigits.length}/{contactMode === 'mobile' ? '11' : '7-10'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  defaultValue="Bro. Gabriel Dela Cruz"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Ministry Designation</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Icons.Users className="w-4 h-4" />
                  </span>
                  <select className="w-full h-10 pl-10 pr-10 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition cursor-pointer shadow-2xs">
                    <option>Knights of the Altar</option>
                    <option>Liturgical Servants (EMHC)</option>
                    <option>Lectors and Commentators</option>
                    <option>Music Ministry</option>
                    <option>Hospitality Ministry</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <Icons.ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: COMBOBOX */}
          <section id="sec-combobox" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">3. Searchable Member Combobox</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Keyboard accessible autocomplete with clear trigger and mobile safe dropdown.
              </p>
            </div>

            <div className="max-w-lg w-full">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Serving Member *</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Icons.Users className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={comboboxOpen ? comboboxQuery : (comboboxSelected || '')}
                  onChange={(e) => {
                    setComboboxQuery(e.target.value)
                    if (!comboboxOpen) setComboboxOpen(true)
                  }}
                  onFocus={() => setComboboxOpen(true)}
                  placeholder="Search by name..."
                  className="w-full h-10 pl-10 pr-20 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center space-x-1">
                  {comboboxSelected && (
                    <button
                      type="button"
                      onClick={() => {
                        setComboboxSelected(null)
                        setComboboxQuery('')
                      }}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      <Icons.Close className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setComboboxOpen(!comboboxOpen)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    <Icons.ChevronDown className={`w-4 h-4 transition-transform ${comboboxOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {comboboxOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 max-h-56 overflow-y-auto p-1.5 space-y-1">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setComboboxSelected(m.name)
                          setComboboxOpen(false)
                          setComboboxQuery('')
                        }}
                        className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between text-xs transition ${
                          comboboxSelected === m.name ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-slate-900 truncate">{m.name}</div>
                          <div className="text-slate-500 text-[11px] truncate">{m.ministry}</div>
                        </div>
                        {comboboxSelected === m.name && <Icons.Check className="w-4 h-4 text-blue-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 4: MODAL SYSTEM (EXACT FINANCE REQUISITION MODAL) */}
          <section id="sec-modals" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">4. Modal and Dialog System</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact Finance modal layout: category badge, source cards, itemized breakdown, and responsive sticky footer.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('finance-modal')}
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/25 transition inline-flex items-center space-x-2"
            >
              <Icons.Plus className="w-4 h-4" />
              <span>Open Finance Requisition Modal</span>
            </button>

            {/* Modal Overlay */}
            {activeModal === 'finance-modal' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-2 sm:p-4 animate-fade-in">
                <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
                  <div className="p-3.5 sm:p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                    <div className="min-w-0 pr-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                        Procurement & Requisition
                      </span>
                      <h4 className="text-sm sm:text-base font-black text-gray-900 mt-0.5 truncate">Request Allocation Funds</h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg hover:bg-gray-100 shrink-0"
                    >
                      <Icons.Close className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">1. Request Details & Source</h5>
                      <div className={`grid grid-cols-1 ${isMobile ? '' : 'sm:grid-cols-2'} gap-2.5`}>
                        <div className="p-3 rounded-xl border bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-2xs flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs shrink-0">
                            <Icons.Wallet className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-black text-blue-950 block truncate">Main Ministry Funds</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Disbursed from internal treasury</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl border bg-white border-slate-200 text-slate-600 flex items-start gap-2.5">
                          <div className="p-2 rounded-lg bg-slate-100 text-slate-600 shrink-0">
                            <Icons.FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-black text-slate-800 block truncate">Parish Direct Funds</span>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">Requested from Parish Priest</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <h5 className="text-[11px] font-black text-slate-800 uppercase tracking-tight">2. Itemized Breakdown</h5>
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs min-w-[280px]">
                          <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2">Item Description</th>
                              <th className="p-2 w-14 text-center">Qty</th>
                              <th className="p-2 w-20 text-right">Unit Price</th>
                              <th className="p-2 w-24 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <tr>
                              <td className="p-2 font-medium text-slate-900">Altar Candles (Pack of 12)</td>
                              <td className="p-2 text-center font-bold">4</td>
                              <td className="p-2 text-right font-mono">PHP 450</td>
                              <td className="p-2 text-right font-mono font-bold text-blue-700">PHP 1,800</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className={`p-3.5 sm:p-4 bg-slate-50 border-t border-gray-100 flex ${isMobile ? 'flex-col' : 'flex-col sm:flex-row'} items-center justify-end gap-2`}>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-200 text-xs font-semibold rounded-xl hover:bg-gray-100 bg-white text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null)
                        triggerToast('success', 'Requisition Submitted', 'Fund request routed for verification.')
                      }}
                      className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20 text-center"
                    >
                      Submit Requisition
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 5: CONFIRMATION & ALERT DIALOGS */}
          <section id="sec-confirmations" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">5. Confirmation & Alert Dialogs</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Destructive action verification modal with high-contrast warning cues and focus locks.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal('confirm-modal')}
              className="h-10 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-500/25 transition inline-flex items-center space-x-2"
            >
              <Icons.Trash className="w-4 h-4" />
              <span>Open Danger Confirmation Modal</span>
            </button>

            {activeModal === 'confirm-modal' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
                <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-5 shadow-2xl space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0">
                      <Icons.AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-slate-900">Delete Attendance Session?</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        This action will permanently delete Sunday 6:00 AM Mass records for 18 servers. This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-50 bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal(null)
                        triggerToast('error', 'Session Deleted', 'The attendance session was permanently removed.')
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-500/20"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* SECTION 6: TOAST NOTIFICATION STACKS */}
          <section id="sec-toasts" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">6. Toast Notification Stacks</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Interactive toast triggers for Success, Info, Warning, and Error messages.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => triggerToast('success', 'Attendance Recorded', 'Bro. Gabriel Dela Cruz marked Present for 6:00 AM Mass.')}
                className="h-10 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-500/25 transition inline-flex items-center space-x-1.5"
              >
                <Icons.CheckCircle className="w-4 h-4 shrink-0" />
                <span>Trigger Success Toast</span>
              </button>

              <button
                type="button"
                onClick={() => triggerToast('info', 'Schedule Updated', 'Schedule published for Knights of the Altar.')}
                className="h-10 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-500/25 transition inline-flex items-center space-x-1.5"
              >
                <Icons.Wallet className="w-4 h-4 shrink-0" />
                <span>Trigger Info Toast</span>
              </button>

              <button
                type="button"
                onClick={() => triggerToast('warning', 'Low Fund Balance', 'Parish general funds is below 10,000 threshold.')}
                className="h-10 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-sm shadow-amber-500/25 transition inline-flex items-center space-x-1.5"
              >
                <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                <span>Trigger Warning Toast</span>
              </button>

              <button
                type="button"
                onClick={() => triggerToast('error', 'Operation Failed', 'Network timeout while synchronizing ledger records.')}
                className="h-10 px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm shadow-rose-500/25 transition inline-flex items-center space-x-1.5"
              >
                <Icons.AlertCircle className="w-4 h-4 shrink-0" />
                <span>Trigger Error Toast</span>
              </button>
            </div>
          </section>

          {/* SECTION 7: CARDS */}
          <section id="sec-cards" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">7. Cards & Surface Elevation</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Responsive metric KPI cards with bold typography and inset icon containers.
              </p>
            </div>

            <div className={`grid grid-cols-1 ${isMobile ? '' : 'sm:grid-cols-2 lg:grid-cols-3'} gap-3.5`}>
              <div className="p-4 sm:p-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 text-emerald-950 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Current Balance</span>
                  <div className="p-2 rounded-xl bg-emerald-100/80 border border-emerald-200 text-emerald-700">
                    <Icons.Wallet className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-emerald-700 break-words">PHP 48,250.00</div>
                  <span className="text-[10px] font-semibold text-emerald-600 block mt-1">Total Collections − Expenses</span>
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Monthly Collections</span>
                  <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600">
                    <Icons.TrendUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-blue-600 break-words">PHP 32,400.00</div>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">This month collections</span>
                </div>
              </div>

              <div className={`p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex flex-col justify-between ${isMobile ? '' : 'sm:col-span-2 lg:col-span-1'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Active Ministers</span>
                  <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
                    <Icons.Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-xl sm:text-2xl font-black text-indigo-600 break-words">148 Members</div>
                  <span className="text-[10px] font-semibold text-slate-400 block mt-1">Across 4 ministries</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 8: TABLE & DATAGRID */}
          <section id="sec-table" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className={`flex ${isMobile ? 'flex-col items-start' : 'flex-col sm:flex-row sm:items-center'} justify-between pb-3 mb-5 border-b border-slate-100 gap-3`}>
              <div>
                <h2 className="text-base font-bold text-slate-900">8. Standard & Dense Data Table</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Responsive horizontal overflow scroll with sticky header and density toggle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTableDense(!tableDense)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition w-fit ${
                  tableDense ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                {tableDense ? 'Dense Mode: ON (36px)' : 'Dense Mode: OFF (44px)'}
              </button>
            </div>

            {/* Bulk Actions Floating / Inline Toolbar with Loading Indicator */}
            {selectedRows.length > 0 && (
              <div className={`mb-3.5 p-2.5 sm:p-3 bg-slate-900 text-white rounded-2xl shadow-lg border border-slate-800 flex ${isMobile ? 'flex-col items-stretch' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-2.5 animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-black">
                    {selectedRows.length} Selected
                  </span>
                  <span className={`text-xs text-slate-300 font-medium ${isMobile ? 'hidden' : 'hidden sm:inline'}`}>
                    Bulk operations for selected vouchers
                  </span>
                </div>

                <div className={`flex items-center flex-wrap gap-2 w-full ${isMobile ? 'justify-start' : 'sm:w-auto sm:justify-end'}`}>
                  <button
                    type="button"
                    disabled={bulkLoadingAction !== null}
                    onClick={() => handleBulkAction('approve')}
                    className="h-8 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 inline-flex items-center space-x-1.5"
                  >
                    {bulkLoadingAction === 'approve' ? (
                      <>
                        <Icons.Spinner className="w-3.5 h-3.5" />
                        <span>Approving ({selectedRows.length})...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Check className="w-3.5 h-3.5" />
                        <span>Bulk Approve</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={bulkLoadingAction !== null}
                    onClick={() => handleBulkAction('export')}
                    className="h-8 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition disabled:opacity-50 inline-flex items-center space-x-1.5"
                  >
                    {bulkLoadingAction === 'export' ? (
                      <>
                        <Icons.Spinner className="w-3.5 h-3.5" />
                        <span>Exporting...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Download className="w-3.5 h-3.5" />
                        <span>Bulk Export</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={bulkLoadingAction !== null}
                    onClick={() => handleBulkAction('delete')}
                    className="h-8 px-3 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition disabled:opacity-50 inline-flex items-center space-x-1.5"
                  >
                    {bulkLoadingAction === 'delete' ? (
                      <>
                        <Icons.Spinner className="w-3.5 h-3.5" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Icons.Trash className="w-3.5 h-3.5" />
                        <span>Bulk Delete</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={bulkLoadingAction !== null}
                    onClick={() => setSelectedRows([])}
                    className="h-8 px-2 text-slate-400 hover:text-white text-xs font-semibold"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-2xs w-full">
              <table className="w-full text-left border-collapse text-xs min-w-[540px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedRows.length === members.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRows(members.map((_, i) => i))
                          else setSelectedRows([])
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-3">Reference / Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Ministry</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {members.map((m, idx) => {
                    const isSelected = selectedRows.includes(idx)
                    return (
                      <tr key={m.id} className={`transition ${isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'} ${tableDense ? 'py-1' : 'py-2.5'}`}>
                        <td className={`text-center ${tableDense ? 'p-2' : 'p-3'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedRows([...selectedRows, idx])
                              else setSelectedRows(selectedRows.filter(i => i !== idx))
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className={`${tableDense ? 'p-2' : 'p-3'}`}>
                          <div className="font-bold text-slate-900">{m.name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{m.ref}</div>
                        </td>
                        <td className={`${tableDense ? 'p-2' : 'p-3'}`}>{m.role}</td>
                        <td className={`${tableDense ? 'p-2' : 'p-3'}`}>{m.ministry}</td>
                        <td className={`font-mono font-bold text-slate-900 ${tableDense ? 'p-2' : 'p-3'}`}>{m.amount}</td>
                        <td className={`${tableDense ? 'p-2' : 'p-3'}`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            m.status === 'Released' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            m.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION 9: PAGINATION CONTROLS */}
          <section id="sec-pagination" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">9. Pagination Controls</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard pagination bar with item counter and touch-friendly page step buttons.
              </p>
            </div>

            <div className={`flex ${isMobile ? 'flex-col items-center text-center' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs`}>
              <span className="text-slate-500 font-medium">
                Showing <strong className="text-slate-900">1 - 5</strong> of <strong className="text-slate-900">48</strong> records
              </span>

              <div className={`flex items-center space-x-1.5 ${isMobile ? 'self-center' : 'self-center sm:self-auto'}`}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 font-bold hover:bg-slate-100 transition inline-flex items-center gap-1"
                >
                  <Icons.ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                {[1, 2, 3].map(page => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg font-bold text-xs transition ${
                      currentPage === page ? 'bg-blue-600 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === 3}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, 3))}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-40 font-bold hover:bg-slate-100 transition inline-flex items-center gap-1"
                >
                  <span>Next</span>
                  <Icons.ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 10: BADGES & STATUS PILLS */}
          <section id="sec-badges" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">10. Badges and Status Indicators</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Semantic status badges with crisp borders and soft backgrounds.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Active / Present
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                Pending Verification
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                Disbursed Funds
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                Absent / Overdue
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                Archived Record
              </span>
            </div>
          </section>

          {/* SECTION 11: TABS */}
          <section id="sec-tabs" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">11. Tabs & Segmented Switchers</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Horizontal touch swipe tab strip with badge counters.
              </p>
            </div>

            <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto w-full">
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 px-0.5 flex-1 shrink-0">
                {[
                  { key: 'dashboard', label: 'Treasury Dashboard', icon: <Icons.Dashboard className="w-4 h-4" /> },
                  { key: 'requests', label: 'Fund Requests', badge: '3', icon: <Icons.FileText className="w-4 h-4" /> },
                  { key: 'incomes', label: 'Income Ledger', icon: <Icons.TrendUp className="w-4 h-4" /> },
                ].map((t) => {
                  const isActive = financePillTab === t.key
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setFinancePillTab(t.key as any)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition shrink-0 ${
                        isActive ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{t.icon}</span>
                      <span className="whitespace-nowrap">{t.label}</span>
                      {t.badge && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                          isActive ? 'bg-white text-blue-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {t.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* SECTION 12: PAGE HEADER STANDARD */}
          <section id="sec-header" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">12. Page Header Standard</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standardized module page header with breadcrumb hierarchy and responsive actions.
              </p>
            </div>

            <div className={`p-4 rounded-xl bg-slate-50 border border-slate-200 flex ${isMobile ? 'flex-col items-start' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-3`}>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-400 mb-1">
                  <span>Finance</span>
                  <Icons.ChevronRight className="w-3 h-3" />
                  <span className="text-blue-600 font-bold">Disbursement Records</span>
                </div>
                <h3 className="text-lg font-black text-slate-900">Parish Fund Disbursements</h3>
                <p className="text-xs text-slate-500 mt-0.5">Monitor and authorize fund release vouchers.</p>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button type="button" className="h-9 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs shadow-2xs hover:bg-slate-50 transition inline-flex items-center gap-1.5">
                  <Icons.Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export</span>
                </button>
                <button type="button" className="h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-1.5">
                  <Icons.Plus className="w-3.5 h-3.5" />
                  <span>New Voucher</span>
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 13: FILTER BAR STANDARD */}
          <section id="sec-filters" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">13. Filter Bar Standard & Custom Filter Dropdowns</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Custom-designed filter triggers with popovers, semantic status indicators, search, and quick-filter pills.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-200/60 px-2.5 py-1 rounded-lg w-fit">
                Interactive Filter Engine
              </span>
            </div>

            <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
              {/* Main Controls Grid */}
              <div className={`grid grid-cols-1 ${isMobile ? 'gap-2.5' : 'sm:grid-cols-12 gap-2.5'}`}>
                
                {/* Search Input (5 cols) */}
                <div className={`relative ${isMobile ? 'col-span-1' : 'sm:col-span-5'}`}>
                  <Icons.Search className="w-4 h-4 absolute inset-y-0 left-3.5 my-auto text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Search voucher, reference, or minister..."
                    className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition shadow-2xs"
                  />
                  {filterSearch && (
                    <button
                      type="button"
                      onClick={() => setFilterSearch('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      <Icons.Close className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Custom Ministry Filter Dropdown (3 cols) */}
                <div className={`relative ${isMobile ? 'col-span-1' : 'sm:col-span-3'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMinistryOpen(!filterMinistryOpen)
                      setFilterStatusOpen(false)
                    }}
                    className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs ${
                      filterMinistry !== 'all' || filterMinistryOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        filterMinistry === 'koa' ? 'bg-blue-500' :
                        filterMinistry === 'emhc' ? 'bg-indigo-500' :
                        filterMinistry === 'lectors' ? 'bg-amber-500' :
                        filterMinistry === 'music' ? 'bg-emerald-500' :
                        'bg-slate-400'
                      }`} />
                      <span className="truncate">
                        {filterMinistry === 'all' ? 'All Ministries' :
                         filterMinistry === 'koa' ? 'Knights of Altar' :
                         filterMinistry === 'emhc' ? 'EMHC Ministers' :
                         filterMinistry === 'lectors' ? 'Lectors' :
                         filterMinistry === 'music' ? 'Music Ministry' : 'Ministry'}
                      </span>
                    </div>
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${filterMinistryOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>

                  {/* Ministry Popover Menu */}
                  {filterMinistryOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[200px]">
                      <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Select Ministry
                      </div>
                      {[
                        { key: 'all', label: 'All Ministries', dot: 'bg-slate-400', count: '48' },
                        { key: 'koa', label: 'Knights of the Altar', dot: 'bg-blue-500', count: '18' },
                        { key: 'emhc', label: 'Liturgical Servants (EMHC)', dot: 'bg-indigo-500', count: '14' },
                        { key: 'lectors', label: 'Lectors and Commentators', dot: 'bg-amber-500', count: '10' },
                        { key: 'music', label: 'Music Ministry', dot: 'bg-emerald-500', count: '6' },
                      ].map((m) => {
                        const isSelected = filterMinistry === m.key
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => {
                              setFilterMinistry(m.key)
                              setFilterMinistryOpen(false)
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0 pr-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${m.dot}`} />
                              <span className="truncate">{m.label}</span>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <span className="text-[10px] text-slate-400 font-mono font-normal">({m.count})</span>
                              {isSelected && <Icons.Check className="w-3.5 h-3.5 text-blue-600" />}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Status Filter Dropdown (2.5 cols) */}
                <div className={`relative ${isMobile ? 'col-span-1' : 'sm:col-span-2'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatusOpen(!filterStatusOpen)
                      setFilterMinistryOpen(false)
                    }}
                    className={`w-full h-10 px-3 rounded-xl border bg-white flex items-center justify-between gap-2 transition text-xs shadow-2xs ${
                      filterStatus !== 'all' || filterStatusOpen
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40 text-blue-950 font-bold'
                        : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 pr-1">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        filterStatus === 'Released' ? 'bg-emerald-500' :
                        filterStatus === 'Pending' ? 'bg-amber-500' :
                        filterStatus === 'Closed' ? 'bg-blue-500' :
                        filterStatus === 'Archived' ? 'bg-slate-500' :
                        'bg-slate-400'
                      }`} />
                      <span className="truncate">
                        {filterStatus === 'all' ? 'All Status' : filterStatus}
                      </span>
                    </div>
                    <Icons.ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${filterStatusOpen ? 'rotate-180 text-blue-600' : ''}`} />
                  </button>

                  {/* Status Popover Menu */}
                  {filterStatusOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl z-30 p-1.5 space-y-0.5 animate-in fade-in zoom-in-95 min-w-[190px]">
                      <div className="px-2.5 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Select Status
                      </div>
                      {[
                        { key: 'all', label: 'All Statuses', dot: 'bg-slate-400' },
                        { key: 'Released', label: 'Released / Disbursed', dot: 'bg-emerald-500' },
                        { key: 'Pending', label: 'Pending Review', dot: 'bg-amber-500' },
                        { key: 'Closed', label: 'Closed / Settled', dot: 'bg-blue-500' },
                        { key: 'Archived', label: 'Archived', dot: 'bg-slate-500' },
                      ].map((s) => {
                        const isSelected = filterStatus === s.key
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() => {
                              setFilterStatus(s.key)
                              setFilterStatusOpen(false)
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-xs transition ${
                              isSelected
                                ? 'bg-blue-50 text-blue-900 font-bold shadow-2xs'
                                : 'hover:bg-slate-50 text-slate-700 font-medium'
                            }`}
                          >
                            <div className="flex items-center space-x-2 min-w-0 pr-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                              <span className="truncate">{s.label}</span>
                            </div>
                            {isSelected && <Icons.Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Reset Filters Action Button (2 cols) */}
                <div className={`${isMobile ? 'col-span-1' : 'sm:col-span-2'}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterSearch('')
                      setFilterMinistry('all')
                      setFilterStatus('all')
                      setFilterMinistryOpen(false)
                      setFilterStatusOpen(false)
                    }}
                    className={`w-full h-10 px-3 rounded-xl border font-bold text-xs transition inline-flex items-center justify-center gap-1.5 shadow-2xs ${
                      filterSearch || filterMinistry !== 'all' || filterStatus !== 'all'
                        ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/80 active:scale-98'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icons.Filter className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {filterSearch || filterMinistry !== 'all' || filterStatus !== 'all'
                        ? `Reset (${[filterSearch ? 1 : 0, filterMinistry !== 'all' ? 1 : 0, filterStatus !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)})`
                        : 'Reset Filters'}
                    </span>
                  </button>
                </div>

              </div>

              {/* Quick Filter Pill Tags Strip */}
              <div className="pt-2 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 pr-1">
                  Quick Filters:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMinistry('all')
                    setFilterStatus('all')
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 border ${
                    filterMinistry === 'all' && filterStatus === 'all'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  All Records (48)
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('Pending')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 border inline-flex items-center gap-1.5 ${
                    filterStatus === 'Pending'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Pending Review (1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('Released')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 border inline-flex items-center gap-1.5 ${
                    filterStatus === 'Released'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Released Vouchers (2)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMinistry('koa')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition shrink-0 border inline-flex items-center gap-1.5 ${
                    filterMinistry === 'koa'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                  <span>Knights of Altar (18)</span>
                </button>
              </div>

              {/* Active Filter Chips Summary */}
              {(filterSearch || filterMinistry !== 'all' || filterStatus !== 'all') && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] animate-in fade-in">
                  <span className="text-slate-400 font-medium text-[10px]">Active Filters:</span>
                  {filterSearch && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-800 font-bold border border-blue-200">
                      Search: &ldquo;{filterSearch}&rdquo;
                      <button type="button" onClick={() => setFilterSearch('')} className="hover:text-blue-950">
                        <Icons.Close className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterMinistry !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 font-bold border border-indigo-200">
                      Ministry: {filterMinistry.toUpperCase()}
                      <button type="button" onClick={() => setFilterMinistry('all')} className="hover:text-indigo-950">
                        <Icons.Close className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filterStatus !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 font-bold border border-emerald-200">
                      Status: {filterStatus}
                      <button type="button" onClick={() => setFilterStatus('all')} className="hover:text-emerald-950">
                        <Icons.Close className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 14: EMPTY STATES */}
          <section id="sec-empty" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">14. Empty State Pattern</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Clear visual feedback when no records exist or search matches nothing.
              </p>
            </div>

            <div className="p-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
                <Icons.Inbox className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No Requisition Records Found</h4>
              <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                There are currently no active fund requisition vouchers matching your search filters.
              </p>
              <button
                type="button"
                onClick={() => setActiveModal('finance-modal')}
                className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition inline-flex items-center space-x-1.5"
              >
                <Icons.Plus className="w-4 h-4" />
                <span>Create Requisition Voucher</span>
              </button>
            </div>
          </section>

          {/* SECTION 15: LOADING & SKELETONS */}
          <section id="sec-loading" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">15. Loading & Skeleton Shimmers</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk action progress bars, interactive loading buttons, and skeleton placeholders.
              </p>
            </div>

            <div className="space-y-4">
              {/* Interactive Bulk Processing Demo */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className={`flex ${isMobile ? 'flex-col items-stretch' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-2`}>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Batch Async Operation Loader</h4>
                    <p className="text-[11px] text-slate-500">Simulates bulk transaction commits and batch synchronization.</p>
                  </div>
                  <button
                    type="button"
                    disabled={batchProgress !== null}
                    onClick={handleSimulateBatchProcess}
                    className={`h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 inline-flex items-center space-x-1.5 ${isMobile ? 'w-full justify-center' : 'self-start sm:self-auto shrink-0'}`}
                  >
                    {batchProgress !== null ? (
                      <>
                        <Icons.Spinner className="w-3.5 h-3.5" />
                        <span>Processing {batchProgress}%...</span>
                      </>
                    ) : (
                      <span>Simulate Batch Write (25 records)</span>
                    )}
                  </button>
                </div>

                {batchProgress !== null && (
                  <div className="space-y-1.5 pt-1 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                      <span>Synchronizing vouchers & attendance batches...</span>
                      <span className="font-mono text-blue-600 font-bold">{batchProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden border border-slate-300/60">
                      <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${batchProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Shimmer Skeleton Placeholder */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center space-x-3">
                  <Icons.Spinner className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-700">Fetching Firestore documents...</span>
                </div>
                <div className="space-y-2 animate-pulse pt-2">
                  <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                  <div className="h-4 bg-slate-200 rounded-md w-1/2"></div>
                  <div className="h-4 bg-slate-200 rounded-md w-5/6"></div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 16: ERROR & BANNER ALERTS */}
          <section id="sec-errors" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">16. Error & Inline Banner Alerts</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                High-contrast alert banners for operational status and system alerts.
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 flex items-start gap-2.5 text-xs">
                <Icons.AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <strong className="font-bold block">Permission Warning:</strong>
                  <span>Your account lacks authorization to approve disbursement vouchers exceeding PHP 10,000.</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-start gap-2.5 text-xs">
                <Icons.AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <strong className="font-bold block">Audit Notice:</strong>
                  <span>Quarterly financial reconciliations are due in 4 days for MAS Treasury.</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 17: DROPDOWN & CONTEXT MENUS */}
          <section id="sec-dropdowns" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">17. Dropdown & Context Menus</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Compact action menu with item icons and destructive action separation.
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-4">
              {/* Context Actions Menu */}
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => {
                    setActionMenuOpen(!actionMenuOpen)
                    setFilterMinistryOpen(false)
                  }}
                  className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs shadow-2xs hover:bg-slate-50 transition inline-flex items-center gap-1.5"
                >
                  <span>Row Actions Menu</span>
                  <Icons.MoreVertical className="w-4 h-4 text-slate-400" />
                </button>

                {actionMenuOpen && (
                  <div className="absolute left-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl z-30 p-1 space-y-0.5 text-xs animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false)
                        triggerToast('info', 'View Record', 'Opening document voucher details.')
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2"
                    >
                      <Icons.FileText className="w-4 h-4 text-slate-400" />
                      <span>View Voucher</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false)
                        triggerToast('info', 'Edit Record', 'Opening edit drawer.')
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2"
                    >
                      <Icons.Edit className="w-4 h-4 text-slate-400" />
                      <span>Edit Line Items</span>
                    </button>
                    <div className="border-t border-slate-100 my-1"></div>
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false)
                        setActiveModal('confirm-modal')
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-rose-50 text-rose-600 font-bold flex items-center gap-2"
                    >
                      <Icons.Trash className="w-4 h-4 text-rose-500" />
                      <span>Delete Record</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Filter Select Dropdown Badge Demo */}
              <div className="relative inline-block text-left">
                <button
                  type="button"
                  onClick={() => {
                    setFilterMinistryOpen(!filterMinistryOpen)
                    setActionMenuOpen(false)
                  }}
                  className="h-9 px-3 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 font-bold text-xs shadow-2xs hover:bg-blue-100/70 transition inline-flex items-center gap-2"
                >
                  <Icons.Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>Filter Dropdown Demo</span>
                  <span className="px-1.5 py-0.2 rounded-md bg-blue-600 text-white text-[10px] font-black">2</span>
                  <Icons.ChevronDown className={`w-3.5 h-3.5 text-blue-600 transition-transform ${filterMinistryOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>
          </section>

          {/* SECTION 18: NAVIGATION COMPONENTS */}
          <section id="sec-navigation" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">18. Navigation Components (Mobile & Sidebar)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Standard bottom mobile navigation bar with active blue indicator and touch safe bounds.
              </p>
            </div>

            <div className="p-2 bg-white text-slate-600 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-around text-[10px] font-bold">
              <div className="flex flex-col items-center gap-1 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 cursor-pointer">
                <Icons.Dashboard className="w-5 h-5" />
                <span>Dashboard</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-900 px-3 py-1.5 cursor-pointer transition">
                <Icons.Calendar className="w-5 h-5" />
                <span>Schedules</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-900 px-3 py-1.5 cursor-pointer transition">
                <Icons.Wallet className="w-5 h-5" />
                <span>Finance</span>
              </div>
              <div className="flex flex-col items-center gap-1 text-slate-500 hover:text-slate-900 px-3 py-1.5 cursor-pointer transition">
                <Icons.Users className="w-5 h-5" />
                <span>Members</span>
              </div>
            </div>
          </section>

          {/* SECTION 19: PUBLIC SCHEDULE BANNER */}
          <section id="sec-public" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">19. Public Schedule Publication Period Banner</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official publication period hero banner used across public schedule portal views.
              </p>
            </div>

            <div className={`p-4 sm:p-6 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 text-white rounded-2xl sm:rounded-3xl shadow-md border border-indigo-700/50 flex ${isMobile ? 'flex-col items-start' : 'flex-col sm:flex-row sm:items-center'} justify-between gap-3 sm:gap-4`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-xs">
                  <Icons.Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-200" />
                </div>
                <div>
                  <span className="text-[10px] sm:text-[11px] font-black text-indigo-300 uppercase tracking-widest block mb-0.5">
                    SCHEDULE PERIOD
                  </span>
                  <h3 className="text-base sm:text-xl font-black tracking-tight text-white">
                    March 2026 Sunday & Solemnity Masses
                  </h3>
                  <p className="text-[11px] text-indigo-200 font-semibold mt-0.5">
                    March 01, 2026 to March 31, 2026
                  </p>
                </div>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-100 border border-white/10 self-stretch sm:self-auto text-center shrink-0">
                Public Schedule
              </div>
            </div>
          </section>

          {/* SECTION 20: DENSE AUTO-COMPUTING ROWS */}
          <section id="sec-dense" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">20. Dense Data Financial UI Variant</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Auto-calculates item totals immediately upon updating Unit Price or Quantity.
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="font-bold text-slate-800">Auto-Calculating Item Line</div>
              <div className={`grid grid-cols-1 ${isMobile ? 'gap-2' : 'sm:grid-cols-4 gap-2'}`}>
                <input
                  type="text"
                  defaultValue="Liturgical Altar Candles"
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium"
                />
                <input
                  type="number"
                  value={calcQty}
                  onChange={(e) => setCalcQty(e.target.value)}
                  placeholder="Qty"
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                />
                <input
                  type="number"
                  value={calcUnitPrice}
                  onChange={(e) => setCalcUnitPrice(e.target.value)}
                  placeholder="Unit Price"
                  className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold"
                />
                <div className="h-9 px-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 flex items-center justify-between font-mono font-bold">
                  <span className="text-blue-600 text-[10px] font-sans">Computed:</span>
                  <span className="text-blue-800">PHP {((parseFloat(calcQty) || 0) * (parseFloat(calcUnitPrice) || 0)).toLocaleString()}.00</span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 21: PDF DOCUMENT VIEW */}
          <section id="sec-doc" className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs scroll-mt-20">
            <div className="border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-base font-bold text-slate-900">21. Full-Screen Document / PDF View</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact official MATS PDF document format: Uniform Header, tabular data, signatories, and standard footer.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-200/70 p-2 sm:p-4">
              <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs mb-3">
                <div className="flex items-center space-x-2 min-w-0 pr-2">
                  <Icons.FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="font-bold truncate">FRQ-091026_Fund_Requisition.pdf</span>
                </div>
                <button type="button" className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold flex items-center space-x-1 shadow-sm text-[11px] shrink-0">
                  <Icons.Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download PDF</span>
                </button>
              </div>

              {/* Printable Container with Horizontal Scroll for Mobile */}
              <div className="overflow-x-auto w-full pb-2">
                <div className="min-w-[480px] max-w-2xl mx-auto bg-white p-5 sm:p-8 rounded-xl shadow-xl border border-slate-300 text-slate-900 text-xs font-serif leading-relaxed">
                  
                  {/* Uniform PDF Header */}
                  <div className="flex items-start justify-between pb-3 border-b-2 border-slate-900 mb-4">
                    <div>
                      <h3 className="text-base font-serif font-bold italic text-slate-900 tracking-tight">
                        Ministry of Altar Servers
                      </h3>
                      <p className="font-sans text-[11px] text-slate-700 mt-0.5">
                        Sacred Heart of Jesus Parish - Mbs
                      </p>
                      <p className="font-sans text-[10px] text-slate-500">
                        Pilar Rd., Morning Breeze Subdivision, Caloocan City
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <div className="w-9 h-9 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center font-sans font-black text-[8px] text-slate-600 text-center p-1">
                        PARISH LOGO
                      </div>
                      <div className="w-9 h-9 rounded-full border border-slate-300 bg-slate-50 flex items-center justify-center font-sans font-black text-[8px] text-blue-700 text-center p-1">
                        MINISTRY LOGO
                      </div>
                    </div>
                  </div>

                  {/* Document Title */}
                  <div className="text-center my-3">
                    <h4 className="font-sans font-black text-sm uppercase tracking-wider text-slate-900">
                      FUND REQUISITION VOUCHER
                    </h4>
                    <p className="font-sans text-[10px] font-bold text-slate-500 mt-0.5 font-mono">
                      REF NO: REQ-2026-0042
                    </p>
                  </div>

                  {/* Signatories */}
                  <div className={`font-sans grid grid-cols-1 ${isMobile ? '' : 'sm:grid-cols-2'} gap-4 pt-4 mb-6 text-xs`}>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-4">Requested by:</span>
                      <div className="border-t border-slate-900 pt-1">
                        <p className="font-bold text-slate-900 uppercase text-[11px]">Bro. Gabriel Dela Cruz</p>
                        <p className="text-[9px] text-slate-600">Treasurer, MAS</p>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-4">Approved by:</span>
                      <div className="border-t border-slate-900 pt-1">
                        <p className="font-bold text-slate-900 uppercase text-[11px]">Bro. Kyle Vincent Madriaga</p>
                        <p className="text-[9px] text-slate-600">Coordinator, MAS</p>
                      </div>
                    </div>
                  </div>

                  {/* Standard PDF Footer */}
                  <div className="font-serif pt-2 border-t border-slate-900 flex items-center justify-between text-[9px] text-slate-900">
                    <span>MAS-KoA-SHJP.mbs</span>
                    <span>[1]</span>
                    <span className="font-mono">FRQ-091026</span>
                  </div>

                </div>
              </div>
            </div>
          </section>

          {/* Phase 1 Completion Banner */}
          <div className="p-4 sm:p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 text-center">
            <h3 className="text-sm sm:text-base font-black">PHASE 1 DESIGN PREVIEW COMPLETE — WAITING FOR APPROVAL</h3>
            <p className="text-xs text-emerald-800 mt-1 max-w-xl mx-auto">
              All 21 standardized components are active, authentic to MATS features, and aligned with Finance & Reports design standards.
            </p>
          </div>

          {/* Toast Container Stack */}
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm">
            {toasts.map(toast => (
              <div
                key={toast.id}
                className="p-3.5 sm:p-4 rounded-2xl border shadow-xl bg-white pointer-events-auto flex items-start space-x-3 transition-all animate-in slide-in-from-bottom-3 border-slate-200"
              >
                {toast.type === 'success' && <Icons.CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                {toast.type === 'info' && <Icons.Wallet className="w-5 h-5 text-blue-600 shrink-0" />}
                {toast.type === 'warning' && <Icons.AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />}
                {toast.type === 'error' && <Icons.AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-slate-900">{toast.title}</h4>
                  <p className="text-xs text-slate-600 mt-0.5">{toast.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded-lg shrink-0"
                >
                  <Icons.Close className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  )
}

