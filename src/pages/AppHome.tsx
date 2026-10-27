import { CalendarRange, ListChecks, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useOrg } from '../lib/org-context'
import { useProfile } from '../lib/orgs'

const NEXT = [
  { key: 'members', icon: Users, accent: 'border-t-manager', to: '/app/members' },
  { key: 'template', icon: ListChecks, accent: 'border-t-peer', to: null },
  { key: 'cycle', icon: CalendarRange, accent: 'border-t-report', to: null },
] as const

export default function AppHome() {
  const { t } = useTranslation()
  const { org, role } = useOrg()
  const { data: profile } = useProfile()

  return (
    <>
      <p className="text-sm font-semibold text-muted">{t(`app.role.${role}`)}</p>
      <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight">
        {t('app.welcome', { name: profile?.full_name?.split(' ')[0] || '' })}
      </h1>
      <p className="mt-2 text-muted">{t('app.welcomeBody', { org: org.name })}</p>

      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {NEXT.map(({ key, icon: Icon, accent, to }) => {
          const inner = (
            <>
              <Icon className="size-5 text-muted" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">{t(`app.next.${key}.title`)}</h2>
              <p className="mt-1 text-[15px] text-muted">{t(`app.next.${key}.body`)}</p>
              {!to && <p className="mt-4 text-sm font-semibold text-muted">{t('app.soon')}</p>}
            </>
          )
          return (
            <li key={key} className={`rounded-xl border border-line border-t-4 ${accent} bg-card`}>
              {to ? (
                <Link to={to} className="block h-full rounded-xl p-5 hover:bg-ink/[0.02]">{inner}</Link>
              ) : (
                <div className="p-5">{inner}</div>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}
