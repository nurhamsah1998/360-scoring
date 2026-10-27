import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setState({ session: data.session, loading: false })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false })
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true })
    })
    return () => sub.subscription.unsubscribe()
  }, [navigate])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
