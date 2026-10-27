import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Task =
  | { kind: 'nominate'; cycleId: string; cycle: string; count: number; min: number; due: string | null }
  | { kind: 'approve'; cycleId: string; cycle: string; count: number; due: string | null }
  | { kind: 'review'; cycleId: string; cycle: string; count: number; due: string | null }

/** What the signed-in member should do next across running cycles. */
export function useMyTasks(orgId: string, meId: string) {
  return useQuery({
    queryKey: ['tasks', orgId, meId],
    queryFn: async (): Promise<Task[]> => {
      const { data: cycles, error } = await supabase
        .from('cycles')
        .select('id, name, status, peer_min, nomination_due, review_due')
        .eq('org_id', orgId)
        .in('status', ['nomination', 'review'])
      if (error) throw error
      if (!cycles?.length) return []
      const ids = cycles.map((c) => c.id)

      const [mine, managed, noms, asg] = await Promise.all([
        supabase.from('cycle_participants').select('cycle_id').in('cycle_id', ids).eq('reviewee_id', meId),
        supabase.from('cycle_participants').select('cycle_id, reviewee_id').in('cycle_id', ids).eq('manager_id', meId),
        supabase.from('nominations').select('cycle_id, reviewee_id, status').in('cycle_id', ids),
        supabase.from('assignments').select('cycle_id').in('cycle_id', ids).eq('reviewer_id', meId).eq('status', 'pending'),
      ])
      for (const r of [mine, managed, noms, asg]) if (r.error) throw r.error

      const tasks: Task[] = []
      for (const c of cycles) {
        if (c.status === 'nomination') {
          if (mine.data!.some((p) => p.cycle_id === c.id)) {
            const count = noms.data!.filter((n) => n.cycle_id === c.id && n.reviewee_id === meId && (n.status === 'pending' || n.status === 'approved')).length
            if (count < c.peer_min) tasks.push({ kind: 'nominate', cycleId: c.id, cycle: c.name, count, min: c.peer_min, due: c.nomination_due })
          }
          const reports = new Set(managed.data!.filter((p) => p.cycle_id === c.id).map((p) => p.reviewee_id))
          const waiting = noms.data!.filter((n) => n.cycle_id === c.id && n.status === 'pending' && reports.has(n.reviewee_id)).length
          if (waiting > 0) tasks.push({ kind: 'approve', cycleId: c.id, cycle: c.name, count: waiting, due: c.nomination_due })
        } else {
          const count = asg.data!.filter((a) => a.cycle_id === c.id).length
          if (count > 0) tasks.push({ kind: 'review', cycleId: c.id, cycle: c.name, count, due: c.review_due })
        }
      }
      return tasks
    },
  })
}
