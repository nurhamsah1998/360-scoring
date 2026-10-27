import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider'
import { appUrl, supabase } from './supabase'

export type Member = {
  id: string
  email: string
  full_name: string
  job_title: string
  role: 'admin' | 'member'
  status: 'invited' | 'active' | 'inactive'
  manager_id: string | null
  user_id: string | null
}

export type InviteRow = { name: string; email: string; jobTitle?: string; managerEmail?: string }

export type InviteResult = {
  email: string
  status: 'created' | 'exists' | 'invalid' | 'error'
  error?: string
  managerError?: string
  emailSent: boolean
  emailNote?: 'existing_account' | 'send_failed' | 'skipped'
  emailError?: string
}

export const displayName = (m: Pick<Member, 'full_name' | 'email'>) => m.full_name || m.email

export function useMembers(orgId: string | undefined) {
  return useQuery({
    queryKey: ['members', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, email, full_name, job_title, role, status, manager_id, user_id')
        .eq('org_id', orgId!)
        .order('full_name')
      if (error) throw error
      return data as Member[]
    },
  })
}

async function invokeInvite(body: Record<string, unknown>): Promise<InviteResult[]> {
  const { data, error } = await supabase.functions.invoke('invite-members', { body })
  if (error) {
    // Surface the function's own error message when there is one.
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null)
      if (payload?.error) throw new Error(payload.error)
    }
    throw error
  }
  return (data as { results: InviteResult[] }).results
}

export function useInviteMembers(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (members: InviteRow[]) =>
      invokeInvite({ orgId, members, redirectTo: appUrl('/accept-invite') }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  })
}

export function useResendInvite(orgId: string) {
  return useMutation({
    mutationFn: (m: Member) =>
      invokeInvite({ orgId, resendOnly: true, members: [{ email: m.email, name: m.full_name }], redirectTo: appUrl('/accept-invite') }),
  })
}

export function useUpdateMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Member, 'full_name' | 'job_title' | 'role' | 'status' | 'manager_id'>> }) => {
      const { data, error } = await supabase.from('memberships').update(patch).eq('id', id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('not_allowed')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  })
}

export function useDeleteInvite(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('memberships').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  })
}

// ── Invitations addressed to the signed-in user ──
export type PendingInvite = { id: string; org: { id: string; name: string } }

export function usePendingInvites() {
  const { session } = useAuth()
  const email = session?.user.email?.toLowerCase()
  return useQuery({
    queryKey: ['pending-invites', email],
    enabled: !!email,
    queryFn: async (): Promise<PendingInvite[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, organizations!inner(id, name)')
        .eq('status', 'invited')
        .is('user_id', null)
        .eq('email', email!)
      if (error) throw error
      return (data ?? []).map((r) => ({ id: r.id, org: r.organizations as unknown as PendingInvite['org'] }))
    },
  })
}

export function useRespondInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, accept }: { id: string; accept: boolean }) => {
      const { data, error } = accept
        ? await supabase.rpc('accept_invitation', { p_membership: id })
        : await supabase.rpc('decline_invitation', { p_membership: id })
      if (error) throw error
      return data as string | null // org slug when accepted
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['pending-invites'] })
      qc.invalidateQueries({ queryKey: ['my-orgs'] })
    },
  })
}

/** Member ids that report (directly or indirectly) to `id` — they can't be its manager. */
export function descendantsOf(id: string, members: Member[]): Set<string> {
  const children = new Map<string, string[]>()
  for (const m of members) {
    if (!m.manager_id) continue
    children.set(m.manager_id, [...(children.get(m.manager_id) ?? []), m.id])
  }
  const out = new Set<string>()
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop()!
    if (out.has(cur)) continue
    out.add(cur)
    stack.push(...(children.get(cur) ?? []))
  }
  return out
}
