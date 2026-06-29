import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/authentication/AuthContext'
import { ProtectedRoute, PublicRoute } from '@/features/authentication/components/ProtectedRoute'
import { LoginPage } from '@/features/authentication/components/LoginPage'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { DashboardOverview } from '@/features/dashboard/components/DashboardOverview'
import { PlaceholderPage } from '@/components/PlaceholderPage'
import { MembersPage } from '@/features/members/pages/MembersPage'
import { SchedulesPage } from '@/features/schedules/pages/SchedulesPage'

function App() {
  return (
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
              element={<PlaceholderPage title="Attendance Tracking" phase="Phase 5" />} 
            />
            
            <Route 
              path="/reports" 
              element={<PlaceholderPage title="Weekly & Monthly Reports" phase="Phase 6" />} 
            />
          </Route>

          {/* Fallback redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
