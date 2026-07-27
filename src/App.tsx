import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/authentication/AuthContext'
import { PWAProvider } from '@/context/PWAContext'
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

function App() {
  return (
    <PWAProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Login Route */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
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
                element={<MembersPage />} 
              />
              
              <Route 
                path="/schedules" 
                element={<SchedulesPage />} 
              />
              
              <Route 
                path="/attendance" 
                element={<AttendancePage />} 
              />
              
              <Route 
                path="/reports" 
                element={<ReportsPage />} 
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
            </Route>

            {/* Fallback redirection */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PWAProvider>
  )
}

export default App
