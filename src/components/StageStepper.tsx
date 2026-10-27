import clsx from 'clsx'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { STAGES, type Stage } from '../lib/cycles'

export function StageBadge({ stage }: { stage: Stage }) {
  const { t } = useTranslation()
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        stage === 'draft' && 'bg-ink/8 text-muted',
        stage === 'nomination' && 'bg-peer/12 text-[#8a5212]',
        stage === 'review' && 'bg-report/10 text-report',
        stage === 'closed' && 'bg-self/10 text-self',
        stage === 'released' && 'bg-success/10 text-success',
      )}
    >
      {t(`stage.${stage}`)}
    </span>
  )
}

/** The five stages of a cycle as a horizontal track; wraps to a compact list on phones. */
export function StageStepper({ stage }: { stage: Stage }) {
  const { t } = useTranslation()
  const current = STAGES.indexOf(stage)
  return (
    <ol className="grid grid-cols-5 gap-1.5" aria-label={t('cycles.title')}>
      {STAGES.map((s, i) => {
        const done = i < current || stage === 'released'
        const active = i === current && stage !== 'released'
        return (
          <li key={s} className="min-w-0" aria-current={active ? 'step' : undefined}>
            <div className={clsx('h-1.5 rounded-full', done ? 'bg-ink' : active ? 'bg-brand' : 'bg-line')} />
            <div className={clsx('mt-2 flex items-center gap-1 truncate text-xs font-semibold sm:text-sm', active ? 'text-ink' : done ? 'text-ink/70' : 'text-muted')}>
              {done && <Check className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{t(`stage.${s}`)}</span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
