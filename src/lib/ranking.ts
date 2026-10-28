import { useQuery } from '@tanstack/react-query'
import type { Stage } from './cycles'
import { supabase } from './supabase'

export type RankPerson = {
  id: string
  name: string
  job_title: string
  raters: number
  /** Average from everyone except the person; null when too few raters to show. */
  score: number | null
  self: number | null
  by_comp: Record<string, number>
}

export type Ranking =
  | { scope: 'none' }
  | {
      scope: 'org' | 'team'
      available: false
      cycle: { id: string; name: string; status: Stage; min_raters: number }
    }
  | {
      scope: 'org' | 'team'
      available: true
      cycle: { id: string; name: string; status: Stage; min_raters: number }
      competencies: { key: string; name: string }[]
      people: RankPerson[]
    }

export type ReadyRanking = Extract<Ranking, { available: true }>

/** Admins: the whole cycle. Managers: their own reports. Everyone else: scope "none". */
export function useRanking(cycleId: string | undefined) {
  return useQuery({
    queryKey: ['ranking', cycleId],
    enabled: !!cycleId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('cycle_ranking', { p_cycle: cycleId! })
      if (error) throw error
      return data as Ranking
    },
  })
}

export type Ranked = RankPerson & { value: number; rank: number; gap: number | null }

/**
 * People with a score for the chosen basis ("overall" or a competency key), best first.
 * Ties share a rank (1, 2, 2, 4).
 */
export function rankBy(r: ReadyRanking, basis: string): { ranked: Ranked[]; unranked: RankPerson[] } {
  const val = (p: RankPerson) => (basis === 'overall' ? p.score : (p.by_comp[basis] ?? null))
  const withValue = r.people
    .map((p) => ({ p, v: val(p) }))
    .filter((x): x is { p: RankPerson; v: number } => x.v != null)
    .sort((a, b) => b.v - a.v || a.p.name.localeCompare(b.p.name))
  let prev: number | null = null
  let prevRank = 0
  const ranked = withValue.map(({ p, v }, i) => {
    const rank = v === prev ? prevRank : i + 1
    prev = v
    prevRank = rank
    const gap = basis === 'overall' && p.self != null && p.score != null ? p.self - p.score : null
    return { ...p, value: v, rank, gap }
  })
  const ids = new Set(ranked.map((x) => x.id))
  return { ranked, unranked: r.people.filter((p) => !ids.has(p.id)) }
}

/** Position of a 1–5 score on a 0–100% track. */
export const pct = (v: number) => `${Math.max(0, Math.min(100, ((v - 1) / 4) * 100))}%`
