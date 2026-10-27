import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Task =
  | { kind: 'nominate'; cycleId: string; cycle: string; count: number; min: number; due: string | null }
  | { kind: 'approve'; cycleId: string; cycle: string; count: number; due: string | null }
  | { kind: 'review'; cycleId: string; cycle: string; count: number; due: string | null }
  | { kind: 'report'; cycleId: string; cycle: string; revieweeId: string; due: null }

/** What the signed-in member should do next across running cycles (one RPC, computed in Postgres). */
export function useMyTasks(orgId: string, meId: string) {
  return useQuery({
    queryKey: ['tasks', orgId, meId],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase.rpc('my_tasks', { p_org: orgId })
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })
}
