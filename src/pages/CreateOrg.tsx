import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/AuthLayout'
import { PendingInvites } from '../components/PendingInvites'
import { Alert, Button, Field } from '../components/ui'
import { authErrorMessage } from '../lib/errors'
import { setCurrentOrgSlug, useMyOrgs } from '../lib/orgs'
import { supabase } from '../lib/supabase'

export default function CreateOrg() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: orgs } = useMyOrgs()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (name.trim().length < 2) return
    setLoading(true)
    const { data: orgId, error } = await supabase.rpc('create_organization', { p_name: name.trim() })
    if (error) {
      setLoading(false)
      return setError(authErrorMessage(t, error))
    }
    const { data: org } = await supabase.from('organizations').select('slug').eq('id', orgId).single()
    if (org) setCurrentOrgSlug(org.slug)
    await qc.invalidateQueries({ queryKey: ['my-orgs'] })
    navigate('/app', { replace: true })
  }

  return (
    <AuthLayout
      title={t('onboarding.title')}
      intro={t('onboarding.body')}
      footer={orgs && orgs.length > 0 ? <Link to="/app" className="font-semibold text-brand underline-offset-2 hover:underline">← {t('app.orgSwitcher')}</Link> : undefined}
    >
      <PendingInvites className="mb-6" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <Field
          label={t('onboarding.name')}
          placeholder={t('onboarding.namePlaceholder')}
          required
          minLength={2}
          maxLength={80}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" loading={loading} disabled={name.trim().length < 2}>{t('onboarding.submit')}</Button>
      </form>
    </AuthLayout>
  )
}
