import { MailOpen } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { usePendingInvites, useRespondInvite } from '../lib/members'
import { setCurrentOrgSlug } from '../lib/orgs'
import { Alert, Button } from './ui'

/** Invitations addressed to the signed-in user, with accept / decline. */
export function PendingInvites({ className }: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: invites } = usePendingInvites()
  const respond = useRespondInvite()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!invites?.length) return null

  const act = async (id: string, accept: boolean) => {
    setBusy(id + accept)
    setError(null)
    try {
      const slug = await respond.mutateAsync({ id, accept })
      if (accept && slug) {
        setCurrentOrgSlug(slug)
        navigate('/app', { replace: true })
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className={className} aria-label={t('invites.bannerTitle')}>
      {error && <div className="mb-3"><Alert>{error}</Alert></div>}
      <ul className="flex flex-col gap-3">
        {invites.map((inv) => (
          <li key={inv.id} className="flex flex-col gap-3 rounded-xl border border-line border-l-4 border-l-manager bg-card p-4 sm:flex-row sm:items-center">
            <MailOpen className="size-5 shrink-0 text-manager" aria-hidden />
            <div className="flex-1">
              <p className="font-bold">{t('invites.bannerTitle')}</p>
              <p className="text-[15px] text-muted">{t('invites.bannerBody', { org: inv.org.name })}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => act(inv.id, false)} loading={busy === inv.id + 'false'}>{t('invites.decline')}</Button>
              <Button onClick={() => act(inv.id, true)} loading={busy === inv.id + 'true'}>{t('invites.accept', { org: inv.org.name })}</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
