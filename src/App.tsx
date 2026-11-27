import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { AuthProvider } from '@/features/authentication/AuthContext'
import { MaintenanceProvider } from '@/context/MaintenanceContext'
import { PublicMaintenanceGuard } from '@/features/maintenance/components/PublicMaintenanceGuard'
import { PWAProvider } from '@/context/PWAContext'
import { TutorialProvider } from '@/context/TutorialContext'
import { ProtectedRoute, PublicRoute } from '@/features/authentication/components/ProtectedRoute'
import { LoginPage } from '@/features/authentication/components/LoginPage'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { DashboardOverview } from '@/features/dashboard/components/DashboardOverview'
import { Loading } from '@/components/Loading'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { ToastProvider } from '@/context/ToastContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { ThemeProvider } from '@/context/ThemeContext'
import { initializeNativeBridge } from '@/utils/nativeAppBridge'
import { nativeWidgetService } from '@/services/nativeWidgetService'
import { useNavigate } from 'react-router-dom'

// Lazy load non-critical and heavy feature pages to minimize initial bundle size and boost startup speed
const DashboardRedesignLabPage = lazy(() => import('@/features/dashboard/pages/DashboardRedesignLabPage').then(m => ({ default: m.DashboardRedesignLabPage })))
const MembersPage = lazy(() => import('@/features/members/pages/MembersPage').then(m => ({ default: m.MembersPage })))
const SchedulesPage = lazy(() => import('@/features/schedules/pages/SchedulesPage').then(m => ({ default: m.SchedulesPage })))
const AttendancePage = lazy(() => import('@/features/attendance/pages/AttendancePage').then(m => ({ default: m.AttendancePage })))
const ReportsPage = lazy(() => import('@/features/reports/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AuditPage = lazy(() => import('@/features/audit/pages/AuditPage').then(m => ({ default: m.AuditPage })))
const UsersPage = lazy(() => import('@/features/users/pages/UsersPage').then(m => ({ default: m.UsersPage })))
const ChangePasswordPage = lazy(() => import('@/features/authentication/pages/ChangePasswordPage').then(m => ({ default: m.ChangePasswordPage })))
const PublicSchedulePage = lazy(() => import('@/features/schedules/pages/PublicSchedulePage').then(m => ({ default: m.PublicSchedulePage })))
const PublicExcusePage = lazy(() => import('@/features/excuse/PublicExcusePage').then(m => ({ default: m.PublicExcusePage })))
const PublicEventFormPage = lazy(() => import('@/features/events/pages/PublicEventFormPage').then(m => ({ default: m.PublicEventFormPage })))
const PaxTecumLandingPage = lazy(() => import('@/features/events/pages/PaxTecumLandingPage').then(m => ({ default: m.PaxTecumLandingPage })))
const AdminExcusePage = lazy(() => import('@/features/excuse/AdminExcusePage').then(m => ({ default: m.AdminExcusePage })))
const FinancePage = lazy(() => import('@/features/finance/pages/FinancePage').then(m => ({ default: m.FinancePage })))
const EventsPage = lazy(() => import('@/features/events/pages/EventsPage').then(m => ({ default: m.EventsPage })))
const EventDetailsPage = lazy(() => import('@/features/events/pages/EventDetailsPage').then(m => ({ default: m.EventDetailsPage })))
const InventoryPage = lazy(() => import('@/features/inventory/pages/InventoryPage').then(m => ({ default: m.InventoryPage })))
const DesignSystemShowcasePage = lazy(() => import('@/features/preview/DesignSystemShowcasePage').then(m => ({ default: m.DesignSystemShowcasePage })))
const LoginPageShowcasePage = lazy(() => import('@/features/preview/LoginPageShowcasePage').then(m => ({ default: m.LoginPageShowcasePage })))
const BulkFinalizeShowcasePage = lazy(() => import('@/features/preview/BulkFinalizeShowcasePage').then(m => ({ default: m.BulkFinalizeShowcasePage })))
const RedesignShowroomPage = lazy(() => import('@/features/preview/RedesignShowroomPage').then(m => ({ default: m.RedesignShowroomPage })))

function NativeBridgeInit() {
  const navigate = useNavigate()
  useEffect(() => {
    const cleanup = initializeNativeBridge((path) => navigate(path))
    nativeWidgetService.syncUpcomingMassesWidget().catch(() => {})
    return cleanup
  }, [navigate])
  return null
}

function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <ThemeProvider>
          <MaintenanceProvider>
          <TutorialProvider>
            <ToastProvider>
              <NotificationProvider>
                <BrowserRouter>
                  <NativeBridgeInit />
                  <Suspense fallback={<Loading label="Loading MATS..." />}>
                    <Routes>
                  {/* Design System Preview Route (Phase 1 Preview) */}
                <Route path="/redesign-showroom" element={<RedesignShowroomPage />} />
                <Route path="/design-system-preview" element={<DesignSystemShowcasePage />} />
                <Route path="/login-preview" element={<LoginPageShowcasePage />} />
                <Route path="/bulk-finalize-preview" element={<BulkFinalizeShowcasePage />} />

                {/* Public Login Route */}
                <Route 
                  path="/login" 
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  } 
                />

              {/* Public Self-Service Schedule Link */}
              <Route 
                path="/public/schedule/:id" 
                element={
                  <PublicMaintenanceGuard>
                    <PublicSchedulePage />
                  </PublicMaintenanceGuard>
                } 
              />

              {/* Public Excuse Link */}
              <Route 
                path="/public/excuse" 
                element={
                  <PublicMaintenanceGuard>
                    <PublicExcusePage />
                  </PublicMaintenanceGuard>
                } 
              />

              {/* Public Pax Tecum Landing Page */}
              <Route 
                path="/pax-tecum" 
                element={
                  <PublicMaintenanceGuard>
                    <PaxTecumLandingPage />
                  </PublicMaintenanceGuard>
                } 
              />

              {/* Public Event Registration Form Link */}
              <Route 
                path="/public/events/:eventId/forms/:formId" 
                element={
                  <PublicMaintenanceGuard>
                    <PublicEventFormPage />
                  </PublicMaintenanceGuard>
                } 
              />
              <Route 
                path="/public/forms/:formId" 
                element={
                  <PublicMaintenanceGuard>
                    <PublicEventFormPage />
                  </PublicMaintenanceGuard>
                } 
              />

            {/* Protected Routes wrapped under a single layout parent */}
            <Route 
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/dashboard-preview" element={<DashboardRedesignLabPage />} />
              
              <Route 
                path="/members" 
                element={
                  <ProtectedRoute moduleKey="members">
                    <MembersPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/schedules" 
                element={
                  <ProtectedRoute moduleKey="schedules">
                    <SchedulesPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/attendance" 
                element={
                  <ProtectedRoute moduleKey="attendance">
                    <AttendancePage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/reports" 
                element={
                  <ProtectedRoute moduleKey="reports">
                    <ReportsPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/finance" 
                element={
                  <ProtectedRoute moduleKey="finance" requiredPermission="canViewFinanceDashboard">
                    <FinancePage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/change-password" 
                element={<ChangePasswordPage />} 
              />

              <Route 
                path="/users" 
                element={
                  <ProtectedRoute adminOnly>
                    <UsersPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute adminOnly>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/audit" 
                element={
                  <ProtectedRoute adminOnly>
                    <AuditPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/excuses" 
                element={
                  <ProtectedRoute moduleKey="excuses">
                    <AdminExcusePage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/events" 
                element={
                  <ProtectedRoute moduleKey="events">
                    <EventsPage />
                  </ProtectedRoute>
                } 
              />
              
              <Route 
                path="/events/:id" 
                element={
                  <ProtectedRoute moduleKey="events">
                    <EventDetailsPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/inventory" 
                element={
                  <ProtectedRoute moduleKey="inventory">
                    <InventoryPage />
                  </ProtectedRoute>
                } 
              />
            </Route>

            {/* Fallback redirection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <PWAUpdatePrompt />
      </BrowserRouter>
              </NotificationProvider>
            </ToastProvider>
          </TutorialProvider>
        </MaintenanceProvider>
        </ThemeProvider>
      </AuthProvider>
    </PWAProvider>
  )
}

export default App
