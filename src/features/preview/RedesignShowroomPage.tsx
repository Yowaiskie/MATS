import { useState } from 'react'
import { PreviewNavigation } from './PreviewNavigation'
import { PublicPortalActionBar } from '@/components/PublicPortalActionBar'
import { Modal } from '@/components/Modal'
import { CustomSelect } from '@/components/CustomSelect'
import { DatePicker } from '@/components/DatePicker'
import { TimePicker } from '@/components/TimePicker'
import { useToast } from '@/context/ToastContext'

export function RedesignShowroomPage() {
  const { toast } = useToast()

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1)
  const [modalFeedback, setModalFeedback] = useState<string | null>(null)

  // Empty-by-default form state for the modal
  const [titleInput, setTitleInput] = useState('')
  const [categoryInput, setCategoryInput] = useState('')
  const [dateInput, setDateInput] = useState('')
  const [timeInput, setTimeInput] = useState('')

  // Demo Publication State
  const [pubStatus, setPubStatus] = useState<'published' | 'closed'>('published')
  const [pubResponses, setPubResponses] = useState(24)

  // Demo Event Form State
  const [formStatus, setFormStatus] = useState<'published' | 'closed'>('published')
  const [formResponses, setFormResponses] = useState(15)

  const handleResetModal = () => {
    setTitleInput('')
    setCategoryInput('')
    setDateInput('')
    setTimeInput('')
    setActiveStep(1)
    setModalFeedback(null)
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      {/* Top Banner / Navigation */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <PreviewNavigation />

        {/* Showroom Header */}
        <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white rounded-3xl p-6 md:p-8 shadow-xl mb-8 border border-indigo-800/40 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              MATS Design Showroom & Component Lab
            </div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
              Standardized Button Systems, Action Bars, and Modals
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed">
              Explore the updated component patterns for MATS. Built for consistency across every module with unified actions, custom-styled selectors, and blank-by-default form controls.
            </p>
          </div>
        </div>

        <div className="space-y-10">
          {/* SECTION 1: Unified Action Bar Demonstration */}
          <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                  1. Unified Action Bar System
                </span>
                <h2 className="text-xl font-black text-slate-800 mt-2">
                  Action Parity: Publications vs Event Forms
                </h2>
                <p className="text-xs md:text-sm text-slate-500 mt-1">
                  Standardized order and visual behavior across modules: <strong>[Preview]</strong>, <strong>[Copy Link]</strong>, and <strong>[Submissions]</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Interactive Demo Cards</span>
              </div>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Publication Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    A. Regular Mass Publication (Schedules Module)
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                    Unified Layout
                  </span>
                </div>
                <PublicPortalActionBar
                  title="November 2026 Regular Mass Schedule"
                  type="publication"
                  publicUrl="https://mats-dev-10b59.web.app/public/schedules?pub=nov-2026"
                  status={pubStatus}
                  responsesCount={pubResponses}
                  responsesLabel="Submissions"
                  deadlineText="Deadline: Nov 15, 2026 (11:59 PM)"
                  onPreview={() => toast.info('Preview Opened', 'Opened public schedule portal in a new browser tab.')}
                  onCopyLink={() => toast.success('Link Copied', 'Publication URL copied to your clipboard.')}
                  onViewResponses={() => {
                    setPubResponses(prev => prev + 1)
                    toast.info('Submissions Panel', 'Displaying 24 altar server submissions.')
                  }}
                  onEdit={() => toast.info('Edit Modal', 'Opened publication settings modal.')}
                  onToggleStatus={(next) => {
                    setPubStatus(next === 'published' ? 'published' : 'closed')
                    toast.info('Status Updated', `Status changed to: ${next === 'published' ? 'Open' : 'Closed'}`)
                  }}
                />
              </div>

              {/* Event Form Card (NOW WITH PREVIEW BUTTON!) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700">
                    B. Parish Fiesta Duty Form (Events Module)
                  </span>
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    + Preview Button Included
                  </span>
                </div>
                <PublicPortalActionBar
                  title="Parish Fiesta 2026: Altar Server Duty Form"
                  type="eventForm"
                  publicUrl="https://mats-dev-10b59.web.app/events/forms/fiesta-2026"
                  status={formStatus}
                  responsesCount={formResponses}
                  responsesLabel="Responses"
                  deadlineText="Deadline: Nov 20, 2026 (5:00 PM)"
                  onPreview={() => toast.info('Preview Opened', 'Opened event registration form in a new browser tab.')}
                  onCopyLink={() => toast.success('Link Copied', 'Event form public URL copied to your clipboard.')}
                  onViewResponses={() => {
                    setFormResponses(prev => prev + 1)
                    toast.info('Responses Panel', 'Displaying 15 submitted registrations.')
                  }}
                  onEdit={() => toast.info('Form Builder', 'Opened event form builder and questions editor.')}
                  onToggleStatus={(next) => {
                    setFormStatus(next === 'published' ? 'published' : 'closed')
                    toast.info('Status Updated', `Form status changed to: ${next === 'published' ? 'Open' : 'Closed'}`)
                  }}
                />
              </div>
            </div>

            {/* Key Improvements Bullet Points */}
            <div className="mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-200/60 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Preview Button Parity</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Coordinators can preview public forms directly in a new tab before sharing with servers and parents.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Explicit Text Labels</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Every button pairs an icon with an explicit label to remove ambiguity.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                  ✓
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Instant Visual Confirmation</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    The copy button updates immediately to &quot;Copied!&quot; with a green checkmark for clear feedback.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: Interactive Modal Redesign Showcase */}
          <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  2. Redesigned Step-by-Step Modal
                </span>
                <h2 className="text-xl font-black text-slate-800 mt-2">
                  Modal Pattern: Custom Select, Custom Date & Time Pickers
                </h2>
                <p className="text-xs md:text-sm text-slate-500 mt-1">
                  Replaced browser-native dropdowns and datetime controls with sleek custom Tailwind pickers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleResetModal()
                  setIsModalOpen(true)
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs md:text-sm shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <span>Open Sample Modal</span>
              </button>
            </div>

            {/* 3-Step Guided Workflow Structure */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-6">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-4">
                Structured 3-Step Coordinator Workflow:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Step 1 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-2xs relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Create</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Enter the publication or form title and choose a category from the custom dropdown menu.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-2xs relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Share & Preview</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Select a deadline with dedicated custom date and time pickers, and preview the mobile link.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-2xs relative">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Roster & Sync</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Review submitted responses, approve assignments, and automatically synchronize rosters with attendance.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: Standard Button Hierarchy Showcase */}
          <section className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-xs">
            <span className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg">
              3. Button Design System & Color Roles
            </span>
            <h2 className="text-xl font-black text-slate-800 mt-2 mb-1">
              Color Hierarchy and Action Semantics
            </h2>
            <p className="text-xs md:text-sm text-slate-500 mb-6">
              Standardized colors to ensure clear user intent and reduce operational errors.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Primary Action */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Primary Action</span>
                  <h4 className="text-xs font-bold text-slate-800 mt-0.5">Primary Confirmation</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Used for core operations such as creating or saving changes.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.success('Saved', 'Triggered primary save action.')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Changes</span>
                </button>
              </div>

              {/* Secondary Action */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Secondary Action</span>
                  <h4 className="text-xs font-bold text-slate-800 mt-0.5">Secondary Utility</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Used for previews, exports, and auxiliary actions.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.info('Preview Ready', 'Triggered secondary preview utility.')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200 transition-all active:scale-95 cursor-pointer shadow-2xs"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Preview / Download</span>
                </button>
              </div>

              {/* Success / Approved Action */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Success Action</span>
                  <h4 className="text-xs font-bold text-slate-800 mt-0.5">Approval / Verification</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Used to approve submissions, finalize attendance, or grant excuses.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.success('Approved', 'Submission marked as verified.')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-xs"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Approve</span>
                </button>
              </div>

              {/* Danger / Critical Action */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/60 flex flex-col justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Danger Action</span>
                  <h4 className="text-xs font-bold text-slate-800 mt-0.5">Destructive Operations</h4>
                  <p className="text-[11px] text-slate-500 mt-1">Requires explicit user confirmation before execution.</p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.warning('Action Blocked', 'Triggered safety confirmation modal before deletion.')}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 transition-all active:scale-95 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* SAMPLE INTERACTIVE REDESIGNED MODAL (CUSTOM TAILWIND PICKERS & EMPTY DEFAULTS) */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setModalFeedback(null)
        }}
        title="Create Publication or Event Form"
        subtitle="Step-by-step form with custom dropdowns, custom calendar, and clean empty placeholders."
        maxWidth="2xl"
        badge="New Pattern"
        footer={
          <div className="flex items-center justify-between w-full">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                setModalFeedback(null)
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <div className="flex items-center gap-2">
              {activeStep > 1 && (
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev - 1) as any)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Back
                </button>
              )}

              {activeStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setActiveStep((prev) => (prev + 1) as any)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setModalFeedback('Configuration saved successfully!')
                    setTimeout(() => {
                      setIsModalOpen(false)
                      setModalFeedback(null)
                      toast.success('Form Published', 'Successfully saved to Mats-Dev database!')
                    }, 800)
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
                >
                  ✓ Save & Publish
                </button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Step Progress Bar */}
          <div className="flex items-center justify-between px-2 pt-1 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${activeStep === 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                1
              </span>
              <span className={`text-xs font-bold ${activeStep === 1 ? 'text-indigo-600' : 'text-slate-500'}`}>
                Basic Details
              </span>
            </div>

            <span className="text-slate-300">→</span>

            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${activeStep === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                2
              </span>
              <span className={`text-xs font-bold ${activeStep === 2 ? 'text-indigo-600' : 'text-slate-500'}`}>
                Deadline & Schedule
              </span>
            </div>

            <span className="text-slate-300">→</span>

            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center ${activeStep === 3 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                3
              </span>
              <span className={`text-xs font-bold ${activeStep === 3 ? 'text-indigo-600' : 'text-slate-500'}`}>
                Review & Confirm
              </span>
            </div>
          </div>

          {modalFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              {modalFeedback}
            </div>
          )}

          {/* Step 1 Content (CUSTOM SELECT & CLEAN INPUT) */}
          {activeStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Title / Name
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white placeholder:text-slate-400"
                  placeholder="e.g. December 2026 Regular Mass Schedule"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  The primary heading shown to members on their mobile devices.
                </p>
              </div>

              <div>
                <CustomSelect
                  id="modal-category-select"
                  label="Category"
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  placeholder="Select a category..."
                  options={[
                    { value: 'regular', label: 'Regular Mass', description: 'Monthly Sunday & weekday schedules' },
                    { value: 'special', label: 'Special Event', description: 'Fiesta, sacramental, or retreats' },
                    { value: 'seasonal', label: 'Seasonal Liturgy', description: 'Holy Week, Simbang Gabi, or Triduum' },
                  ]}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Choose the category that applies to this schedule or event.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 Content (CUSTOM DATEPICKER & TIMEPICKER) */}
          {activeStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deadline Date
                  </label>
                  <DatePicker
                    value={dateInput}
                    onChange={(d) => setDateInput(d)}
                    placeholder="Select date..."
                    clearable
                    portal
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Date when submissions will close.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Deadline Time
                  </label>
                  <TimePicker
                    id="modal-deadline-time"
                    label="Deadline Time"
                    value={timeInput}
                    onChange={(t) => setTimeInput(t)}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Exact cutoff time for submissions.
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200/80">
                <h5 className="text-xs font-bold text-blue-800">Coordinator Notice:</h5>
                <p className="text-[11px] text-blue-700 mt-0.5">
                  Leaving the date and time empty keeps the public link open indefinitely until manually toggled.
                </p>
              </div>
            </div>
          )}

          {/* Step 3 Content */}
          {activeStep === 3 && (
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/60 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Title:</span>
                  <span className="font-bold text-slate-800">
                    {titleInput.trim() ? titleInput : <span className="text-amber-600 italic">Not specified</span>}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Category:</span>
                  <span className="font-bold text-indigo-600">
                    {categoryInput ? categoryInput.toUpperCase() : <span className="text-amber-600 italic">None selected</span>}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Deadline:</span>
                  <span className="font-bold text-slate-800">
                    {dateInput ? `${dateInput} ${timeInput ? `@ ${timeInput}` : ''}` : <span className="text-slate-400">No deadline set</span>}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 text-center">
                Click <strong>&quot;✓ Save & Publish&quot;</strong> below to complete this setup.
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
