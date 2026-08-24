import React, { useState, useEffect } from 'react'
import { userService } from '@/services/userService'
import { settingsService } from '@/services/settingsService'
import { memberService } from '@/services/memberService'
import { useAuth } from '@/features/authentication/AuthContext'
import type { UserProfile, UserRole, ModuleKey, UserPermissions, PermissionPreset } from '@/types/auth'
import type { OrderGroup, Member } from '@/types/member'
import { ORDER_GROUPS } from '@/types/member'
import { Card } from '@/components/Card'
import { ConfirmModal, AlertModal } from '@/components/Dialog'
import { Pagination } from '@/components/Pagination'
import { Loading } from '@/components/Loading'

const ALL_MODULES: { key: ModuleKey; label: string; description: string }[] = [
  { key: 'dashboard', label: 'Dashboard Overview', description: 'Access main metrics and overview dashboard' },
  { key: 'schedules', label: 'Schedules', description: 'View or manage ministry schedules and assignments' },
  { key: 'attendance', label: 'Attendance', description: 'Record and track server attendance' },
  { key: 'reports', label: 'Reports & Analytics', description: 'View member metrics and export PDF reports' },
  { key: 'members', label: 'Member Directory', description: 'Manage altar server profiles and records' },
  { key: 'finance', label: 'Finance Management', description: 'Record income/expense, request funds and generate reports' },
  { key: 'events', label: 'Events & Projects', description: 'Manage parish events, tasks, and event finances' },
  { key: 'inventory', label: 'Ministry Inventory', description: 'Track sports gear, games, robes, and equipment' },
  { key: 'users', label: 'User Management', description: 'Manage system accounts and access permissions' },
  { key: 'settings', label: 'Settings', description: 'Configure system policies and templates' },
  { key: 'audit', label: 'Audit Trail', description: 'View system security and activity logs' },
]

const PRESET_ICONS: { [key: string]: React.ReactNode } = {
  clipboard: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  users: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  shield: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  calendar: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  chart: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  settings: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    </svg>
  ),
  bank: (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  )
}

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  schedules: 'Schedules',
  attendance: 'Attendance',
  reports: 'Reports',
  members: 'Members',
  finance: 'Finance',
  events: 'Events',
  inventory: 'Inventory',
  users: 'Users',
  settings: 'Settings',
  audit: 'Audit Trail',
}

export const UsersPage: React.FC = () => {
  const { profile: currentAdmin, isAdmin } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [presets, setPresets] = useState<PermissionPreset[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Presets Management Modal State
  const [isPresetsModalOpen, setIsPresetsModalOpen] = useState(false)
  const [presetSuccessMsg, setPresetSuccessMsg] = useState<string | null>(null)
  const [presetEditing, setPresetEditing] = useState<PermissionPreset | null>(null)
  const [presetFormName, setPresetFormName] = useState('')
  const [presetFormDesc, setPresetFormDesc] = useState('')
  const [presetFormIcon, setPresetFormIcon] = useState<'clipboard' | 'users' | 'shield' | 'calendar' | 'chart' | 'settings' | 'bank'>('clipboard')
  const [presetFormRole, setPresetFormRole] = useState<UserRole>('user')
  const [presetFormModules, setPresetFormModules] = useState<ModuleKey[]>(['dashboard', 'attendance'])
  const [presetFormTakeAttendance, setPresetFormTakeAttendance] = useState(true)
  const [presetFormFinalizeAttendance, setPresetFormFinalizeAttendance] = useState(false)
  const [presetFormViewSchedules, setPresetFormViewSchedules] = useState(true)
  const [presetFormManageSchedules, setPresetFormManageSchedules] = useState(false)
  const [presetFormViewReports, setPresetFormViewReports] = useState(false)
  const [presetFormExportReports, setPresetFormExportReports] = useState(false)

  // Events Preset state
  const [presetFormViewProjects, setPresetFormViewProjects] = useState(false)
  const [presetFormCreateProjects, setPresetFormCreateProjects] = useState(false)
  const [presetFormEditProjects, setPresetFormEditProjects] = useState(false)
  const [presetFormDeleteProjects, setPresetFormDeleteProjects] = useState(false)
  const [presetFormDeleteEvents, setPresetFormDeleteEvents] = useState(false)
  const [presetFormAssignTasks, setPresetFormAssignTasks] = useState(false)
  const [presetFormManageAssignments, setPresetFormManageAssignments] = useState(false)
  const [presetFormUpdateOwnTasks, setPresetFormUpdateOwnTasks] = useState(false)
  const [presetFormUpdateAnyTask, setPresetFormUpdateAnyTask] = useState(false)
  const [presetFormDeleteTasks, setPresetFormDeleteTasks] = useState(false)
  const [presetFormCommentProjects, setPresetFormCommentProjects] = useState(false)
  const [presetFormUploadProjectFiles, setPresetFormUploadProjectFiles] = useState(false)
  const [presetFormViewProjectReports, setPresetFormViewProjectReports] = useState(false)
  const [presetFormArchiveProjects, setPresetFormArchiveProjects] = useState(false)

  // Event Finance Preset state
  const [presetFormViewEventFinance, setPresetFormViewEventFinance] = useState(false)
  const [presetFormAddEventIncome, setPresetFormAddEventIncome] = useState(false)
  const [presetFormAddEventExpense, setPresetFormAddEventExpense] = useState(false)
  const [presetFormEditEventFinance, setPresetFormEditEventFinance] = useState(false)
  const [presetFormVoidEventFinance, setPresetFormVoidEventFinance] = useState(false)
  const [presetFormTransferEventFunds, setPresetFormTransferEventFunds] = useState(false)
  const [presetFormManageEventFinanceCategories, setPresetFormManageEventFinanceCategories] = useState(false)

  // Event Forms Preset state
  const [presetFormViewEventForms, setPresetFormViewEventForms] = useState(false)
  const [presetFormCreateEventForms, setPresetFormCreateEventForms] = useState(false)
  const [presetFormEditEventForms, setPresetFormEditEventForms] = useState(false)
  const [presetFormPublishEventForms, setPresetFormPublishEventForms] = useState(false)
  const [presetFormViewEventFormResponses, setPresetFormViewEventFormResponses] = useState(false)
  const [presetFormExportEventFormResponses, setPresetFormExportEventFormResponses] = useState(false)
  const [presetFormArchiveEventForms, setPresetFormArchiveEventForms] = useState(false)

  // Event Contributions Preset state
  const [presetFormViewEventContributions, setPresetFormViewEventContributions] = useState(false)
  const [presetFormAddEventContributions, setPresetFormAddEventContributions] = useState(false)
  const [presetFormEditEventContributions, setPresetFormEditEventContributions] = useState(false)
  const [presetFormVoidEventContributions, setPresetFormVoidEventContributions] = useState(false)
  const [presetFormManageEventContributionPurposes, setPresetFormManageEventContributionPurposes] = useState(false)
  const [presetFormExportEventContributions, setPresetFormExportEventContributions] = useState(false)

  // Register / Edit User Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [activePresetId, setActivePresetId] = useState<string | null>(null)
  
  // Permissions state
  const [allowedModules, setAllowedModules] = useState<ModuleKey[]>(['dashboard', 'attendance'])
  const [canTakeAttendance, setCanTakeAttendance] = useState(true)
  const [canFinalizeAttendance, setCanFinalizeAttendance] = useState(false)
  const [canViewSchedules, setCanViewSchedules] = useState(true)
  const [canManageSchedules, setCanManageSchedules] = useState(false)
  const [canViewReports, setCanViewReports] = useState(false)
  const [canExportReports, setCanExportReports] = useState(false)
  const [assignedOrder, setAssignedOrder] = useState<OrderGroup | ''>('')

  // Finance permissions state
  const [canViewFinanceDashboard, setCanViewFinanceDashboard] = useState(false)
  const [canAddIncome, setCanAddIncome] = useState(false)
  const [canEditIncome, setCanEditIncome] = useState(false)
  const [canDeleteIncome, setCanDeleteIncome] = useState(false)
  const [canCreateFundRequest, setCanCreateFundRequest] = useState(false)
  const [canApproveFundRequest, setCanApproveFundRequest] = useState(false)
  const [canRejectFundRequest, setCanRejectFundRequest] = useState(false)
  const [canReleaseFunds, setCanReleaseFunds] = useState(false)
  const [canSubmitLiquidation, setCanSubmitLiquidation] = useState(false)
  const [canReviewLiquidation, setCanReviewLiquidation] = useState(false)
  const [canViewFinanceReports, setCanViewFinanceReports] = useState(false)
  const [canExportFinanceReports, setCanExportFinanceReports] = useState(false)
  const [canManageFinanceCategories, setCanManageFinanceCategories] = useState(false)
  const [canCloseFinancePeriod, setCanCloseFinancePeriod] = useState(false)
  const [canReopenFinancePeriod, setCanReopenFinancePeriod] = useState(false)

  // Events permissions state
  const [canViewProjects, setCanViewProjects] = useState(false)
  const [canCreateProjects, setCanCreateProjects] = useState(false)
  const [canEditProjects, setCanEditProjects] = useState(false)
  const [canDeleteProjects, setCanDeleteProjects] = useState(false)
  const [canDeleteEvents, setCanDeleteEvents] = useState(false)
  const [canAssignTasks, setCanAssignTasks] = useState(false)
  const [canManageAssignments, setCanManageAssignments] = useState(false)
  const [canUpdateOwnTasks, setCanUpdateOwnTasks] = useState(false)
  const [canUpdateAnyTask, setCanUpdateAnyTask] = useState(false)
  const [canDeleteTasks, setCanDeleteTasks] = useState(false)
  const [canCommentProjects, setCanCommentProjects] = useState(false)
  const [canUploadProjectFiles, setCanUploadProjectFiles] = useState(false)
  const [canViewProjectReports, setCanViewProjectReports] = useState(false)
  const [canArchiveProjects, setCanArchiveProjects] = useState(false)

  // Event Finance permissions state
  const [canViewEventFinance, setCanViewEventFinance] = useState(false)
  const [canAddEventIncome, setCanAddEventIncome] = useState(false)
  const [canAddEventExpense, setCanAddEventExpense] = useState(false)
  const [canEditEventFinance, setCanEditEventFinance] = useState(false)
  const [canVoidEventFinance, setCanVoidEventFinance] = useState(false)
  const [canTransferEventFunds, setCanTransferEventFunds] = useState(false)
  const [canManageEventFinanceCategories, setCanManageEventFinanceCategories] = useState(false)

  // Event Forms permissions state
  const [canViewEventForms, setCanViewEventForms] = useState(false)
  const [canCreateEventForms, setCanCreateEventForms] = useState(false)
  const [canEditEventForms, setCanEditEventForms] = useState(false)
  const [canPublishEventForms, setCanPublishEventForms] = useState(false)
  const [canViewEventFormResponses, setCanViewEventFormResponses] = useState(false)
  const [canExportEventFormResponses, setCanExportEventFormResponses] = useState(false)
  const [canArchiveEventForms, setCanArchiveEventForms] = useState(false)

  // Event Contributions permissions state
  const [canViewEventContributions, setCanViewEventContributions] = useState(false)
  const [canAddEventContributions, setCanAddEventContributions] = useState(false)
  const [canEditEventContributions, setCanEditEventContributions] = useState(false)
  const [canVoidEventContributions, setCanVoidEventContributions] = useState(false)
  const [canManageEventContributionPurposes, setCanManageEventContributionPurposes] = useState(false)
  const [canExportEventContributions, setCanExportEventContributions] = useState(false)

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null)

  const loadData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError(null)
    try {
      const [usersData, presetsData, membersData] = await Promise.all([
        userService.getUsers(),
        settingsService.getPermissionPresets(),
        memberService.getMembers()
      ])
      setUsers(usersData)
      setPresets(presetsData)
      setMembers(membersData)
    } catch (err: any) {
      console.error(err)
      setError('Failed to load user accounts list and permission presets.')
    } finally {
      if (showSpinner) setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const [activePresetName, setActivePresetName] = useState<string>('')

  // Preset role applier
  const applyPreset = (p: PermissionPreset) => {
    setActivePresetId(p.id)
    setActivePresetName(p.name)
    setRole(p.role)
    setAllowedModules(p.allowedModules)
    setCanTakeAttendance(p.canTakeAttendance)
    setCanFinalizeAttendance(p.canFinalizeAttendance)
    setCanViewSchedules(p.canViewSchedules)
    setCanManageSchedules(p.canManageSchedules)
    setCanViewReports(p.canViewReports)
    setCanExportReports(p.canExportReports)
    setCanViewFinanceDashboard(p.canViewFinanceDashboard ?? false)
    setCanAddIncome(p.canAddIncome ?? false)
    setCanEditIncome(p.canEditIncome ?? false)
    setCanDeleteIncome(p.canDeleteIncome ?? false)
    setCanCreateFundRequest(p.canCreateFundRequest ?? false)
    setCanApproveFundRequest(p.canApproveFundRequest ?? false)
    setCanRejectFundRequest(p.canRejectFundRequest ?? false)
    setCanReleaseFunds(p.canReleaseFunds ?? false)
    setCanSubmitLiquidation(p.canSubmitLiquidation ?? false)
    setCanReviewLiquidation(p.canReviewLiquidation ?? false)
    setCanViewFinanceReports(p.canViewFinanceReports ?? false)
    setCanExportFinanceReports(p.canExportFinanceReports ?? false)
    setCanManageFinanceCategories(p.canManageFinanceCategories ?? false)
    setCanCloseFinancePeriod(p.canCloseFinancePeriod ?? false)
    setCanReopenFinancePeriod(p.canReopenFinancePeriod ?? false)

    setCanViewProjects(p.canViewProjects ?? false)
    setCanCreateProjects(p.canCreateProjects ?? false)
    setCanEditProjects(p.canEditProjects ?? false)
    setCanDeleteProjects(p.canDeleteProjects ?? false)
    setCanDeleteEvents(p.canDeleteEvents ?? false)
    setCanAssignTasks(p.canAssignTasks ?? false)
    setCanManageAssignments(p.canManageAssignments ?? false)
    setCanUpdateOwnTasks(p.canUpdateOwnTasks ?? false)
    setCanUpdateAnyTask(p.canUpdateAnyTask ?? false)
    setCanDeleteTasks(p.canDeleteTasks ?? false)
    setCanCommentProjects(p.canCommentProjects ?? false)
    setCanUploadProjectFiles(p.canUploadProjectFiles ?? false)
    setCanViewProjectReports(p.canViewProjectReports ?? false)
    setCanArchiveProjects(p.canArchiveProjects ?? false)

    setCanViewEventFinance(p.canViewEventFinance ?? false)
    setCanAddEventIncome(p.canAddEventIncome ?? false)
    setCanAddEventExpense(p.canAddEventExpense ?? false)
    setCanEditEventFinance(p.canEditEventFinance ?? false)
    setCanVoidEventFinance(p.canVoidEventFinance ?? false)
    setCanTransferEventFunds(p.canTransferEventFunds ?? false)
    setCanManageEventFinanceCategories(p.canManageEventFinanceCategories ?? false)

    setCanViewEventForms(p.canViewEventForms ?? false)
    setCanCreateEventForms(p.canCreateEventForms ?? false)
    setCanEditEventForms(p.canEditEventForms ?? false)
    setCanPublishEventForms(p.canPublishEventForms ?? false)
    setCanViewEventFormResponses(p.canViewEventFormResponses ?? false)
    setCanExportEventFormResponses(p.canExportEventFormResponses ?? false)
    setCanArchiveEventForms(p.canArchiveEventForms ?? false)

    setCanViewEventContributions(p.canViewEventContributions ?? false)
    setCanAddEventContributions(p.canAddEventContributions ?? false)
    setCanEditEventContributions(p.canEditEventContributions ?? false)
    setCanVoidEventContributions(p.canVoidEventContributions ?? false)
    setCanManageEventContributionPurposes(p.canManageEventContributionPurposes ?? false)
    setCanExportEventContributions(p.canExportEventContributions ?? false)

    if (p.assignedOrder) {
      setAssignedOrder(p.assignedOrder)
    } else {
      setAssignedOrder('')
    }
  }

  const handleOpenAddPreset = () => {
    setPresetEditing(null)
    setPresetFormName('')
    setPresetFormDesc('')
    setPresetFormIcon('clipboard')
    setPresetFormRole('user')
    setPresetFormModules(['dashboard', 'attendance'])
    setPresetFormTakeAttendance(true)
    setPresetFormFinalizeAttendance(false)
    setPresetFormViewSchedules(true)
    setPresetFormManageSchedules(false)
    setPresetFormViewReports(false)
    setPresetFormExportReports(false)

    setPresetFormViewProjects(false)
    setPresetFormCreateProjects(false)
    setPresetFormEditProjects(false)
    setPresetFormDeleteProjects(false)
    setPresetFormDeleteEvents(false)
    setPresetFormAssignTasks(false)
    setPresetFormManageAssignments(false)
    setPresetFormUpdateOwnTasks(false)
    setPresetFormUpdateAnyTask(false)
    setPresetFormDeleteTasks(false)
    setPresetFormCommentProjects(false)
    setPresetFormUploadProjectFiles(false)
    setPresetFormViewProjectReports(false)
    setPresetFormArchiveProjects(false)

    setPresetFormViewEventFinance(false)
    setPresetFormAddEventIncome(false)
    setPresetFormAddEventExpense(false)
    setPresetFormEditEventFinance(false)
    setPresetFormVoidEventFinance(false)
    setPresetFormTransferEventFunds(false)
    setPresetFormManageEventFinanceCategories(false)

    setPresetFormViewEventForms(false)
    setPresetFormCreateEventForms(false)
    setPresetFormEditEventForms(false)
    setPresetFormPublishEventForms(false)
    setPresetFormViewEventFormResponses(false)
    setPresetFormExportEventFormResponses(false)
    setPresetFormArchiveEventForms(false)

    setPresetFormViewEventContributions(false)
    setPresetFormAddEventContributions(false)
    setPresetFormEditEventContributions(false)
    setPresetFormVoidEventContributions(false)
    setPresetFormManageEventContributionPurposes(false)
    setPresetFormExportEventContributions(false)
  }

  const handleOpenEditPreset = (p: PermissionPreset) => {
    setPresetEditing(p)
    setPresetFormName(p.name)
    setPresetFormDesc(p.description)
    setPresetFormIcon(p.icon)
    setPresetFormRole(p.role)
    setPresetFormModules(p.allowedModules)
    setPresetFormTakeAttendance(p.canTakeAttendance)
    setPresetFormFinalizeAttendance(p.canFinalizeAttendance)
    setPresetFormViewSchedules(p.canViewSchedules)
    setPresetFormManageSchedules(p.canManageSchedules)
    setPresetFormViewReports(p.canViewReports)
    setPresetFormExportReports(p.canExportReports)

    setPresetFormViewProjects(p.canViewProjects ?? false)
    setPresetFormCreateProjects(p.canCreateProjects ?? false)
    setPresetFormEditProjects(p.canEditProjects ?? false)
    setPresetFormDeleteProjects(p.canDeleteProjects ?? false)
    setPresetFormDeleteEvents(p.canDeleteEvents ?? false)
    setPresetFormAssignTasks(p.canAssignTasks ?? false)
    setPresetFormManageAssignments(p.canManageAssignments ?? false)
    setPresetFormUpdateOwnTasks(p.canUpdateOwnTasks ?? false)
    setPresetFormUpdateAnyTask(p.canUpdateAnyTask ?? false)
    setPresetFormDeleteTasks(p.canDeleteTasks ?? false)
    setPresetFormCommentProjects(p.canCommentProjects ?? false)
    setPresetFormUploadProjectFiles(p.canUploadProjectFiles ?? false)
    setPresetFormViewProjectReports(p.canViewProjectReports ?? false)
    setPresetFormArchiveProjects(p.canArchiveProjects ?? false)

    setPresetFormViewEventFinance(p.canViewEventFinance ?? false)
    setPresetFormAddEventIncome(p.canAddEventIncome ?? false)
    setPresetFormAddEventExpense(p.canAddEventExpense ?? false)
    setPresetFormEditEventFinance(p.canEditEventFinance ?? false)
    setPresetFormVoidEventFinance(p.canVoidEventFinance ?? false)
    setPresetFormTransferEventFunds(p.canTransferEventFunds ?? false)
    setPresetFormManageEventFinanceCategories(p.canManageEventFinanceCategories ?? false)

    setPresetFormViewEventForms(p.canViewEventForms ?? false)
    setPresetFormCreateEventForms(p.canCreateEventForms ?? false)
    setPresetFormEditEventForms(p.canEditEventForms ?? false)
    setPresetFormPublishEventForms(p.canPublishEventForms ?? false)
    setPresetFormViewEventFormResponses(p.canViewEventFormResponses ?? false)
    setPresetFormExportEventFormResponses(p.canExportEventFormResponses ?? false)
    setPresetFormArchiveEventForms(p.canArchiveEventForms ?? false)

    setPresetFormViewEventContributions(p.canViewEventContributions ?? false)
    setPresetFormAddEventContributions(p.canAddEventContributions ?? false)
    setPresetFormEditEventContributions(p.canEditEventContributions ?? false)
    setPresetFormVoidEventContributions(p.canVoidEventContributions ?? false)
    setPresetFormManageEventContributionPurposes(p.canManageEventContributionPurposes ?? false)
    setPresetFormExportEventContributions(p.canExportEventContributions ?? false)
  }

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!presetFormName.trim()) {
      setError('Preset name is required.')
      return
    }

    setSaving(true)
    try {
      const newPreset: PermissionPreset = {
        id: presetEditing ? presetEditing.id : `preset_${Date.now()}`,
        name: presetFormName.trim(),
        description: presetFormDesc.trim(),
        icon: presetFormIcon,
        role: presetFormRole,
        allowedModules: presetFormModules,
        canTakeAttendance: presetFormTakeAttendance,
        canFinalizeAttendance: presetFormFinalizeAttendance,
        canViewSchedules: presetFormViewSchedules,
        canManageSchedules: presetFormManageSchedules,
        canViewReports: presetFormViewReports,
        canExportReports: presetFormExportReports,

        canViewProjects: presetFormViewProjects,
        canCreateProjects: presetFormCreateProjects,
        canEditProjects: presetFormEditProjects,
        canDeleteProjects: presetFormDeleteProjects,
        canDeleteEvents: presetFormDeleteEvents,
        canAssignTasks: presetFormAssignTasks,
        canManageAssignments: presetFormManageAssignments,
        canUpdateOwnTasks: presetFormUpdateOwnTasks,
        canUpdateAnyTask: presetFormUpdateAnyTask,
        canDeleteTasks: presetFormDeleteTasks,
        canCommentProjects: presetFormCommentProjects,
        canUploadProjectFiles: presetFormUploadProjectFiles,
        canViewProjectReports: presetFormViewProjectReports,
        canArchiveProjects: presetFormArchiveProjects,

        canViewEventFinance: presetFormViewEventFinance,
        canAddEventIncome: presetFormAddEventIncome,
        canAddEventExpense: presetFormAddEventExpense,
        canEditEventFinance: presetFormEditEventFinance,
        canVoidEventFinance: presetFormVoidEventFinance,
        canTransferEventFunds: presetFormTransferEventFunds,
        canManageEventFinanceCategories: presetFormManageEventFinanceCategories,

        canViewEventForms: presetFormViewEventForms,
        canCreateEventForms: presetFormCreateEventForms,
        canEditEventForms: presetFormEditEventForms,
        canPublishEventForms: presetFormPublishEventForms,
        canViewEventFormResponses: presetFormViewEventFormResponses,
        canExportEventFormResponses: presetFormExportEventFormResponses,
        canArchiveEventForms: presetFormArchiveEventForms,

        canViewEventContributions: presetFormViewEventContributions,
        canAddEventContributions: presetFormAddEventContributions,
        canEditEventContributions: presetFormEditEventContributions,
        canVoidEventContributions: presetFormVoidEventContributions,
        canManageEventContributionPurposes: presetFormManageEventContributionPurposes,
        canExportEventContributions: presetFormExportEventContributions
      }

      let updatedPresets: PermissionPreset[] = []
      if (presetEditing) {
        updatedPresets = presets.map(p => p.id === presetEditing.id ? newPreset : p)
      } else {
        updatedPresets = [...presets, newPreset]
      }

      await settingsService.savePermissionPresets(updatedPresets, currentAdmin?.email || 'Admin')
      setPresets(updatedPresets)
      setPresetSuccessMsg(`Preset '${newPreset.name}' successfully saved!`)
      handleOpenAddPreset()
    } catch (err: any) {
      console.error(err)
      setError('Failed to save permission preset.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePreset = async (presetId: string) => {
    const p = presets.find(x => x.id === presetId)
    if (!p) return
    setSaving(true)
    try {
      const updated = presets.filter(x => x.id !== presetId)
      await settingsService.savePermissionPresets(updated, currentAdmin?.email || 'Admin')
      setPresets(updated)
      setPresetSuccessMsg(`Preset '${p.name}' was removed.`)
    } catch (err: any) {
      console.error(err)
      setError('Failed to delete permission preset.')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenAddModal = () => {
    setEditingUser(null)
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setDisplayName('')
    if (presets.length > 0) {
      applyPreset(presets[0])
    }
    setError(null)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (userToEdit: UserProfile) => {
    setEditingUser(userToEdit)
    setEmail(userToEdit.email)
    setPassword('')
    setConfirmPassword('')
    setDisplayName(userToEdit.displayName || '')
    setRole(userToEdit.role || 'user')
    setAssignedOrder(userToEdit.assignedOrder || '')

    const perms = userToEdit.permissions
    if (userToEdit.role === 'admin') {
      const adminPreset = presets.find(p => p.role === 'admin')
      if (adminPreset) applyPreset(adminPreset)
    } else if (perms) {
      setAllowedModules(perms.allowedModules || ['dashboard', 'attendance'])
      setCanTakeAttendance(perms.canTakeAttendance ?? true)
      setCanFinalizeAttendance(perms.canFinalizeAttendance ?? false)
      setCanViewSchedules(perms.canViewSchedules ?? true)
      setCanManageSchedules(perms.canManageSchedules ?? false)
      setCanViewReports(perms.canViewReports ?? false)
      setCanExportReports(perms.canExportReports ?? false)
      setCanViewFinanceDashboard(perms.canViewFinanceDashboard ?? false)
      setCanAddIncome(perms.canAddIncome ?? false)
      setCanEditIncome(perms.canEditIncome ?? false)
      setCanDeleteIncome(perms.canDeleteIncome ?? false)
      setCanCreateFundRequest(perms.canCreateFundRequest ?? false)
      setCanApproveFundRequest(perms.canApproveFundRequest ?? false)
      setCanRejectFundRequest(perms.canRejectFundRequest ?? false)
      setCanReleaseFunds(perms.canReleaseFunds ?? false)
      setCanSubmitLiquidation(perms.canSubmitLiquidation ?? false)
      setCanReviewLiquidation(perms.canReviewLiquidation ?? false)
      setCanViewFinanceReports(perms.canViewFinanceReports ?? false)
      setCanExportFinanceReports(perms.canExportFinanceReports ?? false)
      setCanManageFinanceCategories(perms.canManageFinanceCategories ?? false)
      setCanCloseFinancePeriod(perms.canCloseFinancePeriod ?? false)
      setCanReopenFinancePeriod(perms.canReopenFinancePeriod ?? false)

      setCanViewProjects(perms.canViewProjects ?? false)
      setCanCreateProjects(perms.canCreateProjects ?? false)
      setCanEditProjects(perms.canEditProjects ?? false)
      setCanDeleteProjects(perms.canDeleteProjects ?? false)
      setCanDeleteEvents(perms.canDeleteEvents ?? false)
      setCanAssignTasks(perms.canAssignTasks ?? false)
      setCanManageAssignments(perms.canManageAssignments ?? false)
      setCanUpdateOwnTasks(perms.canUpdateOwnTasks ?? false)
      setCanUpdateAnyTask(perms.canUpdateAnyTask ?? false)
      setCanDeleteTasks(perms.canDeleteTasks ?? false)
      setCanCommentProjects(perms.canCommentProjects ?? false)
      setCanUploadProjectFiles(perms.canUploadProjectFiles ?? false)
      setCanViewProjectReports(perms.canViewProjectReports ?? false)
      setCanArchiveProjects(perms.canArchiveProjects ?? false)

      setCanViewEventFinance(perms.canViewEventFinance ?? false)
      setCanAddEventIncome(perms.canAddEventIncome ?? false)
      setCanAddEventExpense(perms.canAddEventExpense ?? false)
      setCanEditEventFinance(perms.canEditEventFinance ?? false)
      setCanVoidEventFinance(perms.canVoidEventFinance ?? false)
      setCanTransferEventFunds(perms.canTransferEventFunds ?? false)
      setCanManageEventFinanceCategories(perms.canManageEventFinanceCategories ?? false)

      setCanViewEventForms(perms.canViewEventForms ?? false)
      setCanCreateEventForms(perms.canCreateEventForms ?? false)
      setCanEditEventForms(perms.canEditEventForms ?? false)
      setCanPublishEventForms(perms.canPublishEventForms ?? false)
      setCanViewEventFormResponses(perms.canViewEventFormResponses ?? false)
      setCanExportEventFormResponses(perms.canExportEventFormResponses ?? false)
      setCanArchiveEventForms(perms.canArchiveEventForms ?? false)

      setCanViewEventContributions(perms.canViewEventContributions ?? false)
      setCanAddEventContributions(perms.canAddEventContributions ?? false)
      setCanEditEventContributions(perms.canEditEventContributions ?? false)
      setCanVoidEventContributions(perms.canVoidEventContributions ?? false)
      setCanManageEventContributionPurposes(perms.canManageEventContributionPurposes ?? false)
      setCanExportEventContributions(perms.canExportEventContributions ?? false)
    } else {
      if (presets.length > 0) applyPreset(presets[0])
    }
    setError(null)
    setIsModalOpen(true)
  }

  const toggleModule = (key: ModuleKey) => {
    setAllowedModules(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key)
      } else {
        return [...prev, key]
      }
    })
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Email address is required.')
      return
    }

    if (!editingUser && (!password || password.length < 6)) {
      setError('Password is required and must be at least 6 characters.')
      return
    }

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        setError('New Password and Confirm New Password do not match. Please verify.')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.')
        return
      }
    }

    if (role === 'order_leader' && !assignedOrder) {
      setError('Please select an Assigned Order for the Order Leader account.')
      return
    }

    const permissionsPayload: UserPermissions = {
      allowedModules,
      canTakeAttendance,
      canFinalizeAttendance,
      canViewSchedules,
      canManageSchedules,
      canViewReports,
      canExportReports,
      canViewFinanceDashboard,
      canAddIncome,
      canEditIncome,
      canDeleteIncome,
      canCreateFundRequest,
      canApproveFundRequest,
      canRejectFundRequest,
      canReleaseFunds,
      canSubmitLiquidation,
      canReviewLiquidation,
      canViewFinanceReports,
      canExportFinanceReports,
      canManageFinanceCategories,
      canCloseFinancePeriod,
      canReopenFinancePeriod,

      canViewProjects,
      canCreateProjects,
      canEditProjects,
      canDeleteProjects,
      canDeleteEvents,
      canAssignTasks,
      canManageAssignments,
      canUpdateOwnTasks,
      canUpdateAnyTask,
      canDeleteTasks,
      canCommentProjects,
      canUploadProjectFiles,
      canViewProjectReports,
      canArchiveProjects,

      canViewEventFinance,
      canAddEventIncome,
      canAddEventExpense,
      canEditEventFinance,
      canVoidEventFinance,
      canTransferEventFunds,
      canManageEventFinanceCategories,

      canViewEventForms,
      canCreateEventForms,
      canEditEventForms,
      canPublishEventForms,
      canViewEventFormResponses,
      canExportEventFormResponses,
      canArchiveEventForms,

      canViewEventContributions,
      canAddEventContributions,
      canEditEventContributions,
      canVoidEventContributions,
      canManageEventContributionPurposes,
      canExportEventContributions,

      ...(assignedOrder ? { assignedOrder } : {}),
      ...(activePresetName ? { presetName: activePresetName } : {})
    }

    setSaving(true)
    setError(null)
    setSuccessMsg(null)
    try {
      if (editingUser) {
        const isEditingCoordinator = editingUser.email.toLowerCase() === 'coordinator@mas.com'
        const isCurrentCoordinator = currentAdmin?.email?.toLowerCase() === 'coordinator@mas.com'

        if (editingUser.uid === currentAdmin?.uid && role !== 'admin' && role !== 'coordinator') {
          setError('You cannot revoke your own admin access.')
          setSaving(false)
          return
        }

        if (isEditingCoordinator && !isCurrentCoordinator) {
          setError('The Coordinator account can only be modified by the Coordinator themselves.')
          setSaving(false)
          return
        }

        const selectedOrder = assignedOrder ? (assignedOrder as OrderGroup) : undefined

        await userService.saveUserProfile(
          {
            uid: editingUser.uid,
            email: email.trim(),
            displayName: displayName.trim() || undefined,
            role,
            assignedOrder: selectedOrder,
            permissions: permissionsPayload
          },
          currentAdmin?.email || 'Admin'
        )

        setSuccessMsg(`User profile '${email.trim()}' successfully updated with custom permissions!`)
      } else {
        const selectedOrder = assignedOrder ? (assignedOrder as OrderGroup) : undefined

        await userService.registerNewUserWithAuth(
          {
            email: email.trim(),
            password: password.trim(),
            displayName: displayName.trim() || undefined,
            role,
            assignedOrder: selectedOrder,
            permissions: permissionsPayload
          },
          currentAdmin?.email || 'Admin'
        )

        setSuccessMsg(`User account '${email.trim()}' registered in system with dynamic module permissions!`)
      }

      setIsModalOpen(false)
      await loadData(false)
    } catch (err: any) {
      console.error(err)
      let msg = err.message || 'Failed to save user profile.'
      if (err.code === 'auth/weak-password') {
        msg = 'Password should be at least 6 characters long.'
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirmed = async () => {
    if (!deleteTarget) return
    // Prevent self-deletion
    if (deleteTarget.uid === currentAdmin?.uid) {
      setError('You cannot delete your own account.')
      setDeleteTarget(null)
      return
    }
    // Coordinator account is protected — only coordinator can delete themselves
    const isTargetCoordinator = deleteTarget.email.toLowerCase() === 'coordinator@mas.com'
    const isCurrentCoordinator = currentAdmin?.email?.toLowerCase() === 'coordinator@mas.com'
    if (isTargetCoordinator && !isCurrentCoordinator) {
      setError('The Coordinator account is protected and cannot be deleted by other admins.')
      setDeleteTarget(null)
      return
    }

    setSaving(true)
    setError(null)
    try {
      await userService.deleteUserProfile(
        deleteTarget.uid,
        deleteTarget.email,
        currentAdmin?.email || 'Admin'
      )
      setSuccessMsg(`User '${deleteTarget.email}' permanently removed from system.`)
      setDeleteTarget(null)
      await loadData(false)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to delete user profile.')
    } finally {
      setSaving(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="py-16 text-center bg-white rounded-xl border border-gray-200 p-8 shadow-xs max-w-md mx-auto font-sans">
        <h3 className="text-base font-bold text-gray-900">Access Restricted</h3>
        <p className="text-xs text-gray-500 mt-2">Only system administrators can access User Management.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-24 bg-white rounded-2xl border border-slate-200/80 shadow-2xs font-sans">
        <Loading variant="spinner" label="Loading User Accounts & Permissions..." />
      </div>
    )
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl font-sans">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage user accounts and configure custom module permissions.</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Register New User</span>
        </button>
      </div>

      {/* Main Users Table */}
      <Card className="p-0 overflow-hidden border border-gray-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                <th className="px-6 py-3.5">User Email</th>
                <th className="px-6 py-3.5">Display Name</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Assigned Preset</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                      <span className="text-xs text-gray-500">Loading user accounts...</span>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-xs text-gray-400 italic">
                    No user accounts found in database.
                  </td>
                </tr>
              ) : (
                users.slice((currentPage - 1) * 10, currentPage * 10).map((u) => {
                  const isCurrent = u.uid === currentAdmin?.uid

                  return (
                    <tr key={u.uid} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span>{u.email}</span>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-600 whitespace-nowrap">
                        {u.displayName || '--'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 border border-purple-200 text-purple-700">
                            Administrator
                          </span>
                        ) : u.role === 'order_leader' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700">
                            Order Leader {u.assignedOrder ? `(${u.assignedOrder})` : ''}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 border border-gray-200 text-gray-700">
                            User Account
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {(() => {
                          if (u.role === 'admin') {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200/80">
                                ✨ Full System Access
                              </span>
                            )
                          }

                          const presetName = u.permissions?.presetName
                          const mods = u.permissions?.allowedModules || []
                          const modulesTooltip = mods.length > 0 ? `Allowed Modules: ${mods.map(m => MODULE_LABELS[m] || m).join(', ')}` : 'No custom module access'

                          const matchedPreset = presetName ? presets.find(p => p.name.toLowerCase() === presetName.toLowerCase()) : undefined
                          const presetIcon = matchedPreset ? PRESET_ICONS[matchedPreset.icon] : null

                          if (presetName) {
                            return (
                              <span
                                title={modulesTooltip}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs cursor-help"
                              >
                                {presetIcon && <span className="text-blue-600 shrink-0">{presetIcon}</span>}
                                <span>{presetName}</span>
                              </span>
                            )
                          }

                          if (mods.length >= ALL_MODULES.length) {
                            return (
                              <span
                                title={modulesTooltip}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/80 cursor-help"
                              >
                                ✨ Full Module Access
                              </span>
                            )
                          }

                          if (mods.length > 0) {
                            return (
                              <span
                                title={modulesTooltip}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200/80 cursor-help"
                              >
                                Custom Access ({mods.length} Modules)
                              </span>
                            )
                          }

                          return <span className="text-gray-400 italic text-[11px]">Default Access</span>
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap text-xs space-x-1.5">
                        {/* Hide Edit/Remove for coordinator account unless you ARE the coordinator */}
                        {!(u.email.toLowerCase() === 'coordinator@mas.com' && currentAdmin?.email?.toLowerCase() !== 'coordinator@mas.com') && (
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            title="Edit Permissions"
                            className="p-2 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer border border-blue-100 inline-flex items-center justify-center"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {!isCurrent && !(u.email.toLowerCase() === 'coordinator@mas.com' && currentAdmin?.email?.toLowerCase() !== 'coordinator@mas.com') && (
                          <button
                            onClick={() => setDeleteTarget(u)}
                            title="Remove User"
                            className="p-2 text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer border border-red-100 inline-flex items-center justify-center"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalItems={users.length}
          pageSize={10}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Modal Fixed Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 bg-blue-50 rounded-xl text-blue-600 border border-blue-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {editingUser ? 'Edit Account & Permissions' : 'Register New User Account'}
                  </h3>
                  <p className="text-xs text-gray-500">Configure credentials and fine-tune module access.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            {/* Modal Scrollable Body */}
            <form id="user-form" onSubmit={handleSaveUser} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Account Credentials */}
              <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Account Profile
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">User Email *</label>
                    <input
                      type="email"
                      required
                      disabled={!!editingUser}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. taker@mas.com"
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Real Name (Officer's Name)</label>
                    <select
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- No Real Name Assigned --</option>
                      {members.sort((a, b) => a.lastName.localeCompare(b.lastName)).map(member => {
                        const fullName = `${member.firstName} ${member.lastName}`.trim()
                        return (
                          <option key={member.id} value={fullName}>
                            {fullName} {member.position ? `(${member.position})` : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                {/* Password Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {editingUser ? 'New Password (Optional)' : 'Password *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={editingUser ? 'Leave blank to keep...' : '••••••••'}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {editingUser ? 'Confirm Password' : 'Confirm Password *'}
                    </label>
                    <input
                      type="password"
                      required={!editingUser || password.length > 0}
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password..."
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Role Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Quick Access Presets</label>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenAddPreset()
                      setIsPresetsModalOpen(true)
                    }}
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Manage / Add Presets</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {presets.map((p) => {
                    const isSelected = activePresetId === p.id

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-semibold ring-1 ring-blue-500 shadow-xs'
                            : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <span className="text-blue-600">{PRESET_ICONS[p.icon] || PRESET_ICONS.clipboard}</span>
                          <span className="truncate">{p.name}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{p.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Module Access Checkboxes */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center justify-between">
                  <span>Module Navigation Access</span>
                  <span className="text-[10px] font-normal text-gray-400">Select allowed sidebar menus</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_MODULES.map((mod) => {
                    const checked = allowedModules.includes(mod.key)
                    return (
                      <label
                        key={mod.key}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                          checked
                            ? 'border-blue-300 bg-blue-50/40 text-gray-900'
                            : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleModule(mod.key)}
                          className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-bold">{mod.label}</div>
                          <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{mod.description}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Granular Action Restrictions */}
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Action Permissions & Scoping</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Attendance Controls */}
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Attendance Permissions</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canTakeAttendance}
                        onChange={(e) => setCanTakeAttendance(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Take & Save Attendance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canFinalizeAttendance}
                        onChange={(e) => setCanFinalizeAttendance(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Finalize & Lock Attendance Sessions</span>
                    </label>
                  </div>

                  {/* Schedule Controls */}
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <span className="text-xs font-bold text-gray-900 block">Schedule Permissions</span>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canViewSchedules}
                        onChange={(e) => setCanViewSchedules(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can View Schedules</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canManageSchedules}
                        onChange={(e) => setCanManageSchedules(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Add / Edit / Delete Schedules</span>
                    </label>
                  </div>
                </div>

                {/* Reports & Order Scoping */}
                <div className="p-3.5 rounded-xl border border-amber-200/80 bg-amber-50/40 space-y-3">
                  <span className="text-xs font-bold text-amber-900 block">Reports & Order Scoping</span>
                  <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={canExportReports}
                        onChange={(e) => setCanExportReports(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 h-4 w-4"
                      />
                      <span>Can Download / Export PDF Reports</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 mb-1">Assigned Order Group (Filter Scope)</label>
                    <select
                      value={assignedOrder}
                      onChange={(e) => setAssignedOrder(e.target.value as OrderGroup)}
                      className="block w-full sm:w-64 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="">-- All Orders (Unrestricted Scope) --</option>
                      {ORDER_GROUPS.map((grp) => (
                        <option key={grp} value={grp}>{grp}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-amber-700">If selected, member reports will be filtered exclusively for this Order.</p>
                  </div>
                </div>

                {/* Events Permissions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Events Management</span>
                      <button type="button" onClick={() => {
                        const val = !(canViewProjects && canCreateProjects && canEditProjects && canDeleteProjects && canDeleteEvents && canAssignTasks && canManageAssignments && canUpdateOwnTasks && canUpdateAnyTask && canDeleteTasks)
                        setCanViewProjects(val)
                        setCanCreateProjects(val)
                        setCanEditProjects(val)
                        setCanDeleteProjects(val)
                        setCanDeleteEvents(val)
                        setCanAssignTasks(val)
                        setCanManageAssignments(val)
                        setCanUpdateOwnTasks(val)
                        setCanUpdateAnyTask(val)
                        setCanDeleteTasks(val)
                      }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canViewProjects} onChange={e => setCanViewProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can View Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canCreateProjects} onChange={e => setCanCreateProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Create Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canEditProjects} onChange={e => setCanEditProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Edit Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canDeleteProjects} onChange={e => setCanDeleteProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Delete Projects</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canDeleteEvents} onChange={e => setCanDeleteEvents(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Delete Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canAssignTasks} onChange={e => setCanAssignTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Assign Tasks</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canManageAssignments} onChange={e => setCanManageAssignments(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Manage Team Assignments</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canUpdateOwnTasks} onChange={e => setCanUpdateOwnTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Update Own Tasks</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canUpdateAnyTask} onChange={e => setCanUpdateAnyTask(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Update Any Task</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canDeleteTasks} onChange={e => setCanDeleteTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Delete Tasks</span>
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Event Finance</span>
                      <button type="button" onClick={() => {
                        const val = !(canViewEventFinance && canAddEventIncome && canAddEventExpense && canEditEventFinance && canVoidEventFinance && canTransferEventFunds && canManageEventFinanceCategories)
                        setCanViewEventFinance(val)
                        setCanAddEventIncome(val)
                        setCanAddEventExpense(val)
                        setCanEditEventFinance(val)
                        setCanVoidEventFinance(val)
                        setCanTransferEventFunds(val)
                        setCanManageEventFinanceCategories(val)
                      }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canViewEventFinance} onChange={e => setCanViewEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can View Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canAddEventIncome} onChange={e => setCanAddEventIncome(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Add Event Income</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canAddEventExpense} onChange={e => setCanAddEventExpense(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Add Event Expense</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canEditEventFinance} onChange={e => setCanEditEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Edit Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canVoidEventFinance} onChange={e => setCanVoidEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Archive/Delete Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canTransferEventFunds} onChange={e => setCanTransferEventFunds(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Transfer Event Funds</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canManageEventFinanceCategories} onChange={e => setCanManageEventFinanceCategories(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Manage Event Finance Categories</span>
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Event Contributions</span>
                      <button type="button" onClick={() => {
                        const val = !(canViewEventContributions && canAddEventContributions && canEditEventContributions && canVoidEventContributions && canManageEventContributionPurposes && canExportEventContributions)
                        setCanViewEventContributions(val)
                        setCanAddEventContributions(val)
                        setCanEditEventContributions(val)
                        setCanVoidEventContributions(val)
                        setCanManageEventContributionPurposes(val)
                        setCanExportEventContributions(val)
                      }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canViewEventContributions} onChange={e => setCanViewEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can View Event Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canAddEventContributions} onChange={e => setCanAddEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Add / Record Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canEditEventContributions} onChange={e => setCanEditEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Edit Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canVoidEventContributions} onChange={e => setCanVoidEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Void / Archive Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canManageEventContributionPurposes} onChange={e => setCanManageEventContributionPurposes(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Manage Contribution Purposes</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canExportEventContributions} onChange={e => setCanExportEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Export Contribution PDF / CSV</span>
                    </label>
                  </div>

                  <div className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">Event Forms</span>
                      <button type="button" onClick={() => {
                        const val = !(canViewEventForms && canCreateEventForms && canEditEventForms && canPublishEventForms && canViewEventFormResponses && canExportEventFormResponses && canArchiveEventForms)
                        setCanViewEventForms(val)
                        setCanCreateEventForms(val)
                        setCanEditEventForms(val)
                        setCanPublishEventForms(val)
                        setCanViewEventFormResponses(val)
                        setCanExportEventFormResponses(val)
                        setCanArchiveEventForms(val)
                      }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canViewEventForms} onChange={e => setCanViewEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can View Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canCreateEventForms} onChange={e => setCanCreateEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Create Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canEditEventForms} onChange={e => setCanEditEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Edit Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canPublishEventForms} onChange={e => setCanPublishEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Publish Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canViewEventFormResponses} onChange={e => setCanViewEventFormResponses(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can View Form Responses</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canExportEventFormResponses} onChange={e => setCanExportEventFormResponses(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Export Form Responses</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={canArchiveEventForms} onChange={e => setCanArchiveEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-4 w-4" />
                      <span>Can Archive / Delete Event Forms</span>
                    </label>
                  </div>
                </div>

              </div>
            </form>

            {/* Modal Fixed Footer */}
            <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-100 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="user-form"
                disabled={saving}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingUser ? 'Save Permissions' : 'Create Account'}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Presets Management Modal */}
      {isPresetsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={() => setIsPresetsModalOpen(false)}></div>
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl z-10 text-gray-800 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white shrink-0">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 bg-purple-50 rounded-xl text-purple-600 border border-purple-100">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Manage System Permission Presets</h3>
                  <p className="text-xs text-gray-500">Create, edit, or remove dynamic access presets.</p>
                </div>
              </div>
              <button onClick={() => setIsPresetsModalOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Presets List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Available Presets ({presets.length})</span>
                  <button
                    type="button"
                    onClick={handleOpenAddPreset}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    + Add New Preset
                  </button>
                </div>

                <div className="space-y-2">
                  {presets.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-white rounded-lg border border-gray-200 text-blue-600">
                          {PRESET_ICONS[p.icon] || PRESET_ICONS.clipboard}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-gray-900">{p.name}</div>
                          <div className="text-[11px] text-gray-500">{p.description}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPreset(p)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePreset(p.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-md hover:bg-red-100 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>

                {/* Add / Edit Preset Form */}
                <form onSubmit={handleSavePreset} className="bg-gray-50/80 p-4 rounded-xl border border-gray-200 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  {presetEditing ? `Edit Preset: ${presetEditing.name}` : 'Create New Permission Preset'}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Preset Name *</label>
                    <input
                      type="text"
                      required
                      value={presetFormName}
                      onChange={(e) => setPresetFormName(e.target.value)}
                      placeholder="e.g. Secretary"
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Icon Style *</label>
                    <select
                      value={presetFormIcon}
                      onChange={(e) => setPresetFormIcon(e.target.value as any)}
                      className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="clipboard">Clipboard (Attendance)</option>
                      <option value="users">Group (Order Leader)</option>
                      <option value="shield">Shield (Admin)</option>
                      <option value="calendar">Calendar (Schedules)</option>
                      <option value="chart">Chart (Reports)</option>
                      <option value="settings">Settings (Config)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Description</label>
                  <input
                    type="text"
                    value={presetFormDesc}
                    onChange={(e) => setPresetFormDesc(e.target.value)}
                    placeholder="e.g. Manage schedules & view attendance"
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Module Access</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {ALL_MODULES.map(m => {
                      const checked = presetFormModules.includes(m.key)
                      return (
                        <label key={m.key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setPresetFormModules(prev => prev.filter(x => x !== m.key))
                              } else {
                                setPresetFormModules(prev => [...prev, m.key])
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5"
                          />
                          <span>{m.label}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Events Permissions in Preset */}
                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Events Management (Preset)</h4>
                    <button type="button" onClick={() => {
                      const val = !(presetFormViewProjects && presetFormCreateProjects && presetFormEditProjects && presetFormDeleteProjects && presetFormDeleteEvents && presetFormAssignTasks && presetFormManageAssignments && presetFormUpdateOwnTasks && presetFormUpdateAnyTask && presetFormDeleteTasks)
                      setPresetFormViewProjects(val)
                      setPresetFormCreateProjects(val)
                      setPresetFormEditProjects(val)
                      setPresetFormDeleteProjects(val)
                      setPresetFormDeleteEvents(val)
                      setPresetFormAssignTasks(val)
                      setPresetFormManageAssignments(val)
                      setPresetFormUpdateOwnTasks(val)
                      setPresetFormUpdateAnyTask(val)
                      setPresetFormDeleteTasks(val)
                    }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormViewProjects} onChange={e => setPresetFormViewProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can View Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormCreateProjects} onChange={e => setPresetFormCreateProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Create Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormEditProjects} onChange={e => setPresetFormEditProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Edit Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormDeleteProjects} onChange={e => setPresetFormDeleteProjects(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Delete Projects</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormDeleteEvents} onChange={e => setPresetFormDeleteEvents(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Delete Events</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormAssignTasks} onChange={e => setPresetFormAssignTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Assign Tasks</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormManageAssignments} onChange={e => setPresetFormManageAssignments(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Manage Team Assignments</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormUpdateOwnTasks} onChange={e => setPresetFormUpdateOwnTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Update Own Tasks</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormUpdateAnyTask} onChange={e => setPresetFormUpdateAnyTask(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Update Any Task</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormDeleteTasks} onChange={e => setPresetFormDeleteTasks(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Delete Tasks</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Event Finance (Preset)</h4>
                    <button type="button" onClick={() => {
                      const val = !(presetFormViewEventFinance && presetFormAddEventIncome && presetFormAddEventExpense && presetFormEditEventFinance && presetFormVoidEventFinance && presetFormTransferEventFunds && presetFormManageEventFinanceCategories)
                      setPresetFormViewEventFinance(val)
                      setPresetFormAddEventIncome(val)
                      setPresetFormAddEventExpense(val)
                      setPresetFormEditEventFinance(val)
                      setPresetFormVoidEventFinance(val)
                      setPresetFormTransferEventFunds(val)
                      setPresetFormManageEventFinanceCategories(val)
                    }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormViewEventFinance} onChange={e => setPresetFormViewEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can View Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormAddEventIncome} onChange={e => setPresetFormAddEventIncome(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Add Event Income</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormAddEventExpense} onChange={e => setPresetFormAddEventExpense(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Add Event Expense</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormEditEventFinance} onChange={e => setPresetFormEditEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Edit Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormVoidEventFinance} onChange={e => setPresetFormVoidEventFinance(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Archive/Delete Event Finance</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormTransferEventFunds} onChange={e => setPresetFormTransferEventFunds(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Transfer Event Funds</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormManageEventFinanceCategories} onChange={e => setPresetFormManageEventFinanceCategories(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Manage Event Finance Categories</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Event Contributions (Preset)</h4>
                    <button type="button" onClick={() => {
                      const val = !(presetFormViewEventContributions && presetFormAddEventContributions && presetFormEditEventContributions && presetFormVoidEventContributions && presetFormManageEventContributionPurposes && presetFormExportEventContributions)
                      setPresetFormViewEventContributions(val)
                      setPresetFormAddEventContributions(val)
                      setPresetFormEditEventContributions(val)
                      setPresetFormVoidEventContributions(val)
                      setPresetFormManageEventContributionPurposes(val)
                      setPresetFormExportEventContributions(val)
                    }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormViewEventContributions} onChange={e => setPresetFormViewEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can View Event Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormAddEventContributions} onChange={e => setPresetFormAddEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Add / Record Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormEditEventContributions} onChange={e => setPresetFormEditEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Edit Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormVoidEventContributions} onChange={e => setPresetFormVoidEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Void / Archive Contributions</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormManageEventContributionPurposes} onChange={e => setPresetFormManageEventContributionPurposes(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Manage Contribution Purposes</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormExportEventContributions} onChange={e => setPresetFormExportEventContributions(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Export Contribution PDF / CSV</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">Event Forms (Preset)</h4>
                    <button type="button" onClick={() => {
                      const val = !(presetFormViewEventForms && presetFormCreateEventForms && presetFormEditEventForms && presetFormPublishEventForms && presetFormViewEventFormResponses && presetFormExportEventFormResponses && presetFormArchiveEventForms)
                      setPresetFormViewEventForms(val)
                      setPresetFormCreateEventForms(val)
                      setPresetFormEditEventForms(val)
                      setPresetFormPublishEventForms(val)
                      setPresetFormViewEventFormResponses(val)
                      setPresetFormExportEventFormResponses(val)
                      setPresetFormArchiveEventForms(val)
                    }} className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer">Toggle All</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormViewEventForms} onChange={e => setPresetFormViewEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can View Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormCreateEventForms} onChange={e => setPresetFormCreateEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Create Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormEditEventForms} onChange={e => setPresetFormEditEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Edit Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormPublishEventForms} onChange={e => setPresetFormPublishEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Publish Event Forms</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormViewEventFormResponses} onChange={e => setPresetFormViewEventFormResponses(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can View Form Responses</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormExportEventFormResponses} onChange={e => setPresetFormExportEventFormResponses(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Export Form Responses</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input type="checkbox" checked={presetFormArchiveEventForms} onChange={e => setPresetFormArchiveEventForms(e.target.checked)} className="rounded border-gray-300 text-blue-600 h-3.5 w-3.5" />
                      <span>Can Archive / Delete Event Forms</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                  {presetEditing && (
                    <button
                      type="button"
                      onClick={handleOpenAddPreset}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {presetEditing ? 'Update Preset' : 'Save New Preset'}
                  </button>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsPresetsModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirmed}
        variant="danger"
        title="Remove User Account Profile"
        message={`Are you sure you want to remove '${deleteTarget?.email}' from system user profiles?`}
        confirmLabel="Remove Profile"
        loading={saving}
      />

      {/* Alert Dialogs */}
      <AlertModal
        isOpen={!!error}
        onClose={() => setError(null)}
        variant="error"
        title="User Management Error"
        message={error || ''}
      />

      <AlertModal
        isOpen={!!successMsg}
        onClose={() => setSuccessMsg(null)}
        variant="success"
        title="Success"
        message={successMsg || ''}
      />

      <AlertModal
        isOpen={!!presetSuccessMsg}
        onClose={() => setPresetSuccessMsg(null)}
        variant="success"
        title="Preset Saved"
        message={presetSuccessMsg || ''}
      />
    </div>
  )
}
