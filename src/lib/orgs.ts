import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { supabase } from './supabase'

export type MyOrg = {
  membershipId: string
  role: 'admin' | 'member'
  org: { id: string; name: string; slug: string }
}

const CURRENT_ORG_KEY = 'currentOrg'

export function useMyOrgs() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['my-orgs', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyOrg[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, role, organizations!inner(id, name, slug)')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .order('created_at')
      if (error) throw error
      return (data ?? []).map((m) => ({
        membershipId: m.id,
        role: m.role as MyOrg['role'],
        org: m.organizations as unknown as MyOrg['org'],
      }))
    },
  })
}

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, locale')
        .eq('user_id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}

export const getCurrentOrgSlug = () => {
  try { return localStorage.getItem(CURRENT_ORG_KEY) } catch { return null }
}
export const setCurrentOrgSlug = (slug: string) => {
  try { localStorage.setItem(CURRENT_ORG_KEY, slug) } catch { /* storage unavailable */ }
}
