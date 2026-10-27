import clsx from 'clsx'
import { CalendarRange, CheckCircle2, ChevronRight, ClipboardCheck, ListChecks, UserCheck, Users, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { formatDate } from '../lib/cycles'
import { useOrg } from '../lib/org-context'
import { useProfile } from '../lib/orgs'
import { useMyTasks, type Task } from '../lib/tasks'

const SETUP = [
  { key: 'members', icon: Users, accent: 'border-t-manager', to: '/app/members' },
  { key: 'template', icon: ListChecks, accent: 'border-t-peer', to: '/app/templates' },
  { key: 'cycle', icon: CalendarRange, accent: 'border-t-report', to: '/app/cycles' },
] as const

const TASK_STYLE = {
  nominate: { icon: UsersRound, bar: 'bg-peer' },
  approve: { icon: UserCheck, bar: 'bg-manager' },
  review: { icon: ClipboardCheck, bar: 'bg-report' },
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
                  <Link to={task.kind === 'review' ? '/app/reviews' : `/app/cycles/${task.cycleId}`} className="flex items-center gap-3 overflow-hidden rounded-xl border border-line bg-card pr-4 hover:border-ink/30">
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
    </>
  )
}
