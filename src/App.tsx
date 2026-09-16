import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/authentication/AuthContext'
import { MaintenanceProvider } from '@/context/MaintenanceContext'
import { PublicMaintenanceGuard } from '@/features/maintenance/components/PublicMaintenanceGuard'
import { PWAProvider } from '@/context/PWAContext'
import { TutorialProvider } from '@/context/TutorialContext'
import { ProtectedRoute, PublicRoute } from '@/features/authentication/components/ProtectedRoute'
import { LoginPage } from '@/features/authentication/components/LoginPage'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { DashboardOverview } from '@/features/dashboard/components/DashboardOverview'
import { MembersPage } from '@/features/members/pages/MembersPage'
import { SchedulesPage } from '@/features/schedules/pages/SchedulesPage'
import { AttendancePage } from '@/features/attendance/pages/AttendancePage'
import { ReportsPage } from '@/features/reports/pages/ReportsPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { AuditPage } from '@/features/audit/pages/AuditPage'
import { UsersPage } from '@/features/users/pages/UsersPage'
import { ChangePasswordPage } from '@/features/authentication/pages/ChangePasswordPage'
import { PublicSchedulePage } from '@/features/schedules/pages/PublicSchedulePage'
import { PublicExcusePage } from '@/features/excuse/PublicExcusePage'
import { PublicEventFormPage } from '@/features/events/pages/PublicEventFormPage'
import { AdminExcusePage } from '@/features/excuse/AdminExcusePage'
import { FinancePage } from '@/features/finance/pages/FinancePage'
import { EventsPage } from '@/features/events/pages/EventsPage'
import { EventDetailsPage } from '@/features/events/pages/EventDetailsPage'
import { InventoryPage } from '@/features/inventory/pages/InventoryPage'
import { DesignSystemShowcasePage } from '@/features/preview/DesignSystemShowcasePage'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { ToastProvider } from '@/context/ToastContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { useEffect } from 'react'
import { initializeNativeBridge } from '@/utils/nativeAppBridge'
import { useNavigate } from 'react-router-dom'

function NativeBridgeInit() {
  const navigate = useNavigate()
  useEffect(() => {
    const cleanup = initializeNativeBridge((path) => navigate(path))
    return cleanup
  }, [navigate])
  return null
}

function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <MaintenanceProvider>
          <TutorialProvider>
            <ToastProvider>
              <NotificationProvider>
                <BrowserRouter>
                  <NativeBridgeInit />
                  <Routes>
                {/* Design System Preview Route (Phase 1 Preview) */}
                <Route path="/design-system-preview" element={<DesignSystemShowcasePage />} />

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
          <PWAUpdatePrompt />
        </BrowserRouter>
              </NotificationProvider>
            </ToastProvider>
          </TutorialProvider>
        </MaintenanceProvider>
      </AuthProvider>
    </PWAProvider>
  )
}

export default App
