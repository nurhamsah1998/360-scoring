import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field } from '../components/ui'
import { authErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError(t('auth.errors.weakPassword'))
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(authErrorMessage(t, error))
    setDone(true)
  }

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      {done ? (
        <>
          <Alert tone="success">{t('auth.resetDone')}</Alert>
          <Link to="/app" className="mt-5 inline-block font-semibold text-brand underline-offset-2 hover:underline">{t('app.orgSwitcher')}</Link>
        </>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label={t('auth.password')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" loading={loading}>{t('auth.resetSubmit')}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
