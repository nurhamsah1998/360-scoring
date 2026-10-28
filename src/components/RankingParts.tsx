import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { currentLang } from '../i18n'
import { pct, type Ranked } from '../lib/ranking'
import { fmt } from '../lib/report'

/**
 * One person's score on a 1–5 track: navy bar = score from others, purple dot = self-rating,
 * thin tick = group average. Values are always printed next to it, so nothing relies on colour alone.
 */
export function RankBar({ value, self, avg, className }: { value: number; self?: number | null; avg?: number | null; className?: string }) {
  return (
    <div className={clsx('relative h-2.5 rounded-full bg-ink/[0.07]', className)} aria-hidden>
      <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(value) }} />
      {avg != null && <span className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-ink/45" style={{ left: pct(avg) }} />}
      {self != null && (
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-self ring-2 ring-white" style={{ left: pct(self) }} />
      )}
    </div>
  )
}

export function RankBadge({ rank }: { rank: number }) {
  return (
    <span className={clsx(
      'grid size-8 shrink-0 place-items-center rounded-full text-sm font-extrabold',
      rank <= 3 ? 'bg-ink text-white' : 'border border-line bg-white text-ink',
    )}>
      {rank}
    </span>
  )
}

/** A ranked person as a tappable row: rank, name, score, and the bar underneath. */
export function RankRow({ p, cycleId, avg, showSelf = true, meta }: { p: Ranked; cycleId: string; avg: number | null; showSelf?: boolean; meta?: boolean }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const tip = t('ranking.tooltip', { name: p.name, score: fmt(p.value, lang), self: fmt(p.self, lang), raters: t('ranking.raters', { count: p.raters }) })
  return (
    <Link to={`/app/cycles/${cycleId}/reports/${p.id}`} title={tip}
      className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-ink/[0.03] focus-visible:bg-ink/[0.03]">
      <RankBadge rank={p.rank} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate font-semibold">
            {p.name}
            {p.job_title && <span className="font-normal text-muted"> · {p.job_title}</span>}
          </span>
          <span className="text-lg font-extrabold leading-none">{fmt(p.value, lang)}</span>
        </span>
        <RankBar value={p.value} self={showSelf ? p.self : null} avg={avg} className="mt-2" />
        {meta && (
          <span className="mt-1.5 flex flex-wrap gap-x-3 text-[13px] text-muted">
            {showSelf && p.self != null && <span>{t('ranking.col.self')} {fmt(p.self, lang)}</span>}
            <span>{t('ranking.raters', { count: p.raters })}</span>
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  )
}

export function RankLegend({ showSelf = true }: { showSelf?: boolean }) {
  const { t } = useTranslation()
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] font-semibold text-muted">
      <li className="inline-flex items-center gap-2"><span className="h-2.5 w-6 rounded-full bg-brand" aria-hidden />{t('ranking.legendScore')}</li>
      {showSelf && <li className="inline-flex items-center gap-2"><span className="size-3 rounded-full bg-self ring-2 ring-white" aria-hidden />{t('ranking.legendSelf')}</li>}
      <li className="inline-flex items-center gap-2"><span className="h-4 w-0.5 rounded-full bg-ink/45" aria-hidden />{t('ranking.legendAvg')}</li>
    </ul>
  )
}

/** Self minus others, as a small labelled chip (never colour alone). */
export function GapChip({ gap }: { gap: number | null }) {
  const { t } = useTranslation()
  const lang = currentLang()
  if (gap == null) return <span className="text-muted">—</span>
  const sign = gap > 0 ? '+' : gap < 0 ? '−' : '±'
  const label = gap >= 0.5 ? t('ranking.gapHigh') : gap <= -0.5 ? t('ranking.gapLow') : t('ranking.gapEven')
  const dot = gap >= 0.5 ? 'bg-self' : gap <= -0.5 ? 'bg-manager' : 'bg-ink/30'
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink/[0.05] px-2 py-0.5 text-[13px] font-semibold text-ink" title={label}>
      <span className={clsx('size-2 rounded-full', dot)} aria-hidden />
      {sign}{fmt(Math.abs(gap), lang)}<span className="sr-only"> ({label})</span>
    </span>
  )
}
