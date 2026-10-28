import clsx from 'clsx'
import { CalendarRange, CheckCircle2, ChevronRight, ClipboardCheck, FileBarChart, ListChecks, TrendingDown, TrendingUp, Trophy, UserCheck, Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { formatDate } from '../lib/cycles'
import { useOrg } from '../lib/org-context'
import { useProfile } from '../lib/orgs'
import { useMyTasks, type Task } from '../lib/tasks'
import { replayTour } from '../components/WelcomeTour'
import { RankLegend, RankRow } from '../components/RankingParts'
import { useCycles } from '../lib/cycles'
import { rankBy, useRanking } from '../lib/ranking'

const SETUP = [
  { key: 'members', icon: Users, accent: 'border-t-manager', to: '/app/members' },
  { key: 'template', icon: ListChecks, accent: 'border-t-peer', to: '/app/templates' },
  { key: 'cycle', icon: CalendarRange, accent: 'border-t-report', to: '/app/cycles' },
] as const

const TASK_STYLE = {
  nominate: { icon: UsersRound, bar: 'bg-peer' },
  approve: { icon: UserCheck, bar: 'bg-manager' },
  review: { icon: ClipboardCheck, bar: 'bg-report' },
  report: { icon: FileBarChart, bar: 'bg-self' },
} as const

export default function AppHome() {
  const { t } = useTranslation()
  const { org, role, isAdmin, membershipId } = useOrg()
  const { data: profile } = useProfile()
  const { data: tasks, isLoading } = useMyTasks(org.id, membershipId)
  const lang = currentLang()

  const label = (task: Task) =>
    task.kind === 'nominate' ? t('tasks.nominate', { cycle: task.cycle })
      : task.kind === 'approve' ? t('tasks.approve', { count: task.count, cycle: task.cycle })
        : task.kind === 'report' ? t('tasks.report', { cycle: task.cycle })
          : t('tasks.review', { count: task.count, cycle: task.cycle })

  return (
    <>
      <p className="text-sm font-semibold text-muted">{t(`app.role.${role}`)}</p>
      <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight">
        {t('app.welcome', { name: profile?.full_name?.split(' ')[0] || '' })}
      </h1>
      <p className="mt-2 text-muted">{org.name}</p>

      <section className="mt-8">
        <h2 className="text-lg font-bold">{t('tasks.title')}</h2>
        {isLoading ? <div className="mt-4"><Spinner /></div> : !tasks?.length ? (
          <p className="mt-3 flex items-center gap-2 text-muted"><CheckCircle2 className="size-5 text-success" aria-hidden />{t('tasks.none')}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {tasks.map((task) => {
              const S = TASK_STYLE[task.kind]
              return (
                <li key={task.kind + task.cycleId}>
                  <Link to={task.kind === 'review' ? '/app/reviews' : task.kind === 'report' ? `/app/cycles/${task.cycleId}/reports/${task.revieweeId}` : `/app/cycles/${task.cycleId}`} className="flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-card pr-4 hover:border-ink/30">
                    <span className={clsx('w-1.5 self-stretch', S.bar)} aria-hidden />
                    <S.icon className="size-5 shrink-0 text-muted" aria-hidden />
                    <span className="min-w-0 flex-1 py-3.5">
                      <span className="block font-semibold">{label(task)}</span>
                      <span className="block text-sm text-muted">
                        {task.kind === 'nominate' && t('tasks.nominateDetail', { count: task.count, min: task.min })}
                        {task.kind === 'nominate' && task.due && ' · '}
                        {task.due && t('cycles.due', { date: formatDate(task.due, lang) })}
                      </span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <RankingHome orgId={org.id} />

      {isAdmin && (
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {SETUP.map(({ key, icon: Icon, accent, to }) => (
            <li key={key} className={`rounded-xl border border-line border-t-4 ${accent} bg-card`}>
              <Link to={to} className="block h-full rounded-xl p-5 hover:bg-ink/[0.02]">
                <Icon className="size-5 text-muted" aria-hidden />
                <h2 className="mt-3 text-lg font-bold">{t(`app.next.${key}.title`)}</h2>
                <p className="mt-1 text-[15px] text-muted">{t(`app.next.${key}.body`)}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-10 text-sm">
        <button type="button" onClick={replayTour} className="font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">{t('tour.replay')}</button>
      </p>
    </>
  )
}

/** Admins and managers: top and bottom of the most recent closed or released cycle. */
function RankingHome({ orgId }: { orgId: string }) {
  const { t } = useTranslation()
  const { data: cycles } = useCycles(orgId)
  const latest = cycles?.find((c) => c.status === 'closed' || c.status === 'released')
  const { data } = useRanking(latest?.id)
  if (!latest || !data || data.scope === 'none' || !data.available) return null
  const { ranked } = rankBy(data, 'overall')
  if (ranked.length === 0) return null
  const avg = ranked.reduce((s, p) => s + p.value, 0) / ranked.length
  const split = ranked.length >= 6
  const top = split ? ranked.slice(0, 3) : ranked
  const bottom = split ? ranked.slice(-3).reverse() : []

  return (
    <section className="mt-10 rounded-2xl border border-line border-t-4 border-t-brand bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Trophy className="size-5" aria-hidden />{t('ranking.homeTitle')}</h2>
          <p className="mt-0.5 truncate text-sm text-muted">{data.cycle.name} · {t(`ranking.scope.${data.scope}`)}</p>
        </div>
        <Link to={`/app/cycles/${latest.id}/ranking`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {t('ranking.openFull')}<ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-3 px-1"><RankLegend /></div>
      {split ? (
        <div className="mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2">
          <div>
            <p className="flex items-center gap-1.5 px-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted"><TrendingUp className="size-4 text-manager" aria-hidden />{t('ranking.top', { count: 3 })}</p>
            {top.map((p) => <RankRow key={p.id} p={p} cycleId={latest.id} avg={avg} />)}
          </div>
          <div>
            <p className="flex items-center gap-1.5 px-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted"><TrendingDown className="size-4 text-peer" aria-hidden />{t('ranking.bottom', { count: 3 })}</p>
            {bottom.map((p) => <RankRow key={p.id} p={p} cycleId={latest.id} avg={avg} />)}
          </div>
        </div>
      ) : (
        <div className="mt-2">{top.map((p) => <RankRow key={p.id} p={p} cycleId={latest.id} avg={avg} />)}</div>
      )}
    </section>
  )
}
