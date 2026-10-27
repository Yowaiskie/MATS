import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../../src/features/authentication/AuthContext'
import { PublicSchedulePage } from '../../src/features/schedules/pages/PublicSchedulePage'
import '../../src/index.css'

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={new QueryClient()}><AuthProvider><MemoryRouter initialEntries={['/public/schedule/public-cycle']}><Routes><Route path="/public/schedule/:id" element={<PublicSchedulePage />} /></Routes></MemoryRouter></AuthProvider></QueryClientProvider>
)
