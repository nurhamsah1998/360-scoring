import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { authErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { Alert, Button, Field } from './ui'

type Props = {
  email: string
  /** 'signup' verifies a new account; 'recovery' signs in to reset a password. */
  kind: 'signup' | 'recovery'
  notice?: string
  onVerified: () => void
  onChangeEmail: () => void
}

const COOLDOWN = 60

/** Enter the one-time code Supabase emailed, with a resend button on a cooldown. */
export function VerifyCode({ email, kind, notice, onVerified, onChangeEmail }: Props) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(notice ?? null)
  const [loading, setLoading] = useState(false)
  const [wait, setWait] = useState(COOLDOWN)

  useEffect(() => {
    if (wait <= 0) return
    const id = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(id)
  }, [wait])

  const clean = code.replace(/\D/g, '')

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (clean.length < 6) return
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: clean, type: kind === 'signup' ? 'email' : 'recovery' })
    setLoading(false)
    if (error) {
      const c = (error as { code?: string }).code
      return setError(c === 'otp_expired' || c === 'invalid_credentials' || /expired|invalid/i.test(error.message) ? t('verify.invalid') : authErrorMessage(t, error))
    }
    onVerified()
  }

  const resend = async () => {
    setError(null)
    setInfo(null)
    const { error } = kind === 'signup'
      ? await supabase.auth.resend({ type: 'signup', email })
      : await supabase.auth.resetPasswordForEmail(email)
    if (error) return setError(authErrorMessage(t, error))
    setInfo(t('verify.resent'))
    setWait(COOLDOWN)
  }

  return (
    <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
      <p className="text-muted">{t(kind === 'signup' ? 'verify.body' : 'verify.bodyRecovery', { email })}</p>
      {info && <Alert tone="info">{info}</Alert>}
      {error && <Alert>{error}</Alert>}
      <Field
        label={t('verify.code')}
        hint={t('verify.codeHint')}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/[^\d\s]/g, '').slice(0, 12))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        placeholder="••••••"
        className="[&_input]:text-center [&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.4em]"
      />
      <Button type="submit" loading={loading} disabled={clean.length < 6}>{t('verify.submit')}</Button>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={resend} disabled={wait > 0}
          className="font-semibold text-brand underline-offset-2 hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline">
          {wait > 0 ? t('verify.resendIn', { s: wait }) : t('verify.resend')}
        </button>
        <button type="button" onClick={onChangeEmail} className="font-semibold text-muted underline-offset-2 hover:text-ink hover:underline">
          {t('verify.wrongEmail')}
        </button>
      </div>
    </form>
  )
}
