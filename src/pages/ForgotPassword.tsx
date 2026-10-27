import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field } from '../components/ui'
import { VerifyCode } from '../components/VerifyCode'
import { authErrorMessage } from '../lib/errors'
import { appUrl, supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [codeFor, setCodeFor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('/reset-password') })
    setLoading(false)
    if (error) return setError(authErrorMessage(t, error))
    setCodeFor(email.trim())
  }

  return (
    <AuthLayout
      title={codeFor ? t('verify.title') : t('auth.forgotTitle')}
      intro={!codeFor && t('auth.forgotBody')}
      footer={<Link to="/sign-in" className="font-semibold text-brand underline-offset-2 hover:underline">{t('auth.backToSignIn')}</Link>}
    >
      {codeFor ? (
        <VerifyCode
          email={codeFor}
          kind="recovery"
          onVerified={() => navigate('/reset-password', { replace: true })}
          onChangeEmail={() => setCodeFor(null)}
        />
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
