import { ArrowLeft, ChevronRight, Info, Trash2, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AdminNominationsDialog, ManagerApprovals, MyNominations } from '../components/NominationPanels'
import { StageBadge, StageStepper } from '../components/StageStepper'
import { Alert, Button, Field, SelectField, Spinner } from '../components/ui'
import {
  useAssignments, useCycle, useCycleOps, useNominations, useParticipants,
  type Assignment, type Cycle, type Nomination, type Participant,
} from '../lib/cycles'
import { displayName, useMembers, type Member } from '../lib/members'
import { useOrg } from '../lib/org-context'
import { useTemplates } from '../lib/templates'

export default function CycleDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { org, isAdmin, membershipId } = useOrg()
  const { data: cycle, isLoading, error } = useCycle(id)
  const { data: members } = useMembers(org.id)
  const { data: participants } = useParticipants(id)
  const started = !!cycle && cycle.status !== 'draft'
  const { data: nominations } = useNominations(id, started)
  const { data: assignments } = useAssignments(id, started)

  if (isLoading) return <Spinner />
  if (error) return <Alert>{(error as Error).message}</Alert>
  if (!cycle) return <Navigate to="/app/cycles" replace />

  const common = { cycle, members: members ?? [], participants: participants ?? [], nominations: nominations ?? [] }
  const myPending = (assignments ?? []).filter((a) => a.reviewer_id === membershipId && a.status === 'pending').length

  return (
    <div className="max-w-4xl">
      <Link to="/app/cycles" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{t('cycles.back')}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{cycle.name}</h1>
        <StageBadge stage={cycle.status} />
      </div>
      <div className="mt-5"><StageStepper stage={cycle.status} /></div>

      <div className="mt-8 flex flex-col gap-5">
        {cycle.status === 'nomination' && <MyNominations {...common} meId={membershipId} />}
        {cycle.status === 'nomination' && <ManagerApprovals {...common} meId={membershipId} />}
        {cycle.status === 'review' && myPending > 0 && (
          <Alert tone="info">{t('cycles.myReviews', { count: myPending })} {t('cycles.reviewsSoon')}</Alert>
        )}
        {isAdmin && <AdminSections {...common} assignments={assignments ?? []} />}
      </div>
    </div>
  )
}

type AdminProps = { cycle: Cycle; members: Member[]; participants: Participant[]; nominations: Nomination[]; assignments: Assignment[] }

function AdminSections(props: AdminProps) {
  const { cycle } = props
  return (
    <>
      <NextStep {...props} />
      <Participants {...props} />
      <Settings cycle={cycle} />
    </>
  )
}

function NextStep({ cycle, participants, nominations }: AdminProps) {
  const { t } = useTranslation()
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const [err, setErr] = useState<string | null>(null)
  const s = cycle.status

  const needs: string[] = []
  if (s === 'draft' && !cycle.template_id) needs.push(t('cycles.needs.template'))
  if (s === 'draft' && participants.length === 0) needs.push(t('cycles.needs.participants'))
  const pending = s === 'nomination' ? nominations.filter((n) => n.status === 'pending').length : 0

  const go = async () => {
    const action = t(`cycles.next.${s}.action`)
    if (!window.confirm(t('cycles.confirmAdvance', { action }))) return
    setErr(null)
    try { await ops.advance.mutateAsync() } catch (e) { setErr((e as Error).message) }
  }

  return (
    <section className="rounded-xl border border-ink/80 bg-card p-5">
      <h2 className="text-lg font-bold">{t(`cycles.next.${s}.title`)}</h2>
      <p className="mt-1 max-w-[62ch] text-[15px] text-muted">{t(`cycles.next.${s}.body`)}</p>
      {needs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-[#8a5212]">
          {needs.map((n) => <li key={n} className="flex items-center gap-1.5"><Info className="size-4" aria-hidden />{n}</li>)}
        </ul>
      )}
      {pending > 0 && <p className="mt-3 flex items-center gap-1.5 text-sm text-[#8a5212]"><Info className="size-4" aria-hidden />{t('cycles.pendingWarning', { count: pending })}</p>}
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {s !== 'released' && (
        <Button className="mt-4" onClick={go} loading={ops.advance.isPending} disabled={needs.length > 0}>
          {t(`cycles.next.${s}.action`)}
        </Button>
      )}
    </section>
  )
}

function Participants({ cycle, members, participants, nominations, assignments }: AdminProps) {
  const { t } = useTranslation()
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const [pick, setPick] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [managing, setManaging] = useState<string | null>(null)
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const inCycle = new Set(participants.map((p) => p.reviewee_id))
  const candidates = members.filter((m) => m.status === 'active' && !inCycle.has(m.id))
  const draft = cycle.status === 'draft'

  const act = async (p: Promise<unknown>) => { setErr(null); try { await p } catch (e) { setErr((e as Error).message) } }

  const rows = participants
    .map((p) => ({ p, m: byId.get(p.reviewee_id) }))
    .sort((a, b) => (a.m ? displayName(a.m) : '').localeCompare(b.m ? displayName(b.m) : ''))

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-muted" aria-hidden />{t('cycles.participantsTitle')}
          <span className="text-sm font-semibold text-muted">{participants.length}</span>
        </h2>
        {draft && candidates.length > 0 && (
          <Button variant="outline" className="py-2 text-sm" loading={ops.addParticipants.isPending}
            onClick={() => act(ops.addParticipants.mutateAsync(candidates.map((m) => m.id)))}>
            {t('cycles.addEveryone')}
          </Button>
        )}
      </div>
      <p className="mt-1 text-[15px] text-muted">{t('cycles.participantsHelp')}</p>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}

      {draft && (
        <div className="mt-4 flex gap-2">
          <label className="sr-only" htmlFor="add-participant">{t('cycles.addParticipant')}</label>
          <select id="add-participant" value={pick} onChange={(e) => setPick(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15">
            <option value="">{t('cycles.addParticipant')}</option>
            {candidates.map((m) => <option key={m.id} value={m.id}>{displayName(m)}{m.job_title ? ` — ${m.job_title}` : ''}</option>)}
          </select>
          <Button disabled={!pick} loading={ops.addParticipants.isPending}
            onClick={() => { act(ops.addParticipants.mutateAsync([pick])); setPick('') }}>
            <UserPlus className="size-4" aria-hidden />{t('noms.add')}
          </Button>
        </div>
      )}
      {draft && <p className="mt-2 text-sm text-muted">{t('cycles.onlyActive')}</p>}

      {rows.length === 0 ? (
        <p className="mt-4 text-muted">{t('cycles.noParticipants')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {rows.map(({ p, m }) => {
            const mgrId = draft ? m?.manager_id : p.manager_id
            const mgr = mgrId ? byId.get(mgrId) : undefined
            const noms = nominations.filter((n) => n.reviewee_id === p.reviewee_id)
            const approved = noms.filter((n) => n.status === 'approved').length
            const pendingN = noms.filter((n) => n.status === 'pending').length
            const mine = assignments.filter((a) => a.reviewee_id === p.reviewee_id && a.status !== 'void')
            const done = mine.filter((a) => a.status === 'submitted').length
            return (
              <li key={p.reviewee_id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m ? displayName(m) : '—'}</p>
                  <p className="truncate text-sm text-muted">
                    {t('cycles.manager')}: {mgr ? displayName(mgr) : t('cycles.noManager')}
                    {cycle.status === 'nomination' && <> · {t('cycles.nomsSummary', { approved, pending: pendingN })}</>}
                    {(cycle.status === 'review' || cycle.status === 'closed' || cycle.status === 'released') &&
                      <> · {t('cycles.progress', { done, total: mine.length })}</>}
                  </p>
                </div>
                {draft && (
                  <Button variant="danger" className="self-start px-2.5 py-1.5 text-sm sm:self-auto"
                    onClick={() => act(ops.removeParticipant.mutateAsync(p.reviewee_id))}>
                    {t('cycles.remove')}
                  </Button>
                )}
                {cycle.status === 'nomination' && (
                  <Button variant="outline" className="self-start px-3 py-1.5 text-sm sm:self-auto" onClick={() => setManaging(p.reviewee_id)}>
                    {t('cycles.manageNoms')}<ChevronRight className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <AdminNominationsDialog cycle={cycle} members={members} participants={participants} nominations={nominations}
        revieweeId={managing} onClose={() => setManaging(null)} />
    </section>
  )
}

function Settings({ cycle }: { cycle: Cycle }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: templates } = useTemplates(cycle.org_id)
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const draft = cycle.status === 'draft'
  const [v, setV] = useState(() => toForm(cycle))
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  useEffect(() => setV(toForm(cycle)), [cycle])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setMsg(null)
    try {
      await ops.update.mutateAsync({
        name: v.name.trim(),
        nomination_due: v.nomination_due || null,
        review_due: v.review_due || null,
        ...(draft ? { template_id: v.template_id || null, peer_min: Number(v.peer_min), peer_max: Number(v.peer_max) } : {}),
      })
      setMsg({ tone: 'success', text: t('common.saved') })
    } catch (e2) {
      setMsg({ tone: 'danger', text: (e2 as Error).message })
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="text-lg font-bold">{t('cycles.settings')}</h2>
      {!draft && <p className="mt-1 text-sm text-muted">{t('cycles.settingsLocked')}</p>}
      <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
        {msg && <div className="sm:col-span-2"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
        <Field label={t('cycles.name')} value={v.name} maxLength={80} onChange={(e) => setV({ ...v, name: e.target.value })} className="sm:col-span-2" />
        <SelectField label={t('cycles.template')} value={v.template_id} disabled={!draft} onChange={(e) => setV({ ...v, template_id: e.target.value })} className="sm:col-span-2">
          <option value="">{t('cycles.noTemplate')}</option>
          {templates?.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </SelectField>
        <Field label={t('cycles.nominationDue')} type="date" value={v.nomination_due} onChange={(e) => setV({ ...v, nomination_due: e.target.value })} />
        <Field label={t('cycles.reviewDue')} type="date" value={v.review_due} onChange={(e) => setV({ ...v, review_due: e.target.value })} />
        <Field label={t('cycles.peerMin')} type="number" min={0} max={20} disabled={!draft} value={v.peer_min} onChange={(e) => setV({ ...v, peer_min: e.target.value })} />
        <Field label={t('cycles.peerMax')} type="number" min={1} max={20} disabled={!draft} value={v.peer_max} onChange={(e) => setV({ ...v, peer_max: e.target.value })} />
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="submit" loading={ops.update.isPending} disabled={!v.name.trim()}>{t('common.save')}</Button>
          {draft && (
            <Button type="button" variant="danger" className="ml-auto" loading={ops.remove.isPending}
              onClick={async () => {
                if (!window.confirm(t('cycles.confirmDeleteDraft'))) return
                try { await ops.remove.mutateAsync(); navigate('/app/cycles', { replace: true }) } catch (e2) { setMsg({ tone: 'danger', text: (e2 as Error).message }) }
              }}>
              <Trash2 className="size-4" aria-hidden />{t('cycles.deleteDraft')}
            </Button>
          )}
        </div>
      </form>
    </section>
  )
}

function toForm(c: Cycle) {
  return {
    name: c.name,
    template_id: c.template_id ?? '',
    nomination_due: c.nomination_due ?? '',
    review_due: c.review_due ?? '',
    peer_min: String(c.peer_min),
    peer_max: String(c.peer_max),
  }
}
