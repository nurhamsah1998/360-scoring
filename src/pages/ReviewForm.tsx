import clsx from 'clsx'
import { ArrowLeft, Check, CloudOff, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { formatDate } from '../lib/cycles'
import { displayName, useMembers } from '../lib/members'
import { useOrg } from '../lib/org-context'
import { saveDraft, useReview, useSubmitReview, type ReviewData } from '../lib/reviews'
import { RelTag } from './Reviews'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
const SCORES = [1, 2, 3, 4, 5] as const

export default function ReviewForm() {
  const { id } = useParams()
  const { data, isLoading, error } = useReview(id)
  if (isLoading) return <Spinner />
  if (error) return <Alert>{(error as Error).message}</Alert>
  if (!data) return <Navigate to="/app/reviews" replace />
  return <Form key={data.assignment.id} data={data} />
}

function Form({ data }: { data: ReviewData }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { org } = useOrg()
  const { data: members } = useMembers(org.id)
  const submit = useSubmitReview(org.id)
  const lang = currentLang()
  const { assignment, cycle } = data
  const comps = cycle.snapshot.competencies

  const readOnly = assignment.status !== 'pending' || cycle.status !== 'review'
  const [scores, setScores] = useState<Record<string, number | null>>(data.scores)
  const [comments, setComments] = useState<Record<string, string>>(data.comments)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [err, setErr] = useState<string | null>(null)

  // ── Autosave: collect changed keys, send them after a short pause ──
  const dirty = useRef<{ s: Record<string, number | null>; c: Record<string, string> }>({ s: {}, c: {} })
  const timer = useRef<number | undefined>(undefined)
  const chain = useRef<Promise<void>>(Promise.resolve())

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current)
    const s = dirty.current.s
    const c = dirty.current.c
    if (!Object.keys(s).length && !Object.keys(c).length) return chain.current
    dirty.current = { s: {}, c: {} }
    setSaveState('saving')
    chain.current = chain.current.then(async () => {
      try {
        await saveDraft(assignment.id, s, c)
        setSaveState('saved')
      } catch {
        // Put the unsaved changes back so the next attempt includes them.
        dirty.current = { s: { ...s, ...dirty.current.s }, c: { ...c, ...dirty.current.c } }
        setSaveState('error')
        throw new Error('save_failed')
      }
    }).catch(() => undefined)
    return chain.current
  }, [assignment.id])

  const schedule = (ms: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => { flush() }, ms)
  }

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush() }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      flush()
    }
  }, [flush])

  const setScore = (key: string, v: number | null) => {
    setScores((p) => ({ ...p, [key]: v }))
    dirty.current.s[key] = v
    schedule(600)
  }
  const setComment = (key: string, v: string) => {
    setComments((p) => ({ ...p, [key]: v }))
    dirty.current.c[key] = v
    schedule(1200)
  }

  const total = useMemo(() => comps.reduce((n, c) => n + c.statements.length, 0), [comps])
  const answered = useMemo(
    () => comps.reduce((n, c) => n + c.statements.filter((s) => s.key in scores).length, 0),
    [comps, scores],
  )
  const remaining = total - answered

  const revieweeName = useMemo(() => {
    const m = members?.find((x) => x.id === assignment.reviewee_id)
    return m ? displayName(m) : ''
  }, [members, assignment.reviewee_id])

  const onSubmit = async () => {
    setErr(null)
    await flush()
    if (dirty.current && (Object.keys(dirty.current.s).length || Object.keys(dirty.current.c).length)) {
      setErr(t('reviews.saveFailed'))
      return
    }
    if (!window.confirm(t('reviews.confirmSubmit'))) return
    try {
      await submit.mutateAsync(assignment.id)
      navigate('/app/reviews', { replace: true, state: { submitted: true } })
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const rel = assignment.relationship
  const note = rel === 'self' ? t('reviews.note.self')
    : rel === 'manager' ? t('reviews.note.manager')
      : t('reviews.note.anonymous', { min: cycle.min_raters })

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <Link to="/app/reviews" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{t('reviews.back')}
      </Link>

      <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight">
        {rel === 'self' ? t('reviews.selfTitle') : t('reviews.otherTitle', { name: revieweeName })}
      </h1>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <RelTag rel={rel} />
        <span className="text-sm text-muted">
          {cycle.name}{cycle.review_due && <> · {t('cycles.due', { date: formatDate(cycle.review_due, lang) })}</>}
        </span>
      </div>

      <p className="mt-5 flex max-w-[62ch] items-start gap-2.5 text-[15px]">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-manager" aria-hidden />{note}
      </p>

      {readOnly && (
        <div className="mt-5">
          <Alert tone="info">
            <span className="inline-flex items-center gap-1.5"><Lock className="size-4" aria-hidden />
              {assignment.status === 'submitted' ? t('reviews.readOnly') : t('reviews.readOnlyClosed')}
            </span>
          </Alert>
        </div>
      )}

      <dl className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" aria-label={t('reviews.scaleTitle')}>
        {SCORES.map((n) => (
          <div key={n} className="flex gap-1"><dt className="font-bold text-ink">{n}</dt><dd>{t(`reviews.scale.${n}`)}</dd></div>
        ))}
        <div className="flex gap-1"><dt className="font-bold text-ink">{t('reviews.na')}</dt><dd>{t('reviews.naLong')}</dd></div>
      </dl>

      <ol className="mt-5 flex flex-col gap-5">
        {comps.map((c, ci) => (
          <li key={c.key} className="rounded-xl border border-line bg-card p-4 sm:p-6">
            <h2 className="text-lg font-bold"><span className="mr-2 text-muted">{ci + 1}</span>{c.name}</h2>
            {c.description && <p className="mt-0.5 text-[15px] text-muted">{c.description}</p>}

            <div className="mt-4 flex flex-col divide-y divide-line">
              {c.statements.map((s) => {
                const has = s.key in scores
                const val = scores[s.key]
                return (
                  <fieldset key={s.key} className="py-4 first:pt-1" disabled={readOnly}>
                    <legend className="float-left mb-3 w-full text-[15px] font-medium">{s.body}</legend>
                    <div className="clear-left grid grid-cols-6 gap-1.5 sm:flex sm:gap-2">
                      {SCORES.map((n) => {
                        const on = has && val === n
                        return (
                          <label key={n} title={t(`reviews.scale.${n}`)}
                            className={clsx(
                              'relative grid h-11 cursor-pointer place-items-center rounded-lg border text-[15px] font-bold transition-colors sm:w-12',
                              on ? 'border-brand bg-brand text-white' : 'border-line bg-card hover:border-ink/40',
                              readOnly && 'cursor-default',
                              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                            )}>
                            <input type="radio" name={s.key} value={n} checked={on} onChange={() => setScore(s.key, n)} className="sr-only" />
                            {n}
                            <span className="sr-only"> — {t(`reviews.scale.${n}`)}</span>
                          </label>
                        )
                      })}
                      <label title={t('reviews.naLong')}
                        className={clsx(
                          'relative grid h-11 cursor-pointer place-items-center rounded-lg border text-sm font-semibold transition-colors sm:ml-2 sm:w-14',
                          has && val === null ? 'border-ink bg-ink text-white' : 'border-dashed border-line bg-card text-muted hover:border-ink/40',
                          readOnly && 'cursor-default',
                          'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
                        )}>
                        <input type="radio" name={s.key} value="na" checked={has && val === null} onChange={() => setScore(s.key, null)} className="sr-only" />
                        {t('reviews.na')}
                        <span className="sr-only"> — {t('reviews.naLong')}</span>
                      </label>
                    </div>
                  </fieldset>
                )
              })}
            </div>

            <div className="mt-2 border-t border-line pt-4">
              <label htmlFor={`c-${c.key}`} className="text-sm font-semibold">{t('reviews.comment')} <span className="font-normal text-muted">({t('common.optional')})</span></label>
              <textarea
                id={`c-${c.key}`}
                rows={2}
                maxLength={2000}
                readOnly={readOnly}
                value={comments[c.key] ?? ''}
                onChange={(e) => setComment(c.key, e.target.value)}
                onBlur={() => flush()}
                placeholder={readOnly ? '' : t('reviews.commentPlaceholder')}
                className="mt-1.5 w-full resize-y rounded-lg border border-line bg-paper/60 px-3 py-2 text-[15px] outline-none focus:border-brand focus:bg-card focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </li>
        ))}
      </ol>

      {/* Sticky footer: progress, save status, submit */}
      {!readOnly && (
        <div className="fixed inset-x-0 bottom-[61px] z-20 border-t border-line bg-card/95 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="hidden h-1.5 w-40 overflow-hidden rounded-full bg-line sm:block" aria-hidden>
                  <div className="h-full bg-brand transition-[width]" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
                </div>
                <span className="whitespace-nowrap text-sm font-semibold">{t('reviews.progress', { answered, total })}</span>
              </div>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted" aria-live="polite">
                {saveState === 'saving' && <><Loader2 className="size-3 animate-spin" aria-hidden />{t('reviews.saving')}</>}
                {saveState === 'saved' && <><Check className="size-3 text-success" aria-hidden />{t('reviews.saved')}</>}
                {saveState === 'error' && <span className="inline-flex items-center gap-1 text-danger"><CloudOff className="size-3" aria-hidden />{t('reviews.saveFailed')}</span>}
                {saveState === 'idle' && remaining > 0 && t('reviews.remaining', { count: remaining })}
              </p>
            </div>
            <Button onClick={onSubmit} disabled={remaining > 0} loading={submit.isPending}>{t('reviews.submit')}</Button>
          </div>
          {err && <div className="mx-auto max-w-3xl px-4 pb-3 sm:px-0"><Alert>{err}</Alert></div>}
        </div>
      )}
    </div>
  )
}
