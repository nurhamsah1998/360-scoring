import clsx from 'clsx'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Alert, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { formatDate } from '../lib/cycles'
import { displayName, useMembers } from '../lib/members'
import { useOrg } from '../lib/org-context'
import { useMyReviews, type MyReview } from '../lib/reviews'

export const REL_COLOR = {
  self: 'bg-self',
  manager: 'bg-manager',
  peer: 'bg-peer',
  direct_report: 'bg-report',
} as const

export function RelTag({ rel }: { rel: MyReview['relationship'] }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span className={clsx('size-2 rounded-full', REL_COLOR[rel])} aria-hidden />
      {t(`reviews.rel.${rel}`)}
    </span>
  )
}

export default function Reviews() {
  const { t } = useTranslation()
  const { org, membershipId } = useOrg()
  const { data: reviews, isLoading, error } = useMyReviews(org.id, membershipId)
  const { data: members } = useMembers(org.id)
  const location = useLocation()
  const notice = (location.state as { submitted?: boolean } | null)?.submitted
  const lang = currentLang()
  const byId = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])

  const todo = (reviews ?? []).filter((r) => r.status === 'pending' && r.cycle.status === 'review')
  const done = (reviews ?? []).filter((r) => r.status === 'submitted')

  const name = (r: MyReview) => {
    if (r.relationship === 'self') return t('reviews.you')
    const m = byId.get(r.reviewee_id)
    return m ? displayName(m) : '—'
  }

  const Row = ({ r }: { r: MyReview }) => {
    const pct = r.total ? Math.round((r.answered / r.total) * 100) : 0
    const submitted = r.status === 'submitted'
    return (
      <li className="border-b border-line last:border-b-0">
        <Link to={`/app/reviews/${r.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-ink/[0.025]">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{name(r)}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <RelTag rel={r.relationship} />
              <span className="text-sm text-muted">{r.cycle.name}</span>
            </div>
            {!submitted && (
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted">{t('reviews.progress', { answered: r.answered, total: r.total })}</span>
              </div>
            )}
            {submitted && r.submitted_at && (
              <p className="mt-1 flex items-center gap-1 text-sm text-success">
                <CheckCircle2 className="size-4" aria-hidden />{t('reviews.submittedOn', { date: formatDate(r.submitted_at.slice(0, 10), lang) })}
              </p>
            )}
          </div>
          <span className="hidden text-sm font-semibold text-brand sm:inline">
            {submitted ? t('reviews.view') : r.answered ? t('reviews.continue') : t('reviews.start')}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
        </Link>
      </li>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{t('reviews.title')}</h1>
      <p className="mt-1 max-w-[62ch] text-muted">{t('reviews.body')}</p>
      {notice && <div className="mt-5"><Alert tone="success">{t('reviews.submitted')}</Alert></div>}
      {error && <div className="mt-5"><Alert>{(error as Error).message}</Alert></div>}
      {isLoading && <div className="mt-8"><Spinner /></div>}

      {reviews && todo.length === 0 && done.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">{t('reviews.empty')}</p>
      )}

      {todo.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">{t('reviews.todo')} <span className="text-muted">{todo.length}</span></h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-line bg-card">{todo.map((r) => <Row key={r.id} r={r} />)}</ul>
        </section>
      )}
      {done.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold">{t('reviews.done')} <span className="text-muted">{done.length}</span></h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-line bg-card">{done.map((r) => <Row key={r.id} r={r} />)}</ul>
        </section>
      )}
    </div>
  )
}
