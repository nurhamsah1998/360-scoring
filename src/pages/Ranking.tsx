import clsx from 'clsx'
import { ArrowDown, ArrowLeft, ArrowUp, ChevronRight, Lock, ShieldCheck, TrendingDown, TrendingUp, Trophy, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'
import { GapChip, RankBadge, RankBar, RankLegend, RankRow } from '../components/RankingParts'
import { StageBadge } from '../components/StageStepper'
import { Alert, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { rankBy, useRanking, type Ranked, type ReadyRanking } from '../lib/ranking'
import { fmt } from '../lib/report'

export default function Ranking() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { data, isLoading, error } = useRanking(id)

  if (isLoading) return <Spinner />
  if (data?.scope === 'none') return <Navigate to={`/app/cycles/${id}`} replace />

  return (
    <div className="max-w-5xl">
      <Link to={`/app/cycles/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{t('ranking.back')}
      </Link>
      {error || !data ? (
        <div className="mt-4"><Alert>{(error as Error)?.message}</Alert></div>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-muted">{t('ranking.eyebrow')}</p>
          <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight sm:text-[36px]">{data.cycle.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StageBadge stage={data.cycle.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-2.5 py-1 text-[13px] font-semibold">
              <Users className="size-3.5" aria-hidden />{t(`ranking.scope.${data.scope}`)}
            </span>
          </div>
          {data.available ? <RankingView r={data} /> : <div className="mt-6"><Alert tone="info">{t('ranking.notYet')}</Alert></div>}
        </>
      )}
    </div>
  )
}

type SortKey = 'rank' | 'name' | 'self' | 'gap' | 'raters'

function RankingView({ r }: { r: ReadyRanking }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [basis, setBasis] = useState('overall')
  const { ranked, unranked } = useMemo(() => rankBy(r, basis), [r, basis])
  const overall = basis === 'overall'
  const avg = ranked.length ? ranked.reduce((s, p) => s + p.value, 0) / ranked.length : null
  const top = ranked[0]
  const bottom = ranked[ranked.length - 1]

  // Split into top/bottom only when the two lists can't overlap; otherwise one ordered list.
  const k = Math.min(5, Math.floor(ranked.length / 2))
  const split = ranked.length >= 6

  return (
    <>
      {/* Basis: overall or one skill */}
      <div className="mt-8">
        <p className="text-sm font-semibold text-muted" id="basis-label">{t('ranking.basis')}</p>
        <div role="radiogroup" aria-labelledby="basis-label" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ key: 'overall', name: t('ranking.overall') }, ...r.competencies].map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={basis === c.key} onClick={() => setBasis(c.key)}
              className={clsx(
                'shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors',
                basis === c.key ? 'border-ink bg-ink text-white' : 'border-line bg-card text-ink hover:border-ink/40',
              )}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="mt-6"><Alert tone="info">{t('ranking.empty')}</Alert></div>
      ) : (
        <>
          {/* Headline numbers */}
          <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={t('ranking.statRanked')}>
              <span className="text-[34px] font-extrabold leading-none">{ranked.length}</span>
              <span className="ml-1.5 text-sm font-semibold text-muted">{t('ranking.statRankedOf', { total: r.people.length })}</span>
            </Stat>
            <Stat label={t('ranking.statAvg')}>
              <span className="text-[34px] font-extrabold leading-none">{fmt(avg, lang)}</span>
              <span className="ml-1 text-sm font-semibold text-muted">/ 5</span>
            </Stat>
            <Stat label={t('ranking.statTop')} icon={<TrendingUp className="size-4 text-manager" aria-hidden />}>
              <span className="block truncate text-[17px] font-bold">{top.name}</span>
              <span className="text-[22px] font-extrabold leading-tight">{fmt(top.value, lang)}</span>
            </Stat>
            <Stat label={t('ranking.statBottom')} icon={<TrendingDown className="size-4 text-peer" aria-hidden />}>
              <span className="block truncate text-[17px] font-bold">{bottom.name}</span>
              <span className="text-[22px] font-extrabold leading-tight">{fmt(bottom.value, lang)}</span>
            </Stat>
          </dl>

          <div className="mt-8"><RankLegend showSelf={overall} /></div>

          {/* Top and bottom */}
          {split ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ListCard title={t('ranking.top', { count: k })} icon={<Trophy className="size-5" aria-hidden />} accent="border-t-manager">
                {ranked.slice(0, k).map((p) => <RankRow key={p.id} p={p} cycleId={r.cycle.id} avg={avg} showSelf={overall} />)}
              </ListCard>
              <ListCard title={t('ranking.bottom', { count: k })} icon={<TrendingDown className="size-5" aria-hidden />} accent="border-t-peer">
                {ranked.slice(-k).reverse().map((p) => <RankRow key={p.id} p={p} cycleId={r.cycle.id} avg={avg} showSelf={overall} />)}
              </ListCard>
            </div>
          ) : (
            <div className="mt-4">
              <ListCard title={t('ranking.order')} icon={<Trophy className="size-5" aria-hidden />} accent="border-t-manager">
                {ranked.map((p) => <RankRow key={p.id} p={p} cycleId={r.cycle.id} avg={avg} showSelf={overall} meta />)}
              </ListCard>
            </div>
          )}

          {split && <FullTable ranked={ranked} cycleId={r.cycle.id} avg={avg} overall={overall} />}
        </>
      )}

      {unranked.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-card p-5">
          <h2 className="flex items-center gap-2 font-bold"><Lock className="size-4 text-muted" aria-hidden />{t('ranking.unrankedTitle')}</h2>
          <p className="mt-1 text-[15px] text-muted">{t('ranking.unrankedHelp', { min: r.cycle.min_raters })}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unranked.map((p) => (
              <li key={p.id} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm">
                <span className="font-semibold">{p.name}</span>
                <span className="text-muted"> · {t('ranking.raters', { count: p.raters })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8 space-y-2 text-sm text-muted">
        <p>{t('ranking.how', { min: r.cycle.min_raters })}</p>
        <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-manager" aria-hidden />{t('ranking.private')}</p>
      </div>
    </>
  )
}

function Stat({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card p-4">
      <dt className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">{icon}{label}</dt>
      <dd className="mt-2">{children}</dd>
    </div>
  )
}

function ListCard({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <section className={clsx('min-w-0 rounded-2xl border border-line border-t-4 bg-card p-3 sm:p-4', accent)}>
      <h2 className="flex items-center gap-2 px-2 pb-1 pt-1 text-lg font-bold">{icon}{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  )
}

function FullTable({ ranked, cycleId, avg, overall }: { ranked: Ranked[]; cycleId: string; avg: number | null; overall: boolean }) {
  const { t } = useTranslation()
  const lang = currentLang()
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 })

  const rows = useMemo(() => {
    const v = (p: Ranked): number | string => {
      switch (sort.key) {
        case 'name': return p.name.toLocaleLowerCase()
        case 'self': return p.self ?? -Infinity
        case 'gap': return p.gap ?? -Infinity
        case 'raters': return p.raters
        default: return p.rank
      }
    }
    return [...ranked].sort((a, b) => {
      const x = v(a), y = v(b)
      return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * sort.dir
    })
  }, [ranked, sort])

  const cols: { key: SortKey; label: string; className?: string; show: boolean }[] = [
    { key: 'rank', label: t('ranking.col.rank'), className: 'w-12', show: true },
    { key: 'name', label: t('ranking.col.name'), show: true },
    { key: 'self', label: t('ranking.col.self'), className: 'w-20 text-right', show: overall },
    { key: 'gap', label: t('ranking.col.gap'), className: 'w-36', show: overall },
    { key: 'raters', label: t('ranking.col.raters'), className: 'w-24 text-right', show: true },
  ]
  const head = (c: (typeof cols)[number]) => {
    const active = sort.key === c.key
    return (
      <th key={c.key} scope="col" className={clsx('px-3 py-2.5 font-semibold', c.className)}
        aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? (-s.dir as 1 | -1) : 1 }))}
          className={clsx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')} aria-label={t('ranking.sortBy', { col: c.label })}>
          {c.label}
          {active && (sort.dir === 1 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />)}
        </button>
      </th>
    )
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{t('ranking.all')}</h2>

      {/* Phone: cards */}
      <div className="mt-3 flex flex-col rounded-2xl border border-line bg-card p-2 md:hidden">
        {rows.map((p) => <RankRow key={p.id} p={p} cycleId={cycleId} avg={avg} showSelf={overall} meta />)}
      </div>

      {/* Larger screens: sortable table */}
      <div className="relative mt-3 hidden overflow-hidden rounded-2xl border border-line bg-card md:block">
        <table className="w-full text-left text-[15px]">
          <thead className="border-b border-line text-sm text-muted">
            <tr>
              {head(cols[0])}
              {head(cols[1])}
              <th scope="col" className="w-[34%] px-3 py-2.5 font-semibold">{t('ranking.col.score')}</th>
              {cols.slice(2).filter((c) => c.show).map(head)}
              <th aria-hidden className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="group relative hover:bg-ink/[0.025]">
                <td className="px-3 py-3"><RankBadge rank={p.rank} /></td>
                <td className="max-w-0 px-3 py-3">
                  <Link to={`/app/cycles/${cycleId}/reports/${p.id}`} className="block truncate font-semibold after:absolute after:inset-0 after:content-[''] hover:underline">
                    {p.name}
                  </Link>
                  {p.job_title && <span className="block truncate text-sm text-muted">{p.job_title}</span>}
                </td>
                <td className="px-3 py-3">
                  <span className="flex items-center gap-3">
                    <RankBar value={p.value} self={overall ? p.self : null} avg={avg} className="flex-1" />
                    <span className="w-9 text-right font-extrabold">{fmt(p.value, lang)}</span>
                  </span>
                </td>
                {overall && <td className="px-3 py-3 text-right">{fmt(p.self, lang)}</td>}
                {overall && <td className="px-3 py-3"><GapChip gap={p.gap} /></td>}
                <td className="px-3 py-3 text-right text-muted">{p.raters}</td>
                <td className="pr-3"><ChevronRight className="size-4 text-muted" aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
