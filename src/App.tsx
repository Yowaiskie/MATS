import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/features/authentication/AuthContext'
import { ProtectedRoute, PublicRoute } from '@/features/authentication/components/ProtectedRoute'
import { LoginPage } from '@/features/authentication/components/LoginPage'
import { DashboardPlaceholder } from '@/features/dashboard/DashboardPlaceholder'

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

          {/* Protected Dashboard Route */}
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <DashboardPlaceholder />
              </ProtectedRoute>
            } 
          />

          {/* Fallback redirection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
