import clsx from 'clsx'
import { ChevronRight, FileUp, Search, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MemberDialog, type Notice } from '../components/MemberDialog'
import { Alert, Badge, Button, Spinner } from '../components/ui'
import { displayName, useMembers, type Member } from '../lib/members'
import { useOrg } from '../lib/org-context'

const FILTERS = ['all', 'active', 'invited', 'inactive'] as const
type Filter = (typeof FILTERS)[number]

export default function Members() {
  const { t } = useTranslation()
  const { org, isAdmin } = useOrg()
  const { data: members, isLoading, error } = useMembers(org.id)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<Member | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const byId = useMemo(() => new Map((members ?? []).map((m) => [m.id, m])), [members])
  const reportCount = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of members ?? []) if (m.manager_id && m.status !== 'inactive') c.set(m.manager_id, (c.get(m.manager_id) ?? 0) + 1)
    return c
  }, [members])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, active: 0, invited: 0, inactive: 0 }
    for (const m of members ?? []) { c.all++; c[m.status]++ }
    return c
  }, [members])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (members ?? []).filter((m) =>
      (filter === 'all' || m.status === filter) &&
      (!q || m.full_name.toLowerCase().includes(q) || m.email.includes(q) || m.job_title.toLowerCase().includes(q)),
    )
  }, [members, query, filter])

  const openAdd = () => { setEditing(null); setDialogOpen(true) }
  const openEdit = (m: Member) => { if (!isAdmin) return; setEditing(m); setDialogOpen(true) }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{t('members.title')}</h1>
          <p className="mt-1 text-muted">{t('members.count', { count: counts.all })}</p>
        </div>
        {isAdmin && !org.is_demo && (
          <div className="flex gap-2">
            <Link to="/app/members/import" className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 text-[15px] font-semibold hover:border-ink/40">
              <FileUp className="size-4" aria-hidden />{t('members.import')}
            </Link>
            <Button onClick={openAdd}><UserPlus className="size-4" aria-hidden />{t('members.add')}</Button>
          </div>
        )}
      </div>

      {!isAdmin && <p className="mt-4 text-sm text-muted">{t('members.readOnly')}</p>}
      {isAdmin && org.is_demo && <p className="mt-4 text-sm text-muted">{t('demo.noInvites')}</p>}
      {notice && <div className="mt-5"><Alert tone={notice.tone}>{notice.text}</Alert></div>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.search')}
            aria-label={t('common.search')}
            className="w-full rounded-lg border border-line bg-card py-2 pl-9 pr-3 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <div role="tablist" className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold',
                filter === f ? 'bg-ink text-white' : 'text-muted hover:bg-ink/5 hover:text-ink',
              )}
            >
              {f === 'all' ? t('common.all') : t(`status.${f}`)} <span className="opacity-60">{counts[f]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
        {isLoading && <div className="grid place-items-center p-10"><Spinner /></div>}
        {error && <div className="p-4"><Alert>{(error as Error).message}</Alert></div>}

        {!isLoading && !error && (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_9.5rem_16px] gap-4 border-b border-line px-4 py-2.5 text-sm font-semibold text-muted md:grid">
              <span>{t('members.colName')}</span>
              <span>{t('members.colTitle')}</span>
              <span>{t('members.colManager')}</span>
              <span className="text-right">{t('members.colStatus')}</span>
              <span />
            </div>
            {visible.length === 0 && <p className="p-6 text-center text-muted">{t('members.empty')}</p>}
            <ul>
              {visible.map((m) => {
                const mgr = m.manager_id ? byId.get(m.manager_id) : undefined
                const reports = reportCount.get(m.id) ?? 0
                const Row = isAdmin ? 'button' : 'div'
                return (
                  <li key={m.id} className="border-b border-line last:border-b-0">
                    <Row
                      {...(isAdmin ? { type: 'button' as const, onClick: () => openEdit(m), 'aria-label': t('members.editTitle', { name: displayName(m) }) } : {})}
                      className={clsx(
                        'grid w-full grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3.5 text-left md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.2fr)_9.5rem_16px] md:items-center',
                        isAdmin && 'hover:bg-ink/[0.025]',
                        m.status === 'inactive' && 'opacity-60',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{displayName(m)}</span>
                        <span className="block truncate text-sm text-muted">{m.email}</span>
                      </span>
                      <span className="col-start-1 truncate text-sm md:col-start-auto md:text-[15px]">
                        {m.job_title || <span className="text-muted">—</span>}
                        {reports > 0 && <span className="text-muted"> · {t('members.reports', { count: reports })}</span>}
                      </span>
                      <span className="col-start-1 truncate text-sm text-muted md:col-start-auto md:text-[15px] md:text-ink">
                        <span className="md:hidden">{t('members.colManager')}: </span>
                        {mgr ? displayName(mgr) : <span className="text-muted">{t('members.noManager')}</span>}
                      </span>
                      <span className="col-start-2 row-span-3 row-start-1 flex flex-col items-end gap-1 md:col-start-auto md:row-span-1 md:row-start-auto md:flex-row md:items-center md:justify-end">
                        {m.role === 'admin' && <Badge kind="admin">{t('app.role.admin')}</Badge>}
                        <Badge kind={m.status}>{t(`status.${m.status}`)}</Badge>
                      </span>
                      {isAdmin && <ChevronRight className="hidden size-4 text-muted md:block" aria-hidden />}
                    </Row>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {isAdmin && (
        <MemberDialog
          orgId={org.id}
          members={members ?? []}
          member={editing}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onDone={setNotice}
        />
      )}
    </>
  )
}
