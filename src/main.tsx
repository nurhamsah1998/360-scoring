import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { GuestOnly, RequireAuth } from './auth/guards'
import './i18n'
import './index.css'
import AppHome from './pages/AppHome'
import CreateOrg from './pages/CreateOrg'
import ForgotPassword from './pages/ForgotPassword'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import ResetPassword from './pages/ResetPassword'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in" element={<GuestOnly><SignIn /></GuestOnly>} />
            <Route path="/sign-up" element={<GuestOnly><SignUp /></GuestOnly>} />
            <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
            <Route path="/reset-password" element={<RequireAuth><ResetPassword /></RequireAuth>} />
            <Route path="/onboarding" element={<RequireAuth><CreateOrg /></RequireAuth>} />
            <Route path="/app" element={<RequireAuth><AppHome /></RequireAuth>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
