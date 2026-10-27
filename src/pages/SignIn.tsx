import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field } from '../components/ui'
import { authErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export default function SignIn() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) return setError(authErrorMessage(t, error))
    const from = (location.state as { from?: string } | null)?.from
    navigate(from ?? '/app', { replace: true })
  }

  return (
    <AuthLayout
      title={t('auth.signInTitle')}
      footer={<>{t('auth.noAccount')} <Link to="/sign-up" className="font-semibold text-brand underline-offset-2 hover:underline">{t('auth.signUpLink')}</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Link to="/forgot-password" className="-mt-1 self-start text-sm font-semibold text-brand underline-offset-2 hover:underline">{t('auth.forgot')}</Link>
        <Button type="submit" loading={loading} className="mt-1">{t('auth.signInSubmit')}</Button>
      </form>
    </AuthLayout>
  )
}
