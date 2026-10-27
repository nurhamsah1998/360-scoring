import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowRight, FlaskConical, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { DEMO_ROLES, signInDemo, type DemoRole } from '../lib/demo'
import { Alert } from './ui'

const ROLE_ACCENT: Record<DemoRole, string> = {
  admin: 'border-t-self',
  manager: 'border-t-manager',
  employee: 'border-t-peer',
}

function useOpenDemo() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<DemoRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const open = async (role: DemoRole) => {
    setBusy(role)
    setError(null)
    try {
      await signInDemo(role)
      qc.clear()
      navigate('/app', { replace: true })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return { open, busy, error }
}

/** Three cards on the landing page, one per point of view. */
export function DemoPicker() {
  const { t } = useTranslation()
  const { open, busy, error } = useOpenDemo()
  return (
    <section aria-labelledby="demo-title">
      <h2 id="demo-title" className="text-2xl font-extrabold tracking-tight">{t('demo.title')}</h2>
      <p className="mt-1 max-w-[60ch] text-muted">{t('demo.body')}</p>
      {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      <ul className="mt-6 grid gap-4 md:grid-cols-3">
        {DEMO_ROLES.map((r) => (
          <li key={r}>
            <button
              type="button"
              onClick={() => open(r)}
              disabled={!!busy}
              className={clsx('group flex h-full w-full flex-col rounded-xl border border-line border-t-4 bg-card p-5 text-left transition-colors hover:border-ink/30 disabled:opacity-70', ROLE_ACCENT[r])}
            >
              <span className="text-sm font-semibold text-muted">{t(`demo.roles.${r}.who`)}</span>
              <span className="mt-1 text-xl font-extrabold">{t(`demo.roles.${r}.label`)}</span>
              <span className="mt-2 flex-1 text-[15px] text-muted">{t(`demo.roles.${r}.what`)}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                {busy === r
                  ? <><Loader2 className="size-4 animate-spin" aria-hidden />{t('demo.opening')}</>
                  : <>{t('demo.go', { role: t(`demo.roles.${r}.label`) })}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden /></>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Strip shown inside the app while browsing the demo organization. */
export function DemoBanner({ role }: { role: DemoRole | null }) {
  const { t } = useTranslation()
  const { open, busy } = useOpenDemo()
  const who = role ? t(`demo.roles.${role}.who`) : ''
  return (
    <div className="border-b border-peer/30 bg-peer/10 print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 text-sm sm:px-8">
        <p className="flex w-full min-w-0 items-start gap-2 md:w-auto md:flex-1">
          <FlaskConical className="mt-0.5 size-4 shrink-0 text-[#8a5212]" aria-hidden />
          <span>{t('demo.banner', { who })}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted">{t('demo.switch')}</span>
          {DEMO_ROLES.filter((r) => r !== role).map((r) => (
            <button key={r} type="button" onClick={() => open(r)} disabled={!!busy}
              className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 font-semibold hover:border-ink/40 disabled:opacity-60">
              {busy === r && <Loader2 className="size-3.5 animate-spin" aria-hidden />}{t(`demo.roles.${r}.label`)}
            </button>
          ))}
          <Link to="/sign-up" className="ml-1 font-semibold text-brand underline-offset-2 hover:underline">{t('demo.own')}</Link>
        </div>
      </div>
    </div>
  )
}
