import { ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Dial, Logo } from '../components/Dial'
import { LanguageSwitch } from '../components/LanguageSwitch'

const LABELS = [
  { key: 'manager', color: 'bg-manager', pos: 'right-0 top-[6%] sm:-right-6' },
  { key: 'peer', color: 'bg-peer', pos: 'right-0 bottom-[6%] sm:-right-6' },
  { key: 'report', color: 'bg-report', pos: 'left-0 bottom-[6%] sm:-left-6' },
  { key: 'self', color: 'bg-self', pos: 'left-0 top-[6%] sm:-left-6' },
] as const

export default function Landing() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const steps = t('landing.steps', { returnObjects: true }) as { title: string; body: string }[]

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <LanguageSwitch />
          <Link
            to={session ? '/app' : '/sign-in'}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-ink/5"
          >
            {session ? t('app.orgSwitcher') : t('landing.signIn')}
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-8 md:grid-cols-[1.1fr_1fr] md:pt-16">
          <div>
            <h1 className="max-w-[14ch] text-[44px] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-[64px]">
              {t('landing.title')}
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-muted">{t('landing.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={session ? '/app' : '/sign-up'} className="rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-hover">
                {t('landing.start')}
              </Link>
              {!session && (
                <Link to="/sign-in" className="rounded-lg border border-line bg-card px-5 py-3 font-semibold hover:border-ink/40">
                  {t('landing.signIn')}
                </Link>
              )}
            </div>
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[380px]">
            <Dial size={380} stroke={30} gap={8} animate className="h-full w-full" />
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <div className="text-[56px] font-extrabold leading-none tracking-tight sm:text-[72px]">360°</div>
              </div>
            </div>
            {LABELS.map((l) => (
              <span
                key={l.key}
                className={`absolute ${l.pos} inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-sm font-semibold shadow-[0_1px_0_var(--color-line)]`}
              >
                <span className={`size-2.5 rounded-full ${l.color}`} aria-hidden />
                {t(`landing.groups.${l.key}`)}
              </span>
            ))}
          </div>
        </section>

        <section className="border-t border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-8">
            <h2 className="text-2xl font-extrabold tracking-tight">{t('landing.how')}</h2>
            <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((s, i) => (
                <li key={s.title} className="border-t-2 border-ink pt-4">
                  <span className="text-sm font-semibold text-muted">{i + 1}</span>
                  <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-10 flex max-w-[60ch] items-start gap-2.5 text-[15px]">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-manager" aria-hidden />
              {t('landing.anonymity')}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
