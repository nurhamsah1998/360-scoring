import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner fullScreen />
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  return children
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <Spinner fullScreen />
  if (session) return <Navigate to="/app" replace />
  return children
}
