import { MailCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { Alert, Button, Field } from '../components/ui'
import { currentLang } from '../i18n'
import { authErrorMessage } from '../lib/errors'
import { appUrl, supabase } from '../lib/supabase'

export default function SignUp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError(t('auth.errors.weakPassword'))
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), locale: currentLang() },
        emailRedirectTo: appUrl('/app'),
      },
    })
    if (error) { setLoading(false); return setError(authErrorMessage(t, error)) }
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) { setLoading(false); return setError(t('auth.errors.userExists')) }
    // With email confirmation turned off, Supabase signs the user in straight away.
    if (data.session) return navigate('/onboarding', { replace: true })
    // Fallback: try signing in directly; this only succeeds when the account needs no confirmation.
    const { data: signed } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (signed.session) return navigate('/onboarding', { replace: true })
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <AuthLayout title={t('auth.checkEmailTitle')}>
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 size-6 shrink-0 text-manager" aria-hidden />
          <p>{t('auth.checkEmailBody', { email: sentTo })}</p>
        </div>
        <Link to="/sign-in" className="mt-6 inline-block text-sm font-semibold text-brand underline-offset-2 hover:underline">{t('auth.backToSignIn')}</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={t('auth.signUpTitle')}
      footer={<>{t('auth.haveAccount')} <Link to="/sign-in" className="font-semibold text-brand underline-offset-2 hover:underline">{t('auth.signInLink')}</Link></>}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field label={t('auth.fullName')} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label={t('auth.password')} type="password" autoComplete="new-password" hint={t('auth.passwordHint')} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading} className="mt-1">{t('auth.signUpSubmit')}</Button>
      </form>
    </AuthLayout>
  )
}
