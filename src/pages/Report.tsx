import clsx from 'clsx'
import { ArrowLeft, ChevronDown, Lock, Printer, TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { RadarChart } from '../components/RadarChart'
import { StageBadge } from '../components/StageStepper'
import { Alert, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { useOrg } from '../lib/org-context'
import { fmt, GROUPS, SERIES_COLOR, useReport, valueOf, type Report as ReportData, type Series } from '../lib/report'

const GAP = 0.5

function Swatch({ s }: { s: Series }) {
  return (
    <svg width="18" height="10" aria-hidden className="shrink-0">
      <line x1="1" y1="5" x2="17" y2="5" stroke={SERIES_COLOR[s]} strokeWidth="2.5" strokeDasharray={s === 'others' ? '4 3' : undefined} strokeLinecap="round" />
      {s !== 'others' && <circle cx="9" cy="5" r="3.5" fill={SERIES_COLOR[s]} stroke="var(--color-card)" strokeWidth="1.5" />}
    </svg>
  )
}

export default function Report() {
  const { t } = useTranslation()
  const { id: cycleId, revieweeId } = useParams()
  const { data, isLoading, error } = useReport(cycleId, revieweeId)

  if (isLoading) return <Spinner />
  if (error || !data) {
    return (
      <div className="max-w-3xl">
        <Link to={`/app/cycles/${cycleId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />{t('report.back')}
        </Link>
        <div className="mt-4"><Alert tone="info">{t('report.notAvailable')} {error ? `(${(error as Error).message})` : ''}</Alert></div>
      </div>
    )
  }
  return <ReportView r={data} />
}

function ReportView({ r }: { r: ReportData }) {
  const { t } = useTranslation()
  const { membershipId } = useOrg()
  const lang = currentLang()
  const isMe = r.reviewee.id === membershipId
  const min = r.cycle.min_raters

  // Series that have data to show, in fixed ring order; "others" last.
  const available = useMemo<Series[]>(() => {
    const s: Series[] = GROUPS.filter((g) => r.groups[g]?.visible && r.overall.by_group[g] != null)
    if (r.others_visible) s.push('others')
    return s
  }, [r])
  const [hidden, setHidden] = useState<Set<Series>>(new Set())
  const shown = available.filter((s) => !hidden.has(s))
  const toggle = (s: Series) => setHidden((h) => { const n = new Set(h); if (n.has(s)) n.delete(s); else n.add(s); return n })

  const selfOverall = r.overall.by_group.self ?? null
  const gaps = r.competencies
    .map((c) => ({ c, self: c.by_group.self ?? null, others: c.others }))
    .filter((g) => g.self != null && g.others != null)
    .map((g) => ({ ...g, diff: (g.self as number) - (g.others as number) }))
  const blind = gaps.filter((g) => g.diff >= GAP).sort((a, b) => b.diff - a.diff)
  const strength = gaps.filter((g) => g.diff <= -GAP).sort((a, b) => a.diff - b.diff)

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link to={`/app/cycles/${r.cycle.id}`} className="mr-auto inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden />{t('report.back')}
        </Link>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-sm font-semibold hover:border-ink/40">
          <Printer className="size-4" aria-hidden />{t('report.print')}
        </button>
      </div>

      <p className="mt-4 text-sm font-semibold text-muted">{t('report.title')}</p>
      <h1 className="mt-1 text-[34px] font-extrabold leading-tight tracking-tight">{r.reviewee.name || r.reviewee.email}</h1>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
        {r.reviewee.job_title && <span>{r.reviewee.job_title}</span>}
        <span>{r.cycle.name}</span>
        <StageBadge stage={r.cycle.status} />
      </div>

      {/* Response counts per group */}
      <section className="mt-6" aria-label={t('report.responses')}>
        <h2 className="sr-only">{t('report.responses')}</h2>
        <ul className="flex flex-wrap gap-2">
          {GROUPS.filter((g) => r.groups[g]).map((g) => {
            const info = r.groups[g]!
            return (
              <li key={g} className={clsx('flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm', !info.visible && 'text-muted')}>
                <span className="size-2.5 rounded-full" style={{ background: SERIES_COLOR[g] }} aria-hidden />
                <span className="font-semibold text-ink">{t(`report.groups.${g}`)}</span>
                <span className="tabular-nums">{t('report.groupCount', { submitted: info.submitted, total: info.total })}</span>
                {!info.visible && info.submitted > 0 && (
                  <span className="inline-flex items-center gap-1" title={t('report.hidden', { min })}>
                    <Lock className="size-3.5" aria-hidden /><span className="text-xs">{t('report.hiddenShort')}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {GROUPS.some((g) => r.groups[g] && !r.groups[g]!.visible && r.groups[g]!.submitted > 0) && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Lock className="size-3.5" aria-hidden />{t('report.hidden', { min })}</p>
        )}
      </section>

      {/* Headline: self vs others */}
      <section className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_1.4fr]">
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted"><Swatch s="self" />{t('report.groups.self')}</p>
          <p className="mt-2 text-[44px] font-extrabold leading-none tabular-nums">{fmt(selfOverall, lang)}</p>
        </div>
        <div className="rounded-xl border border-line bg-card p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted"><Swatch s="others" />{t('report.groups.others')}</p>
          <p className="mt-2 text-[44px] font-extrabold leading-none tabular-nums">{fmt(r.overall.others, lang)}</p>
          {!r.others_visible && <p className="mt-2 text-sm text-muted">{t('report.othersHidden')}</p>}
        </div>
        <div className="flex flex-col justify-center gap-2 text-[15px] text-muted">
          <p className="font-semibold text-ink">{isMe ? t('report.selfVsOthers') : t('report.selfVsOthersOther')}</p>
          <p>{t('report.othersHelp', { min })}</p>
          <p>{t('report.scaleNote')}</p>
        </div>
      </section>

      {/* By skill: chart + table */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight">{t('report.bySkill')}</h2>
        {available.length > 1 && (
          <div role="group" aria-label={t('report.chartToggle')} className="mt-3 flex flex-wrap gap-2 print:hidden">
            {available.map((s) => (
              <button key={s} type="button" aria-pressed={!hidden.has(s)} onClick={() => toggle(s)}
                className={clsx('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold',
                  hidden.has(s) ? 'border-dashed border-line text-muted' : 'border-line bg-card text-ink')}>
                <Swatch s={s} />{t(`report.groups.${s}`)}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-5">
          {r.competencies.length >= 3 && shown.length > 0 && (
            <div className="rounded-xl border border-line bg-card p-3 sm:p-5">
              <RadarChart report={r} series={shown} />
            </div>
          )}
          <ScoreTable r={r} series={shown} />
        </div>
      </section>

      {/* Gaps between self and others */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold tracking-tight">{t('report.gaps')}</h2>
        <p className="mt-1 text-[15px] text-muted">{t('report.gapsHelp')}</p>
        {selfOverall == null ? <p className="mt-3 text-muted">{t('report.needSelf')}</p>
          : !r.others_visible ? <p className="mt-3 text-muted">{t('report.needOthers')}</p>
            : blind.length === 0 && strength.length === 0 ? <p className="mt-3 text-muted">{t('report.noGaps')}</p>
              : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <GapList title={t('report.blindSpot')} help={t('report.blindSpotHelp')} items={blind} icon="down" lang={lang} />
                  <GapList title={t('report.hiddenStrength')} help={t('report.hiddenStrengthHelp')} items={strength} icon="up" lang={lang} />
                </div>
              )}
      </section>

      {/* Comments */}
      <section className="mt-10 pb-10">
        <h2 className="text-xl font-extrabold tracking-tight">{t('report.comments')}</h2>
        {r.comments.length === 0 ? <p className="mt-3 text-muted">{t('report.noComments')}</p> : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {r.competencies.filter((c) => r.comments.some((x) => x.competency_key === c.key)).map((c) => (
              <div key={c.key} className="break-inside-avoid rounded-xl border border-line bg-card p-5">
                <h3 className="font-bold">{c.name}</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {r.comments.filter((x) => x.competency_key === c.key).map((x, i) => (
                    <li key={i} className="border-l-2 pl-3" style={{ borderColor: SERIES_COLOR[x.group] }}>
                      <p className="text-[15px]">{x.body}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted">{t(`report.groups.${x.group}`)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ScoreTable({ r, series }: { r: ReportData; series: Series[] }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="w-full min-w-[420px] text-left text-[15px]">
        <caption className="sr-only">{t('report.table')}</caption>
        <thead className="border-b border-line text-sm text-muted">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t('report.skill')}</th>
            {series.map((s) => (
              <th key={s} scope="col" className="px-2 py-2.5 text-right font-semibold">
                <span className="inline-flex items-center gap-1.5"><Swatch s={s} /><span className="sr-only sm:not-sr-only">{t(`report.groups.${s}`)}</span></span>
              </th>
            ))}
          </tr>
        </thead>
        {r.competencies.map((c) => {
          const isOpen = open === c.key
          return (
            <tbody key={c.key} className="border-b border-line last:border-b-0">
              <tr>
                <th scope="row" className="px-4 py-3 font-semibold">
                  <button type="button" onClick={() => setOpen(isOpen ? null : c.key)} aria-expanded={isOpen}
                    className="inline-flex items-center gap-1.5 text-left hover:text-brand print:pointer-events-none">
                    <ChevronDown className={clsx('size-4 shrink-0 text-muted transition-transform print:hidden', isOpen && 'rotate-180')} aria-hidden />
                    {c.name}
                  </button>
                </th>
                {series.map((s) => <td key={s} className="px-2 py-3 text-right font-semibold tabular-nums">{fmt(valueOf(c, s), lang)}</td>)}
              </tr>
              {isOpen && c.statements.map((st) => (
                <tr key={st.key} className="bg-paper/60 text-sm">
                  <td className="py-2 pl-10 pr-4 text-muted">
                    {st.body}
                    {st.na > 0 && <span className="block text-xs">{t('report.naCount', { count: st.na })}</span>}
                  </td>
                  {series.map((s) => <td key={s} className="px-2 py-2 text-right tabular-nums">{fmt(valueOf(st, s), lang)}</td>)}
                </tr>
              ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

function GapList({ title, help, items, icon, lang }: {
  title: string; help: string; icon: 'up' | 'down'; lang: string
  items: { c: ReportData['competencies'][number]; self: number | null; others: number | null; diff: number }[]
}) {
  const { t } = useTranslation()
  const Icon = icon === 'up' ? TrendingUp : TrendingDown
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <h3 className="flex items-center gap-2 font-bold"><Icon className="size-5 text-muted" aria-hidden />{title}</h3>
      <p className="mt-1 text-sm text-muted">{help}</p>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">—</p> : (
        <ul className="mt-3 flex flex-col divide-y divide-line">
          {items.map((g) => (
            <li key={g.c.key} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2">
              <span className="min-w-0 flex-1 font-semibold">{g.c.name}</span>
              <span className="order-last w-full text-sm tabular-nums text-muted sm:order-none sm:w-auto">
                {t('report.groups.self')} {fmt(g.self, lang)} · {t('report.groups.others')} {fmt(g.others, lang)}
              </span>
              <span className="w-12 text-right text-sm font-bold tabular-nums">{g.diff > 0 ? '+' : '−'}{fmt(Math.abs(g.diff), lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
