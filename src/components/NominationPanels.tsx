import clsx from 'clsx'
import { Check, Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { eligiblePeers, useCycleOps, type Cycle, type Nomination, type NominationStatus, type Participant } from '../lib/cycles'
import { displayName, type Member } from '../lib/members'
import { Alert, Button, Dialog } from './ui'

const LIVE: NominationStatus[] = ['pending', 'approved']

export function NomStatus({ status }: { status: NominationStatus }) {
  const { t } = useTranslation()
  return (
    <span className={clsx(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
      status === 'pending' && 'bg-peer/12 text-[#8a5212]',
      status === 'approved' && 'bg-success/10 text-success',
      status === 'rejected' && 'bg-danger/10 text-danger',
      status === 'withdrawn' && 'bg-ink/8 text-muted',
    )}>
      {t(`noms.status.${status}`)}
    </span>
  )
}

function PeerPicker({ options, onAdd, busy, label }: { options: Member[]; onAdd: (id: string) => void; busy: boolean; label: string }) {
  const { t } = useTranslation()
  const [peer, setPeer] = useState('')
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="peer-pick">{label}</label>
      <select
        id="peer-pick"
        value={peer}
        onChange={(e) => setPeer(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        <option value="">{label}</option>
        {options.map((m) => <option key={m.id} value={m.id}>{displayName(m)}{m.job_title ? ` — ${m.job_title}` : ''}</option>)}
      </select>
      <Button onClick={() => { if (peer) { onAdd(peer); setPeer('') } }} disabled={!peer} loading={busy}>
        <Plus className="size-4" aria-hidden />{t('noms.add')}
      </Button>
    </div>
  )
}

type Common = { cycle: Cycle; members: Member[]; participants: Participant[]; nominations: Nomination[] }

/** The signed-in participant chooses their peer reviewers. */
export function MyNominations({ cycle, members, participants, nominations, meId }: Common & { meId: string }) {
  const { t } = useTranslation()
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const [err, setErr] = useState<string | null>(null)
  const me = participants.find((p) => p.reviewee_id === meId)
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  if (!me) return null
  const mine = nominations.filter((n) => n.reviewee_id === meId && n.status !== 'withdrawn')
  const live = mine.filter((n) => LIVE.includes(n.status))
  const taken = new Set(live.map((n) => n.peer_id))
  const options = eligiblePeers(members, meId, me.manager_id, taken)
  const open = cycle.status === 'nomination'

  const act = async (p: Promise<unknown>) => { setErr(null); try { await p } catch (e) { setErr((e as Error).message) } }

  return (
    <section className="rounded-xl border border-line border-t-4 border-t-peer bg-card p-5">
      <h2 className="text-lg font-bold">{t('noms.mineTitle')}</h2>
      <p className="mt-1 max-w-[62ch] text-[15px] text-muted">
        {me.manager_id
          ? t('noms.mineHelp', { min: cycle.peer_min, max: cycle.peer_max })
          : t('noms.mineHelpNoManager', { min: cycle.peer_min, max: cycle.peer_max })}
      </p>
      <p className={clsx('mt-3 text-sm font-semibold', live.length < cycle.peer_min ? 'text-[#8a5212]' : 'text-success')}>
        {t('noms.count', { count: live.length, max: cycle.peer_max })}
        {live.length < cycle.peer_min && <> · {t('noms.belowMin', { min: cycle.peer_min })}</>}
      </p>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}

      {mine.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
          {mine.map((n) => {
            const peer = byId.get(n.peer_id)
            return (
              <li key={n.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-semibold">{peer ? displayName(peer) : '—'}</span>
                  {peer?.job_title && <span className="text-sm text-muted"> · {peer.job_title}</span>}
                </span>
                <NomStatus status={n.status} />
                {open && n.status === 'pending' && (
                  <button type="button" onClick={() => act(ops.withdraw.mutateAsync(n.id))} className="rounded-md p-1 text-muted hover:bg-danger/8 hover:text-danger" aria-label={t('noms.withdraw')} title={t('noms.withdraw')}>
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {open ? (
        live.length < cycle.peer_max && (
          <div className="mt-4">
            <PeerPicker options={options} busy={ops.nominate.isPending} label={t('noms.pick')}
              onAdd={(peerId) => act(ops.nominate.mutateAsync({ revieweeId: meId, peerId }))} />
          </div>
        )
      ) : (
        <p className="mt-4 text-sm text-muted">{t('noms.closed')}</p>
      )}
    </section>
  )
}

/** A manager approves or declines nominations made by their direct reports. */
export function ManagerApprovals({ cycle, members, participants, nominations, meId }: Common & { meId: string }) {
  const { t } = useTranslation()
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const [err, setErr] = useState<string | null>(null)
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const reports = participants.filter((p) => p.manager_id === meId)
  if (reports.length === 0 || cycle.status !== 'nomination') return null

  const pending = nominations.filter((n) => n.status === 'pending' && reports.some((r) => r.reviewee_id === n.reviewee_id))
  const act = async (p: Promise<unknown>) => { setErr(null); try { await p } catch (e) { setErr((e as Error).message) } }

  return (
    <section className="rounded-xl border border-line border-t-4 border-t-manager bg-card p-5">
      <h2 className="text-lg font-bold">{t('noms.approveTitle')}</h2>
      <p className="mt-1 text-[15px] text-muted">{t('noms.approveHelp')}</p>
      {err && <div className="mt-3"><Alert>{err}</Alert></div>}
      {pending.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{t('noms.nothingPending')}</p>
      ) : (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
          {pending.map((n) => (
            <DecisionRow key={n.id} nomination={n} byId={byId}
              onDecide={(approve) => act(ops.decide.mutateAsync({ nominationId: n.id, approve }))} />
          ))}
        </ul>
      )}
    </section>
  )
}

function DecisionRow({ nomination: n, byId, onDecide, onRemove, showReviewee = true }: {
  nomination: Nomination; byId: Map<string, Member>; onDecide: (approve: boolean) => void; onRemove?: () => void; showReviewee?: boolean
}) {
  const { t } = useTranslation()
  const reviewee = byId.get(n.reviewee_id)
  const peer = byId.get(n.peer_id)
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
      <span className="min-w-0 flex-1 text-[15px]">
        {showReviewee && <><span className="font-semibold">{reviewee ? displayName(reviewee) : '—'}</span><span className="text-muted"> → </span></>}
        <span className={showReviewee ? '' : 'font-semibold'}>{peer ? displayName(peer) : '—'}</span>
        {peer?.job_title && <span className="text-sm text-muted"> · {peer.job_title}</span>}
      </span>
      <div className="flex items-center gap-1.5">
        {n.status === 'pending' ? (
          <>
            <Button variant="danger" className="px-3 py-1.5 text-sm" onClick={() => onDecide(false)}><X className="size-4" aria-hidden />{t('noms.reject')}</Button>
            <Button className="px-3 py-1.5 text-sm" onClick={() => onDecide(true)}><Check className="size-4" aria-hidden />{t('noms.approve')}</Button>
          </>
        ) : (
          <NomStatus status={n.status} />
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="rounded-md p-1 text-muted hover:bg-danger/8 hover:text-danger" aria-label={t('noms.withdraw')} title={t('noms.withdraw')}>
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}

/** Admin view of one participant's nominations: decide, remove, or add peers directly. */
export function AdminNominationsDialog({ cycle, members, participants, nominations, revieweeId, onClose }: Common & { revieweeId: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const ops = useCycleOps(cycle.org_id, cycle.id)
  const [err, setErr] = useState<string | null>(null)
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const p = participants.find((x) => x.reviewee_id === revieweeId)
  const reviewee = revieweeId ? byId.get(revieweeId) : undefined
  const list = nominations.filter((n) => n.reviewee_id === revieweeId && n.status !== 'withdrawn')
  const taken = new Set(list.filter((n) => LIVE.includes(n.status)).map((n) => n.peer_id))
  const options = p ? eligiblePeers(members, p.reviewee_id, p.manager_id, taken) : []
  const open = cycle.status === 'nomination'
  const act = async (pr: Promise<unknown>) => { setErr(null); try { await pr } catch (e) { setErr((e as Error).message) } }

  return (
    <Dialog open={!!revieweeId} onClose={onClose} title={t('noms.adminTitle', { name: reviewee ? displayName(reviewee) : '' })}>
      {err && <div className="mb-3"><Alert>{err}</Alert></div>}
      {list.length === 0 ? <p className="text-muted">{t('noms.none')}</p> : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {list.map((n) => (
            <DecisionRow key={n.id} nomination={n} byId={byId} showReviewee={false}
              onDecide={(approve) => act(ops.decide.mutateAsync({ nominationId: n.id, approve }))}
              onRemove={open && n.status !== 'rejected' ? () => act(ops.withdraw.mutateAsync(n.id)) : undefined} />
          ))}
        </ul>
      )}
      {open && p && taken.size < cycle.peer_max && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">{t('noms.adminAdd')}</p>
          <PeerPicker options={options} busy={ops.nominate.isPending} label={t('noms.pick')}
            onAdd={(peerId) => act(ops.nominate.mutateAsync({ revieweeId: p.reviewee_id, peerId }))} />
        </div>
      )}
    </Dialog>
  )
}
