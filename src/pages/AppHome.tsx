import { CalendarRange, ListChecks, LogOut, Plus, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { Logo } from '../components/Dial'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { Alert, Spinner } from '../components/ui'
import i18n, { currentLang } from '../i18n'
import { getCurrentOrgSlug, setCurrentOrgSlug, useMyOrgs, useProfile } from '../lib/orgs'
import { supabase } from '../lib/supabase'

const NEXT = [
  { key: 'members', icon: Users, accent: 'border-manager' },
  { key: 'template', icon: ListChecks, accent: 'border-peer' },
  { key: 'cycle', icon: CalendarRange, accent: 'border-report' },
] as const

export default function AppHome() {
  const { t } = useTranslation()
  const { data: orgs, isLoading, error } = useMyOrgs()
  const { data: profile } = useProfile()

  // Apply the language saved on the profile once it loads.
  useEffect(() => {
    if (profile?.locale && profile.locale !== currentLang()) i18n.changeLanguage(profile.locale)
  }, [profile?.locale])

  if (isLoading) return <Spinner fullScreen />
  if (error) return <div className="p-6"><Alert>{(error as Error).message}</Alert></div>
  if (!orgs || orgs.length === 0) return <Navigate to="/onboarding" replace />

  const stored = getCurrentOrgSlug()
  const current = orgs.find((o) => o.org.slug === stored) ?? orgs[0]

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8">
          <Link to="/" aria-label="360 Scoring home"><Logo /></Link>
          <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-4 sm:w-auto">
            <label htmlFor="org" className="sr-only">{t('app.orgSwitcher')}</label>
            <select
              id="org"
              value={current.org.slug}
              onChange={(e) => {
                setCurrentOrgSlug(e.target.value)
                window.location.reload()
              }}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold sm:flex-none"
            >
              {orgs.map((o) => <option key={o.org.id} value={o.org.slug}>{o.org.name}</option>)}
            </select>
            <Link to="/onboarding" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink" title={t('app.newOrg')}>
              <Plus className="size-4" aria-hidden /><span className="hidden sm:inline">{t('app.newOrg')}</span>
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitch />
            <button
              type="button"
              onClick={() => supabase.auth.signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink"
            >
              <LogOut className="size-4" aria-hidden /><span className="hidden sm:inline">{t('auth.signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <p className="text-sm font-semibold text-muted">{t(`app.role.${current.role}`)}</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight tracking-tight">
          {t('app.welcome', { name: profile?.full_name?.split(' ')[0] || '' })}
        </h1>
        <p className="mt-2 text-muted">{t('app.welcomeBody', { org: current.org.name })}</p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {NEXT.map(({ key, icon: Icon, accent }) => (
            <li key={key} className={`rounded-xl border border-line border-t-4 ${accent} bg-card p-5`}>
              <Icon className="size-5 text-muted" aria-hidden />
              <h2 className="mt-3 text-lg font-bold">{t(`app.next.${key}.title`)}</h2>
              <p className="mt-1 text-[15px] text-muted">{t(`app.next.${key}.body`)}</p>
              <p className="mt-4 text-sm font-semibold text-muted">{t('app.soon')}</p>
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
