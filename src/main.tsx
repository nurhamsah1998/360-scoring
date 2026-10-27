import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import { GuestOnly, RequireAuth } from './auth/guards'
import { Spinner } from './components/ui'
import './i18n'
import './index.css'
import Landing from './pages/Landing'

const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'))
const CreateOrg = lazy(() => import('./pages/CreateOrg'))
const AppLayout = lazy(() => import('./pages/AppLayout'))
const AppHome = lazy(() => import('./pages/AppHome'))
const Members = lazy(() => import('./pages/Members'))
const ImportMembers = lazy(() => import('./pages/ImportMembers'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Spinner fullScreen />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/sign-in" element={<GuestOnly><SignIn /></GuestOnly>} />
              <Route path="/sign-up" element={<GuestOnly><SignUp /></GuestOnly>} />
              <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
              <Route path="/reset-password" element={<RequireAuth><ResetPassword /></RequireAuth>} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/onboarding" element={<RequireAuth><CreateOrg /></RequireAuth>} />
              <Route path="/app" element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route index element={<AppHome />} />
                <Route path="members" element={<Members />} />
                <Route path="members/import" element={<ImportMembers />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
