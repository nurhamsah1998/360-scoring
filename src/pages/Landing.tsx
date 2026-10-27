import { ArrowRight, Bell, Briefcase, Check, User, UserRoundCheck, Users, FileSpreadsheet, Languages, LayoutTemplate, Milestone, ShieldCheck, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { DemoPicker } from '../components/Demo'
import { Logo, Mark } from '../components/Dial'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { currentLang } from '../i18n'

const GROUPS = [
  { key: 'manager', color: '#00806A', bg: 'bg-manager', icon: Briefcase },
  { key: 'peer', color: '#C97A1E', bg: 'bg-peer', icon: Users },
  { key: 'report', color: '#4A90E2', bg: 'bg-report', icon: UserRoundCheck },
  { key: 'self', color: '#8B2F9C', bg: 'bg-self', icon: User },
] as const

const FEATURE_ICONS = [ShieldCheck, LayoutTemplate, FileSpreadsheet, Milestone, Bell, Languages]
const STEP_COLORS = ['bg-manager', 'bg-peer', 'bg-report', 'bg-self']

export default function Landing() {
  const { t } = useTranslation()
  const { session } = useAuth()
  const steps = t('landing.steps', { returnObjects: true }) as { title: string; body: string }[]
  const features = t('landing.features', { returnObjects: true }) as { title: string; body: string }[]
  const trust = t('landing.trust', { returnObjects: true }) as string[]
  const startTo = session ? '/app' : '/sign-up'

  return (
    <div className="min-h-dvh">
      {/* ── Hero: dark stage so the colours of the four groups glow ── */}
      <section className="relative isolate overflow-hidden bg-[#0C1524] text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 [background:radial-gradient(520px_420px_at_8%_0%,rgb(139_47_156/0.42),transparent_70%),radial-gradient(520px_420px_at_100%_15%,rgb(74_144_226/0.38),transparent_70%),radial-gradient(640px_420px_at_45%_110%,rgb(0_128_106/0.48),transparent_70%),radial-gradient(400px_320px_at_100%_100%,rgb(201_122_30/0.30),transparent_70%)]" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8 md:py-5">
          <Link to="/" aria-label="360 Scoring"><Logo tone="light" /></Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <Link to={session ? '/app' : '/sign-in'} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10">
              {session ? t('app.orgSwitcher') : t('landing.signIn')}
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-8 sm:px-8 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1.5 pl-2 pr-3.5 text-sm font-semibold">
              <Mark size={20} tone="light" />{t('landing.eyebrow')}
            </p>
            <h1 className="mt-6 text-[46px] font-extrabold leading-[1.0] tracking-[-0.035em] sm:text-[68px]">
              {t('landing.titleA')}<br />
              <span className="relative inline-block text-[#7FE3CC]">
                {t('landing.titleB')}
                <span aria-hidden className="absolute -bottom-2 left-0 flex h-[7px] w-full gap-1.5 sm:-bottom-3">
                  {GROUPS.map((g) => <span key={g.key} className={`flex-1 rounded-full ${g.bg}`} />)}
                </span>
              </span>
            </h1>
            <p className="mt-8 max-w-[46ch] text-lg leading-relaxed text-white/75">{t('landing.lead')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#demo" className="group inline-flex items-center gap-2 rounded-xl bg-[#3FD1B0] px-5 py-3 font-bold text-[#0C1524] shadow-[0_10px_30px_-10px_rgba(63,209,176,0.8)] hover:bg-[#62DDC0]">
                {t('landing.tryDemo')}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </a>
              <Link to={startTo} className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold hover:bg-white/15">
                {t('landing.start')}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/75">
              {trust.map((x) => (
                <li key={x} className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#7FE3CC]" aria-hidden />{x}</li>
              ))}
            </ul>
          </div>

          <HeroPreview />
        </div>
      </section>

      <main>
        {/* ── Four groups ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <h2 className="max-w-[20ch] text-[32px] font-extrabold leading-tight tracking-tight sm:text-[40px]">{t('landing.viewsTitle')}</h2>
          <p className="mt-3 max-w-[60ch] text-lg text-muted">{t('landing.viewsLead')}</p>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((g) => (
              <li key={g.key} className="relative overflow-hidden rounded-2xl border border-line bg-card p-6">
                <span aria-hidden className={`absolute -right-8 -top-8 size-28 rounded-full ${g.bg} opacity-15`} />
                <span className={`grid size-11 place-items-center rounded-xl ${g.bg} text-white`}>
                  <g.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl font-extrabold">{t(`landing.groups.${g.key}`)}</h3>
                <p className="mt-1.5 text-muted">{t(`landing.views.${g.key}`)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ── Demo ── */}
        <section id="demo" className="scroll-mt-6 px-4 sm:px-8">
          <div className="mx-auto max-w-6xl rounded-3xl border border-line bg-card p-6 sm:p-10">
            <DemoPicker />
          </div>
        </section>

        {/* ── How a cycle works ── */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <h2 className="text-[32px] font-extrabold tracking-tight sm:text-[40px]">{t('landing.how')}</h2>
          <ol className="relative mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <span aria-hidden className="absolute left-5 right-5 top-5 hidden h-0.5 bg-line lg:block" />
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <span className={`relative grid size-10 place-items-center rounded-full ${STEP_COLORS[i]} font-extrabold text-white ring-8 ring-paper`}>{i + 1}</span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1.5 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Features ── */}
        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-8">
          <h2 className="text-[32px] font-extrabold tracking-tight sm:text-[40px]">{t('landing.featuresTitle')}</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i] ?? Check
              return (
                <li key={f.title} className={`rounded-2xl border border-line bg-card p-6 flex flex-col`}>
                  <Icon className="size-6 text-brand" aria-hidden />
                  <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                  <p className="mt-1.5 text-muted">{f.body}</p>
                  {i === 0 && <AnonymityVisual />}
                </li>
              )
            })}
          </ul>
        </section>

        {/* ── Closing call to action ── */}
        <section className="px-4 pb-16 sm:px-8">
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[32px] bg-[#0C1524] px-6 py-14 text-white sm:px-14">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-0 [background:radial-gradient(420px_320px_at_100%_0%,rgb(0_128_106/0.55),transparent_70%),radial-gradient(380px_300px_at_10%_110%,rgb(139_47_156/0.45),transparent_70%)]" />
            </div>
            <div className="flex flex-col items-start gap-8 md:flex-row md:items-center">
              <Mark size={96} tone="light" />
              <div className="flex-1">
                <h2 className="text-[30px] font-extrabold leading-tight tracking-tight sm:text-[40px]">{t('landing.ctaTitle')}</h2>
                <p className="mt-2 text-lg text-white/75">{t('landing.ctaBody')}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link to={startTo} className="rounded-xl bg-[#3FD1B0] px-5 py-3 font-bold text-[#0C1524] hover:bg-[#62DDC0]">{t('landing.start')}</Link>
                <a href="#demo" className="rounded-xl border border-white/20 bg-white/10 px-5 py-3 font-semibold hover:bg-white/15">{t('landing.tryDemo')}</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-10 text-sm text-muted sm:px-8">
        <Logo />
        <span>{t('landing.footer')}</span>
      </footer>
    </div>
  )
}

/* Sample values for the illustration only (5 skills × 4 groups). */
const SAMPLE: Record<(typeof GROUPS)[number]['key'], number[]> = {
  manager: [3.9, 3.6, 4.2, 3.7, 4.3],
  peer: [4.1, 3.4, 4.4, 3.5, 4.0],
  report: [3.8, 3.9, 4.1, 3.6, 3.9],
  self: [4.4, 3.8, 4.0, 4.6, 4.1],
}

function HeroPreview() {
  const { t } = useTranslation()
  const p = (k: string) => t(`landing.preview.${k}`)
  const n = (v: number) => v.toLocaleString(currentLang(), { minimumFractionDigits: 1 })
  const skills = t('landing.preview.skills', { returnObjects: true }) as string[]
  const S = 300, C = S / 2, R = 104
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / 5
  const pt = (i: number, v: number) => {
    const r = (R * (v - 1)) / 4
    return [C + Math.cos(ang(i)) * r, C + Math.sin(ang(i)) * r]
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((n) => n.toFixed(1)).join(',')).join(' ')

  return (
    <div className="relative mx-auto w-full max-w-[460px] lg:mr-0">
      <figure className="relative rounded-3xl border border-white/60 bg-white/95 p-5 text-ink shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-6"
        aria-label={p('label')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{p('label')}</p>
            <p className="mt-1 text-lg font-extrabold">{p('who')}</p>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">{p('cycle')}</span>
        </div>

        <svg viewBox={`-74 -6 ${S + 148} ${S + 12}`} className="mx-auto mt-2 block w-full max-w-[400px]" aria-hidden>
          {[2, 3, 4, 5].map((v) => (
            <polygon key={v} points={poly([v, v, v, v, v])} fill="none" stroke="rgba(23,32,46,0.10)" />
          ))}
          {skills.map((_, i) => {
            const [x, y] = pt(i, 5)
            return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(23,32,46,0.10)" />
          })}
          {GROUPS.map((g) => (
            <polygon key={g.key} points={poly(SAMPLE[g.key])} fill={g.color} fillOpacity={0.07} stroke={g.color} strokeWidth={2.25} strokeLinejoin="round" />
          ))}
          {skills.map((s, i) => {
            const [x, y] = pt(i, 5.75)
            const cos = Math.cos(ang(i))
            return (
              <text key={s} x={x} y={y} fontSize={12.5} fontWeight={600} fill="#536074" dominantBaseline="middle"
                textAnchor={Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'}>{s}</text>
            )
          })}
        </svg>

        <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[13px] font-semibold">
          {GROUPS.map((g) => (
            <li key={g.key} className="inline-flex items-center gap-1.5">
              <span className={`size-2.5 rounded-full ${g.bg}`} />{t(`landing.groups.${g.key}`)}
            </li>
          ))}
        </ul>
        <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-line pt-3 text-[13px] font-semibold text-muted sm:justify-end">
          <ShieldCheck className="size-4 text-manager" aria-hidden />{p('anon')}
        </p>
      </figure>

      {/* Floating chips */}
      <div className="absolute -bottom-10 -left-3 hidden rounded-2xl border border-white/60 bg-white/95 p-3 pr-4 text-ink shadow-[0_20px_40px_-18px_rgba(0,0,0,0.55)] [animation:float_6s_ease-in-out_infinite] sm:block sm:-left-10">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.1em] text-muted"><TrendingUp className="size-3.5 text-peer" aria-hidden />{p('gap')}</p>
        <p className="mt-0.5 font-extrabold">{p('gapSkill')} <span className="text-self">{n(4.6)}</span> <span className="text-muted">vs</span> <span className="text-peer">{n(3.5)}</span></p>
        <p className="text-xs text-muted">{p('gapBody')}</p>
      </div>

    </div>
  )
}

/** Three of four peers have answered: the group stays hidden until the threshold is met. */
function AnonymityVisual() {
  return (
    <div aria-hidden className="mt-6 flex flex-1 items-end">
      <div className="w-full rounded-xl bg-paper/80 p-4">
        <div className="flex items-center gap-2">
          {[0, 1, 2].map((i) => <span key={i} className="grid size-8 place-items-center rounded-full bg-peer text-white"><Check className="size-4" /></span>)}
          <span className="size-8 rounded-full border-2 border-dashed border-peer/60" />
          <span className="ml-auto text-sm font-bold tabular-nums text-peer">3 / 3+</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full w-full rounded-full bg-peer" />
        </div>
      </div>
    </div>
  )
}
