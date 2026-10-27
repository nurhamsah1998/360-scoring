import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field } from '../components/ui'
import { authErrorMessage } from '../lib/errors'
import { appUrl, supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl('/reset-password') })
    setLoading(false)
    if (error) return setError(authErrorMessage(t, error))
    setSent(true)
  }

  return (
    <AuthLayout
      title={t('auth.forgotTitle')}
      intro={!sent && t('auth.forgotBody')}
      footer={<Link to="/sign-in" className="font-semibold text-brand underline-offset-2 hover:underline">{t('auth.backToSignIn')}</Link>}
    >
      {sent ? (
        <Alert tone="success">{t('auth.forgotSent', { email })}</Alert>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {error && <Alert>{error}</Alert>}
          <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading}>{t('auth.forgotSubmit')}</Button>
        </form>
      )}
    </AuthLayout>
  )
}
