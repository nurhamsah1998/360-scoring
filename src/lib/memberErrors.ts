import type { TFunction } from 'i18next'

export function memberErrorMessage(t: TFunction, err: unknown): string {
  const msg = (err as Error)?.message ?? String(err)
  if (msg.includes('reporting loop')) return t('members.errors.manager_loop')
  if (msg.includes('at least one active admin')) return t('members.errors.last_admin')
  if (msg === 'not_allowed') return t('members.errors.not_allowed')
  return t('members.errors.generic', { message: msg })
}
