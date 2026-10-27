import type { TFunction } from 'i18next'

/** Map Supabase auth/db errors to friendly, translated messages. */
export function authErrorMessage(t: TFunction, err: unknown): string {
  const e = err as { code?: string; message?: string }
  switch (e?.code) {
    case 'invalid_credentials':
      return t('auth.errors.invalidCredentials')
    case 'email_not_confirmed':
      return t('auth.errors.emailNotConfirmed')
    case 'user_already_exists':
    case 'email_exists':
      return t('auth.errors.userExists')
    case 'weak_password':
      return t('auth.errors.weakPassword')
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return t('auth.errors.rateLimit')
    default:
      return t('auth.errors.generic', { message: e?.message ?? String(err) })
  }
}
