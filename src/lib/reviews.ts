import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Assignment, Stage } from './cycles'
import { supabase } from './supabase'

export type SnapshotStatement = { key: string; body: string }
export type SnapshotCompetency = { key: string; name: string; description: string; statements: SnapshotStatement[] }
export type Snapshot = { name: string; competencies: SnapshotCompetency[] }

export type MyReview = Pick<Assignment, 'id' | 'reviewee_id' | 'relationship' | 'status'> & {
  submitted_at: string | null
  answered: number
  total: number
  cycle: { id: string; name: string; status: Stage; review_due: string | null; min_raters: number }
}

export const statementCount = (s: Snapshot | null | undefined) =>
  (s?.competencies ?? []).reduce((n, c) => n + c.statements.length, 0)

export function useMyReviews(orgId: string, meId: string) {
  return useQuery({
    queryKey: ['my-reviews', orgId, meId],
    queryFn: async (): Promise<MyReview[]> => {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, reviewee_id, relationship, status, submitted_at, responses(count), cycles!inner(id, name, status, review_due, min_raters, org_id, template_snapshot)')
        .eq('reviewer_id', meId)
        .eq('cycles.org_id', orgId)
        .in('cycles.status', ['review', 'closed', 'released'])
        .neq('status', 'void')
      if (error) throw error
      return (data ?? []).map((r) => {
        const c = r.cycles as unknown as MyReview['cycle'] & { template_snapshot: Snapshot }
        return {
          id: r.id,
          reviewee_id: r.reviewee_id,
          relationship: r.relationship,
          status: r.status,
          submitted_at: r.submitted_at,
          answered: (r.responses as unknown as { count: number }[])[0]?.count ?? 0,
          total: statementCount(c.template_snapshot),
          cycle: { id: c.id, name: c.name, status: c.status, review_due: c.review_due, min_raters: c.min_raters },
        } as MyReview
      })
    },
  })
}

export type ReviewData = {
  assignment: Pick<Assignment, 'id' | 'reviewee_id' | 'reviewer_id' | 'relationship' | 'status'>
  cycle: { id: string; name: string; status: Stage; review_due: string | null; min_raters: number; snapshot: Snapshot }
  scores: Record<string, number | null> // statement key → score (null = N/A); absent = unanswered
  comments: Record<string, string>
}

export function useReview(assignmentId: string | undefined) {
  return useQuery({
    queryKey: ['review', assignmentId],
    enabled: !!assignmentId,
    staleTime: Infinity, // the form owns its state once loaded
    queryFn: async (): Promise<ReviewData | null> => {
      const { data: a, error } = await supabase
        .from('assignments')
        .select('id, reviewee_id, reviewer_id, relationship, status, cycles!inner(id, name, status, review_due, min_raters, template_snapshot)')
        .eq('id', assignmentId!)
        .maybeSingle()
      if (error) throw error
      if (!a) return null
      const [resp, com] = await Promise.all([
        supabase.from('responses').select('statement_key, score').eq('assignment_id', assignmentId!),
        supabase.from('comments').select('competency_key, body').eq('assignment_id', assignmentId!),
      ])
      if (resp.error) throw resp.error
      if (com.error) throw com.error
      const c = a.cycles as unknown as Omit<ReviewData['cycle'], 'snapshot'> & { template_snapshot: Snapshot }
      return {
        assignment: { id: a.id, reviewee_id: a.reviewee_id, reviewer_id: a.reviewer_id, relationship: a.relationship, status: a.status },
        cycle: { id: c.id, name: c.name, status: c.status, review_due: c.review_due, min_raters: c.min_raters, snapshot: c.template_snapshot },
        scores: Object.fromEntries((resp.data ?? []).map((r) => [r.statement_key, r.score])),
        comments: Object.fromEntries((com.data ?? []).map((r) => [r.competency_key, r.body])),
      }
    },
  })
}

export async function saveDraft(assignmentId: string, scores: Record<string, number | null>, comments: Record<string, string>) {
  const { error } = await supabase.rpc('save_review_draft', { p_assignment: assignmentId, p_scores: scores, p_comments: comments })
  if (error) throw error
}

export function useSubmitReview(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.rpc('submit_review', { p_assignment: assignmentId })
      if (error) throw error
    },
    onSettled: (_d, _e, id) => {
      qc.invalidateQueries({ queryKey: ['my-reviews'] })
      qc.invalidateQueries({ queryKey: ['review', id] })
      qc.invalidateQueries({ queryKey: ['tasks', orgId] })
      qc.invalidateQueries({ queryKey: ['assignments'] })
    },
  })
}
