import clsx from 'clsx'
import { ClipboardCheck, FileBarChart, ListChecks, ShieldCheck, Workflow, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dial } from './Dial'
import { Button } from './ui'

/**
 * First-run welcome tour. "Seen" is remembered per account in localStorage, so it shows again
 * for a different account on the same browser, or after the browser's site data is cleared.
 */
const KEY = (userId: string) => `tour.v1.seen.${userId}`

export const tourSeen = (userId: string) => {
  try { return localStorage.getItem(KEY(userId)) === '1' } catch { return true } // storage blocked: don't nag
}
const markSeen = (userId: string) => {
  try { localStorage.setItem(KEY(userId), '1') } catch { /* storage unavailable */ }
}
export const resetTour = (userId: string) => {
  try { localStorage.removeItem(KEY(userId)) } catch { /* storage unavailable */ }
}

type Slide = { key: string; icon: LucideIcon | null; accent: string }

const ALL: (Slide & { adminOnly?: boolean })[] = [
  { key: 'welcome', icon: null, accent: 'bg-ink' },
  { key: 'setup', icon: ListChecks, accent: 'bg-self', adminOnly: true },
  { key: 'cycle', icon: Workflow, accent: 'bg-report' },
  { key: 'nominate', icon: ClipboardCheck, accent: 'bg-peer' },
  { key: 'anonymous', icon: ShieldCheck, accent: 'bg-manager' },
  { key: 'report', icon: FileBarChart, accent: 'bg-self' },
]

export function WelcomeTour({ userId, isAdmin, forceOpen = false, onClose }: {
  userId: string; isAdmin: boolean; forceOpen?: boolean; onClose?: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(() => forceOpen || !tourSeen(userId))
  const [i, setI] = useState(0)
  const ref = useRef<HTMLDialogElement>(null)
  const slides = ALL.filter((s) => !s.adminOnly || isAdmin)
  const s = slides[i]
  const last = i === slides.length - 1

  useEffect(() => { if (forceOpen) { setI(0); setOpen(true) } }, [forceOpen])

  // "Show the intro again" anywhere in the app dispatches this event.
  useEffect(() => {
    const replay = () => { setI(0); setOpen(true) }
    window.addEventListener('tour:replay', replay)
    return () => window.removeEventListener('tour:replay', replay)
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const finish = () => {
    if (!open) return
    markSeen(userId)
    setOpen(false)
    onClose?.()
  }

  const Icon = s.icon

  return (
    <dialog
      ref={ref}
      onClose={finish}
      aria-label={t('tour.label')}
      className="m-auto w-[min(440px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-line bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(23,32,46,0.45)] backdrop:bg-ink/50"
    >
      {open && (
        <div className="flex flex-col">
          {/* Illustration band */}
          <div className="relative grid h-40 place-items-center bg-paper">
            {Icon ? (
              <span className={clsx('grid size-20 place-items-center rounded-2xl text-white', s.accent)}>
                <Icon className="size-10" aria-hidden />
              </span>
            ) : (
              <Dial size={104} stroke={14} gap={10} animate />
            )}
            <button type="button" onClick={finish}
              className="absolute right-3 top-3 rounded-md px-2 py-1 text-sm font-semibold text-muted hover:bg-ink/5 hover:text-ink">
              {t('tour.skip')}
            </button>
          </div>

          <div className="px-6 pb-6 pt-5" aria-live="polite">
            <p className="text-sm font-semibold text-muted">{t('tour.step', { n: i + 1, total: slides.length })}</p>
            <h2 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">{t(`tour.slides.${s.key}.title`)}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{t(`tour.slides.${s.key}.body`)}</p>

            <div className="mt-6 flex items-center gap-3">
              <div className="mr-auto flex gap-1.5" aria-hidden>
                {slides.map((_, k) => (
                  <span key={k} className={clsx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-ink' : 'w-1.5 bg-line')} />
                ))}
              </div>
              {i > 0 && <Button variant="ghost" onClick={() => setI(i - 1)}>{t('tour.back')}</Button>}
              <Button onClick={() => (last ? finish() : setI(i + 1))} autoFocus>
                {last ? t('tour.done') : t('tour.next')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}

export const replayTour = () => window.dispatchEvent(new Event('tour:replay'))
