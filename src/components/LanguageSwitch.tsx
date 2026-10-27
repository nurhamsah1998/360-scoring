import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { currentLang, LANGUAGES, type Lang } from '../i18n'
import { supabase } from '../lib/supabase'

export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const { session } = useAuth()
  const active = currentLang()

  const change = async (lng: Lang) => {
    await i18n.changeLanguage(lng)
    if (session) {
      await supabase.from('profiles').update({ locale: lng }).eq('user_id', session.user.id)
    }
  }

  return (
    <div role="group" aria-label={t('lang.label')} className={clsx('inline-flex rounded-lg border border-line bg-card p-0.5 text-sm', className)}>
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          onClick={() => change(lng)}
          aria-pressed={active === lng}
          title={t(`lang.${lng}`)}
          className={clsx(
            'rounded-md px-2.5 py-1 font-semibold uppercase transition-colors',
            active === lng ? 'bg-ink text-white' : 'text-muted hover:text-ink',
          )}
        >
          {lng}
        </button>
      ))}
    </div>
  )
}
