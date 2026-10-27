import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <AuthLayout title={t('notFound.title')}>
      <Link to="/" className="font-semibold text-brand underline-offset-2 hover:underline">{t('notFound.back')}</Link>
    </AuthLayout>
  )
}
