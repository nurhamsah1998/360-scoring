import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field, Spinner } from '../components/ui'
import { authErrorMessage } from '../lib/errors'
import { setCurrentOrgSlug } from '../lib/orgs'
import { supabase } from '../lib/supabase'

/** Landing page for Supabase invite emails: set a password, then join every pending invitation. */
export default function AcceptInvite() {
  const { t } = useTranslation()
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner fullScreen />

  if (!session) {
    return (
      <AuthLayout title={t('invites.pageTitle')}>
        <Alert tone="info">{t('invites.noSession')}</Alert>
        <Link to="/sign-in" className="mt-5 inline-block font-semibold text-brand underline-offset-2 hover:underline">{t('auth.signInLink')}</Link>
      </AuthLayout>
    )
  }

  const fullName = name ?? ((session.user.user_metadata?.full_name as string | undefined) ?? '')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError(t('auth.errors.weakPassword'))
    setBusy(true)
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password, data: { full_name: fullName.trim() } })
      if (pwErr) throw pwErr
      await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('user_id', session.user.id)

      const { data: pending } = await supabase
        .from('memberships')
        .select('id')
        .eq('status', 'invited')
        .is('user_id', null)
        .eq('email', (session.user.email ?? '').toLowerCase())
      let slug: string | null = null
      for (const p of pending ?? []) {
        const { data } = await supabase.rpc('accept_invitation', { p_membership: p.id })
        slug = slug ?? (data as string | null)
      }
      if (slug) setCurrentOrgSlug(slug)
      await qc.invalidateQueries()
      navigate('/app', { replace: true })
    } catch (err) {
      setError(authErrorMessage(t, err))
      setBusy(false)
    }
  }

  return (
    <AuthLayout title={t('invites.pageTitle')} intro={t('invites.pageBody')}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t('auth.email')} value={session.user.email ?? ''} readOnly disabled />
        <Field label={t('auth.fullName')} autoComplete="name" required value={fullName} onChange={(e) => setName(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={busy}>{t('invites.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
