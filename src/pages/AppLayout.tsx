import clsx from 'clsx'
import { Home, LogOut, Plus, Users } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { Logo } from '../components/Dial'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { PendingInvites } from '../components/PendingInvites'
import { Alert, Spinner } from '../components/ui'
import i18n, { currentLang } from '../i18n'
import { OrgContext } from '../lib/org-context'
import { getCurrentOrgSlug, setCurrentOrgSlug, useMyOrgs, useProfile } from '../lib/orgs'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/app', end: true, icon: Home, label: 'nav.home' },
  { to: '/app/members', end: false, icon: Users, label: 'nav.members' },
] as const

export default function AppLayout() {
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
    <OrgContext.Provider value={{ ...current, isAdmin: current.role === 'admin' }}>
      <div className="min-h-dvh pb-20 sm:pb-0">
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8">
            <Link to="/" aria-label="360 Scoring home"><Logo /></Link>
            <div className="order-last flex w-full items-center gap-2 sm:order-none sm:ml-3 sm:w-auto">
              <label htmlFor="org" className="sr-only">{t('app.orgSwitcher')}</label>
              <select
                id="org"
                value={current.org.slug}
                onChange={(e) => {
                  setCurrentOrgSlug(e.target.value)
                  window.location.assign('/app')
                }}
                className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-1.5 text-sm font-semibold sm:max-w-[240px] sm:flex-none"
              >
                {orgs.map((o) => <option key={o.org.id} value={o.org.slug}>{o.org.name}</option>)}
              </select>
              <Link to="/onboarding" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink" title={t('app.newOrg')}>
                <Plus className="size-4" aria-hidden /><span className="hidden lg:inline">{t('app.newOrg')}</span>
              </Link>
            </div>

            <nav className="hidden items-center gap-1 sm:ml-4 sm:flex" aria-label="Main">
              {NAV.map(({ to, end, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold',
                    isActive ? 'bg-ink text-white' : 'text-muted hover:bg-ink/5 hover:text-ink',
                  )}
                >
                  <Icon className="size-4" aria-hidden />{t(label)}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitch />
              <button
                type="button"
                onClick={() => supabase.auth.signOut()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink"
                title={t('auth.signOut')}
              >
                <LogOut className="size-4" aria-hidden /><span className="hidden lg:inline">{t('auth.signOut')}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
          <PendingInvites className="mb-8" />
          <Outlet />
        </main>

        {/* Bottom tab bar on phones */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-card sm:hidden" aria-label="Main">
          {NAV.map(({ to, end, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-semibold',
                isActive ? 'text-brand' : 'text-muted',
              )}
            >
              <Icon className="size-5" aria-hidden />{t(label)}
            </NavLink>
          ))}
        </nav>
      </div>
    </OrgContext.Provider>
  )
}
