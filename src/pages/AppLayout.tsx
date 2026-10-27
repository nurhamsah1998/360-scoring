import clsx from 'clsx'
import { CalendarRange, ChevronDown, ClipboardCheck, Home, ListChecks, LogOut, Plus, Sparkles, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DemoBanner } from '../components/Demo'
import { Dial, Logo } from '../components/Dial'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { NotificationBell } from '../components/NotificationBell'
import { PendingInvites } from '../components/PendingInvites'
import { Alert, Spinner } from '../components/ui'
import { replayTour, WelcomeTour } from '../components/WelcomeTour'
import i18n, { currentLang } from '../i18n'
import { demoRoleOf, isDemoEmail } from '../lib/demo'
import { OrgContext } from '../lib/org-context'
import { getCurrentOrgSlug, setCurrentOrgSlug, useMyOrgs, useProfile, type MyOrg } from '../lib/orgs'
import { supabase } from '../lib/supabase'

const NAV = [
  { to: '/app', end: true, icon: Home, label: 'nav.home', admin: false },
  { to: '/app/reviews', end: false, icon: ClipboardCheck, label: 'nav.reviews', admin: false },
  { to: '/app/cycles', end: false, icon: CalendarRange, label: 'nav.cycles', admin: false },
  { to: '/app/members', end: false, icon: Users, label: 'nav.members', admin: false },
  { to: '/app/templates', end: false, icon: ListChecks, label: 'nav.templates', admin: true },
] as const

const initials = (name: string, email: string) =>
  (name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]) : [email[0]]).join('').toUpperCase()

export default function AppLayout() {
  const { t } = useTranslation()
  const { data: orgs, isLoading, error } = useMyOrgs()
  const { data: profile } = useProfile()
  const { session } = useAuth()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const demoUser = isDemoEmail(session?.user.email)

  // Apply the language saved on the profile once it loads.
  useEffect(() => {
    if (profile?.locale && profile.locale !== currentLang()) i18n.changeLanguage(profile.locale)
  }, [profile?.locale])

  // Close the phone menu whenever the route changes.
  useEffect(() => setMenuOpen(false), [location.pathname])

  if (isLoading) return <Spinner fullScreen />
  if (error) return <div className="p-6"><Alert>{(error as Error).message}</Alert></div>
  if (!orgs || orgs.length === 0) return <Navigate to="/onboarding" replace />

  const stored = getCurrentOrgSlug()
  const current = orgs.find((o) => o.org.slug === stored) ?? orgs[0]
  const nav = NAV.filter((n) => !n.admin || current.role === 'admin')
  const switchOrg = (slug: string) => { setCurrentOrgSlug(slug); window.location.assign('/app') }
  const me = initials(profile?.full_name ?? '', session?.user.email ?? '?')

  return (
    <OrgContext.Provider value={{ ...current, isAdmin: current.role === 'admin' }}>
      <div className="min-h-dvh pb-28 md:pb-0">
        <header className="glass-bar sticky top-0 z-20 border-b print:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-8 sm:py-3">
            <Link to="/" aria-label="360 Scoring home" className="shrink-0">
              <span className="md:hidden"><Dial size={28} gap={14} /></span>
              <span className="hidden md:inline"><Logo /></span>
            </Link>

            {/* Organization: a pill on phones, a select on larger screens */}
            <OrgPicker orgs={orgs} current={current} onPick={switchOrg} />
            {!demoUser && (
              <Link to="/onboarding" className="hidden rounded-lg p-1.5 text-muted hover:bg-ink/5 hover:text-ink md:inline-flex" title={t('app.newOrg')}>
                <Plus className="size-4" aria-hidden /><span className="sr-only">{t('app.newOrg')}</span>
              </Link>
            )}

            <nav className="hidden items-center gap-0.5 md:ml-2 md:flex" aria-label="Main">
              {nav.map(({ to, end, icon: Icon, label }) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => clsx(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold',
                    isActive ? 'bg-ink text-white' : 'text-muted hover:bg-ink/5 hover:text-ink',
                  )}>
                  <Icon className="size-4" aria-hidden />{t(label)}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <NotificationBell orgId={current.org.id} />
              <span className="hidden md:inline-flex"><LanguageSwitch /></span>
              <button type="button" onClick={() => supabase.auth.signOut()} title={t('auth.signOut')}
                className="hidden rounded-lg p-2 text-muted hover:bg-ink/5 hover:text-ink md:inline-flex">
                <LogOut className="size-4" aria-hidden /><span className="sr-only">{t('auth.signOut')}</span>
              </button>
              {/* Phone: avatar opens a sheet with language, new org, intro and sign out */}
              <button type="button" onClick={() => setMenuOpen(true)} aria-haspopup="dialog" aria-expanded={menuOpen}
                className="grid size-9 place-items-center rounded-full bg-ink text-xs font-bold text-white md:hidden"
                aria-label={profile?.full_name || session?.user.email || 'Menu'}>
                {me}
              </button>
            </div>
          </div>
        </header>

        {current.org.is_demo && <DemoBanner role={demoRoleOf(session?.user.email)} />}

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
          <PendingInvites className="mb-8 print:hidden" />
          {session && <WelcomeTour key={session.user.id} userId={session.user.id} isAdmin={current.role === 'admin'} />}
          <Outlet />
        </main>

        {/* Phone: floating glass tab bar */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-safe md:hidden print:hidden">
          <nav aria-label="Main" className="glass-float pointer-events-auto mx-auto flex max-w-md items-stretch gap-1 rounded-[22px] p-1.5">
            {nav.map(({ to, end, icon: Icon, label }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => clsx(
                  'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 text-[11px] font-semibold transition-colors',
                  isActive ? 'bg-ink text-white shadow-[0_6px_16px_-8px_rgba(23,32,46,0.8)]' : 'text-muted active:bg-ink/5',
                )}>
                <Icon className="size-5" aria-hidden />
                <span className="w-full truncate text-center">{t(label)}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          name={profile?.full_name ?? ''}
          email={session?.user.email ?? ''}
          initials={me}
          canCreateOrg={!demoUser}
        />
      </div>
    </OrgContext.Provider>
  )
}

function OrgPicker({ orgs, current, onPick }: { orgs: MyOrg[]; current: MyOrg; onPick: (slug: string) => void }) {
  const { t } = useTranslation()
  return (
    <div className="relative min-w-0 flex-1 md:flex-none">
      <label htmlFor="org" className="sr-only">{t('app.orgSwitcher')}</label>
      <select
        id="org"
        value={current.org.slug}
        onChange={(e) => onPick(e.target.value)}
        className="w-full min-w-0 appearance-none truncate rounded-full border border-white/70 bg-white/60 py-1.5 pl-3.5 pr-8 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] md:max-w-[220px] md:rounded-lg md:border-line md:bg-paper/60"
      >
        {orgs.map((o) => <option key={o.org.id} value={o.org.slug}>{o.org.name}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  )
}

/** Bottom sheet for phones: account, language, new organization, intro, sign out. */
function MobileMenu({ open, onClose, name, email, initials: ini, canCreateOrg }: {
  open: boolean; onClose: () => void; name: string; email: string; initials: string; canCreateOrg: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const row = 'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[15px] font-semibold hover:bg-ink/5 active:bg-ink/5'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
      className="mx-auto mb-0 mt-auto w-full max-w-md bg-transparent p-0 backdrop:bg-ink/30 backdrop:backdrop-blur-[2px] md:hidden"
    >
      {open && (
        <div className="glass-float m-3 rounded-3xl p-3 pb-safe [animation:sheet-up_220ms_cubic-bezier(.2,.8,.2,1)]">
          <div className="flex items-center gap-3 px-2 pb-3 pt-1">
            <span className="grid size-11 place-items-center rounded-full bg-ink text-sm font-bold text-white">{ini}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{name || email}</p>
              {name && <p className="truncate text-sm text-muted">{email}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-ink/5" aria-label={t('common.close')}>
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl px-3 py-2.5">
            <span className="text-[15px] font-semibold">{t('lang.label')}</span>
            <LanguageSwitch />
          </div>
          {canCreateOrg && (
            <Link to="/onboarding" className={row}><Plus className="size-5 text-muted" aria-hidden />{t('app.newOrg')}</Link>
          )}
          <button type="button" className={row} onClick={() => { onClose(); replayTour() }}>
            <Sparkles className="size-5 text-muted" aria-hidden />{t('tour.replay')}
          </button>
          <div className="my-1 h-px bg-line" />
          <button type="button" className={clsx(row, 'text-danger')} onClick={() => supabase.auth.signOut()}>
            <LogOut className="size-5" aria-hidden />{t('auth.signOut')}
          </button>
        </div>
      )}
    </dialog>
  )
}
