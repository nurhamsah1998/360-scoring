import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { memberErrorMessage } from '../lib/memberErrors'
import {
  descendantsOf, displayName, useDeleteInvite, useInviteMembers, useResendInvite, useUpdateMember,
  type InviteResult, type Member,
} from '../lib/members'
import { Alert, Button, Dialog, Field, SelectField } from './ui'

export type Notice = { tone: 'success' | 'danger' | 'info'; text: string }

type Props = {
  orgId: string
  members: Member[]
  /** null = add a new member */
  member: Member | null
  open: boolean
  onClose: () => void
  onDone: (n: Notice) => void
}

export function MemberDialog({ orgId, members, member, open, onClose, onDone }: Props) {
  const { t } = useTranslation()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={member ? t('members.editTitle', { name: displayName(member) }) : t('members.addTitle')}
    >
      {open && (member
        ? <EditForm key={member.id} orgId={orgId} members={members} member={member} onClose={onClose} onDone={onDone} />
        : <AddForm orgId={orgId} members={members} onClose={onClose} onDone={onDone} />)}
    </Dialog>
  )
}

function ManagerOptions({ members, exclude }: { members: Member[]; exclude: Set<string> }) {
  const { t } = useTranslation()
  return (
    <>
      <option value="">{t('members.noManager')}</option>
      {members
        .filter((m) => m.status !== 'inactive' && !exclude.has(m.id))
        .map((m) => (
          <option key={m.id} value={m.id}>
            {displayName(m)}{m.job_title ? ` — ${m.job_title}` : ''}
          </option>
        ))}
    </>
  )
}

export function inviteResultNotice(t: ReturnType<typeof useTranslation>['t'], r: InviteResult): Notice {
  if (r.status === 'exists') return { tone: 'info', text: t('members.result.exists', { email: r.email }) }
  if (r.status !== 'created') return { tone: 'danger', text: t('import.issues.invalid_email') }
  const parts = [t('members.added', { email: r.email })]
  if (r.emailSent) parts.push(t('members.result.emailSent'))
  else if (r.emailNote === 'existing_account') parts.push(t('members.result.existing_account'))
  else if (r.emailNote === 'send_failed') parts.push(t('members.result.send_failed', { reason: r.emailError, email: r.email }))
  if (r.managerError) parts.push(r.managerError === 'manager_loop' ? t('members.errors.manager_loop') : t('import.issues.manager_not_found'))
  return { tone: r.emailNote === 'send_failed' || r.managerError ? 'info' : 'success', text: parts.join(' ') }
}

function AddForm({ orgId, members, onClose, onDone }: Omit<Props, 'member' | 'open'>) {
  const { t } = useTranslation()
  const invite = useInviteMembers(orgId)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [managerId, setManagerId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const managerEmail = members.find((m) => m.id === managerId)?.email ?? ''
    try {
      const [r] = await invite.mutateAsync([{ name: name.trim(), email: email.trim(), jobTitle: jobTitle.trim(), managerEmail }])
      if (r.status === 'invalid') return setError(t('import.issues.invalid_email'))
      onDone(inviteResultNotice(t, r))
      onClose()
    } catch (err) {
      setError(memberErrorMessage(t, err))
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <Field label={t('members.fields.name')} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Field label={t('members.fields.email')} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field label={`${t('members.fields.jobTitle')} (${t('common.optional')})`} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      <SelectField label={t('members.fields.manager')} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
        <ManagerOptions members={members} exclude={new Set()} />
      </SelectField>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" loading={invite.isPending} disabled={!name.trim() || !email.trim()}>{t('members.addSubmit')}</Button>
      </div>
    </form>
  )
}

function EditForm({ orgId, members, member, onClose, onDone }: Omit<Props, 'open'> & { member: Member }) {
  const { t } = useTranslation()
  const { session } = useAuth()
  const update = useUpdateMember(orgId)
  const resend = useResendInvite(orgId)
  const del = useDeleteInvite(orgId)
  const [name, setName] = useState(member.full_name)
  const [jobTitle, setJobTitle] = useState(member.job_title)
  const [managerId, setManagerId] = useState(member.manager_id ?? '')
  const [role, setRole] = useState(member.role)
  const [error, setError] = useState<string | null>(null)

  const isSelf = member.user_id === session?.user.id
  const exclude = useMemo(() => new Set([member.id, ...descendantsOf(member.id, members)]), [member.id, members])

  const run = async (fn: () => Promise<unknown>, notice: Notice) => {
    setError(null)
    try {
      await fn()
      onDone(notice)
      onClose()
    } catch (err) {
      setError(memberErrorMessage(t, err))
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    run(
      () => update.mutateAsync({
        id: member.id,
        patch: { full_name: name.trim(), job_title: jobTitle.trim(), manager_id: managerId || null, role },
      }),
      { tone: 'success', text: t('common.saved') },
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error && <Alert>{error}</Alert>}
      <p className="-mt-2 text-sm text-muted">{member.email}</p>
      <Field label={t('members.fields.name')} value={name} onChange={(e) => setName(e.target.value)} />
      <Field label={t('members.fields.jobTitle')} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
      <SelectField label={t('members.fields.manager')} value={managerId} onChange={(e) => setManagerId(e.target.value)}>
        <ManagerOptions members={members} exclude={exclude} />
      </SelectField>
      <SelectField label={t('members.fields.role')} value={role} onChange={(e) => setRole(e.target.value as Member['role'])}>
        <option value="member">{t('app.role.member')}</option>
        <option value="admin">{t('app.role.admin')}</option>
      </SelectField>

      <div className="mt-2 flex flex-col-reverse gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2 sm:mr-auto">
          {member.status === 'invited' && (
            <>
              <Button
                type="button"
                variant="outline"
                loading={resend.isPending}
                onClick={() => run(async () => {
                  const [r] = await resend.mutateAsync(member)
                  if (r.emailNote === 'send_failed') throw new Error(t('members.result.send_failed', { reason: r.emailError, email: member.email }))
                }, { tone: 'success', text: t('members.resent', { email: member.email }) })}
              >
                {t('members.resend')}
              </Button>
              <Button
                type="button"
                variant="danger"
                loading={del.isPending}
                onClick={() => run(() => del.mutateAsync(member.id), { tone: 'success', text: t('members.deleted') })}
              >
                {t('members.deleteInvite')}
              </Button>
            </>
          )}
          {member.status === 'active' && !isSelf && (
            <Button
              type="button"
              variant="danger"
              title={t('members.deactivateHint')}
              onClick={() => run(() => update.mutateAsync({ id: member.id, patch: { status: 'inactive' } }), { tone: 'success', text: t('common.saved') })}
            >
              {t('members.deactivate')}
            </Button>
          )}
          {member.status === 'inactive' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => run(() => update.mutateAsync({ id: member.id, patch: { status: 'active' } }), { tone: 'success', text: t('common.saved') })}
            >
              {t('members.reactivate')}
            </Button>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={update.isPending}>{t('common.save')}</Button>
        </div>
      </div>
    </form>
  )
}
