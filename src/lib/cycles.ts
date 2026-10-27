import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export const STAGES = ['draft', 'nomination', 'review', 'closed', 'released'] as const
export type Stage = (typeof STAGES)[number]

export type Cycle = {
  id: string
  org_id: string
  name: string
  status: Stage
  template_id: string | null
  nomination_due: string | null
  review_due: string | null
  peer_min: number
  peer_max: number
  min_raters: number
  created_at: string
}

export type Participant = { reviewee_id: string; manager_id: string | null }
export type NominationStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type Nomination = { id: string; reviewee_id: string; peer_id: string; status: NominationStatus; created_at: string }
export type Assignment = { id: string; reviewee_id: string; reviewer_id: string; relationship: 'self' | 'manager' | 'peer' | 'direct_report'; status: 'pending' | 'submitted' | 'void' }

const CYCLE_COLS = 'id, org_id, name, status, template_id, nomination_due, review_due, peer_min, peer_max, min_raters, created_at'

export function useCycles(orgId: string | undefined) {
  return useQuery({
    queryKey: ['cycles', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycles')
        .select(`${CYCLE_COLS}, cycle_participants(count)`)
        .eq('org_id', orgId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((c) => ({
        ...(c as unknown as Cycle),
        participantCount: (c.cycle_participants as unknown as { count: number }[])[0]?.count ?? 0,
      }))
    },
  })
}

export function useCycle(id: string | undefined) {
  return useQuery({
    queryKey: ['cycle', id],
    enabled: !!id,
    queryFn: async (): Promise<Cycle | null> => {
      const { data, error } = await supabase.from('cycles').select(CYCLE_COLS).eq('id', id!).maybeSingle()
      if (error) throw error
      return data as Cycle | null
    },
  })
}

export function useParticipants(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['participants', cycleId],
    enabled: !!cycleId,
    queryFn: async (): Promise<Participant[]> => {
      const { data, error } = await supabase.from('cycle_participants').select('reviewee_id, manager_id').eq('cycle_id', cycleId!)
      if (error) throw error
      return data as Participant[]
    },
  })
}

export function useNominations(cycleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['nominations', cycleId],
    enabled: !!cycleId && enabled,
    queryFn: async (): Promise<Nomination[]> => {
      const { data, error } = await supabase
        .from('nominations').select('id, reviewee_id, peer_id, status, created_at').eq('cycle_id', cycleId!).order('created_at')
      if (error) throw error
      return data as Nomination[]
    },
  })
}

export function useAssignments(cycleId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['assignments', cycleId],
    enabled: !!cycleId && enabled,
    queryFn: async (): Promise<Assignment[]> => {
      const { data, error } = await supabase
        .from('assignments').select('id, reviewee_id, reviewer_id, relationship, status').eq('cycle_id', cycleId!)
      if (error) throw error
      return data as Assignment[]
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return (keys: unknown[][]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })))
}

export function useCycleOps(orgId: string, cycleId?: string) {
  const inv = useInvalidate()
  const after = () => inv([['cycles', orgId], ['cycle', cycleId], ['participants', cycleId], ['nominations', cycleId], ['assignments', cycleId], ['tasks', orgId]])
  const check = ({ error }: { error: unknown }) => { if (error) throw error }

  return {
    create: useMutation({
      mutationFn: async (v: { name: string; templateId: string | null }) => {
        const { data, error } = await supabase
          .from('cycles').insert({ org_id: orgId, name: v.name, template_id: v.templateId }).select('id').single()
        if (error) throw error
        return data.id as string
      },
      onSettled: () => inv([['cycles', orgId]]),
    }),
    update: useMutation({
      mutationFn: async (patch: Partial<Omit<Cycle, 'id' | 'org_id' | 'status' | 'created_at'>>) =>
        check(await supabase.from('cycles').update(patch).eq('id', cycleId!)),
      onSettled: after,
    }),
    remove: useMutation({
      mutationFn: async () => check(await supabase.from('cycles').delete().eq('id', cycleId!)),
      onSettled: () => inv([['cycles', orgId]]),
    }),
    addParticipants: useMutation({
      mutationFn: async (ids: string[]) =>
        check(await supabase.from('cycle_participants').upsert(ids.map((reviewee_id) => ({ cycle_id: cycleId!, reviewee_id })), { ignoreDuplicates: true })),
      onSettled: after,
    }),
    removeParticipant: useMutation({
      mutationFn: async (revieweeId: string) =>
        check(await supabase.from('cycle_participants').delete().eq('cycle_id', cycleId!).eq('reviewee_id', revieweeId)),
      onSettled: after,
    }),
    advance: useMutation({
      mutationFn: async () => {
        const { data, error } = await supabase.rpc('advance_cycle', { p_cycle: cycleId! })
        if (error) throw error
        return data as Stage
      },
      onSettled: after,
    }),
    nominate: useMutation({
      mutationFn: async (v: { revieweeId: string; peerId: string }) =>
        check(await supabase.rpc('nominate_peer', { p_cycle: cycleId!, p_reviewee: v.revieweeId, p_peer: v.peerId })),
      onSettled: after,
    }),
    withdraw: useMutation({
      mutationFn: async (nominationId: string) => check(await supabase.rpc('withdraw_nomination', { p_nomination: nominationId })),
      onSettled: after,
    }),
    decide: useMutation({
      mutationFn: async (v: { nominationId: string; approve: boolean }) =>
        check(await supabase.rpc('decide_nomination', { p_nomination: v.nominationId, p_approve: v.approve })),
      onSettled: after,
    }),
  }
}

export const formatDate = (d: string | null, lang: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null

/** People who can be nominated as a peer for `revieweeId`. */
export function eligiblePeers<M extends { id: string; status: string; manager_id: string | null }>(
  members: M[], revieweeId: string, managerId: string | null, taken: Set<string>,
): M[] {
  return members.filter((m) =>
    m.status === 'active' && m.id !== revieweeId && m.id !== managerId && m.manager_id !== revieweeId && !taken.has(m.id))
}
