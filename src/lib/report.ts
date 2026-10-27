import { useQuery } from '@tanstack/react-query'
import type { Stage } from './cycles'
import { supabase } from './supabase'

export const GROUPS = ['self', 'manager', 'peer', 'direct_report'] as const
export type Group = (typeof GROUPS)[number]
export type Series = Group | 'others'

/** Same order and colours as the 360° ring; text never wears these colours. */
export const SERIES_COLOR: Record<Series, string> = {
  self: 'var(--color-self)',
  manager: 'var(--color-manager)',
  peer: 'var(--color-peer)',
  direct_report: 'var(--color-report)',
  others: 'var(--color-ink)',
}

type Scores = Partial<Record<Group, number>>

export type Report = {
  cycle: { id: string; name: string; status: Stage; min_raters: number }
  reviewee: { id: string; name: string; email: string; job_title: string }
  groups: Partial<Record<Group, { total: number; submitted: number; visible: boolean }>>
  others_n: number
  others_visible: boolean
  overall: { by_group: Scores; others: number | null }
  competencies: {
    key: string
    name: string
    description: string
    by_group: Scores
    others: number | null
    statements: { key: string; body: string; by_group: Scores; others: number | null; na: number }[]
  }[]
  comments: { competency_key: string; group: Group; body: string }[]
}

export function useReport(cycleId: string | undefined, revieweeId: string | undefined) {
  return useQuery({
    queryKey: ['report', cycleId, revieweeId],
    enabled: !!cycleId && !!revieweeId,
    retry: false,
    queryFn: async (): Promise<Report> => {
      const { data, error } = await supabase.rpc('get_report', { p_cycle: cycleId!, p_reviewee: revieweeId! })
      if (error) throw error
      return data as Report
    },
  })
}

/** Value of one series for a row (competency, statement or overall). */
export const valueOf = (row: { by_group: Scores; others: number | null }, s: Series): number | null =>
  s === 'others' ? row.others : (row.by_group[s] ?? null)

export const fmt = (v: number | null | undefined, lang: string) =>
  v == null ? '—' : v.toLocaleString(lang === 'id' ? 'id-ID' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
