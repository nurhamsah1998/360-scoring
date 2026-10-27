import { CalendarPlus, ChevronRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { StageBadge } from '../components/StageStepper'
import { Alert, Button, Dialog, Field, SelectField, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { formatDate, useCycleOps, useCycles } from '../lib/cycles'
import { useOrg } from '../lib/org-context'
import { useTemplates } from '../lib/templates'

export default function Cycles() {
  const { t } = useTranslation()
  const { org, isAdmin } = useOrg()
  const { data: cycles, isLoading, error } = useCycles(org.id)
  const [open, setOpen] = useState(false)
  const lang = currentLang()

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{t('cycles.title')}</h1>
          <p className="mt-1 max-w-[62ch] text-muted">{t('cycles.body')}</p>
        </div>
        {isAdmin && <Button onClick={() => setOpen(true)}><CalendarPlus className="size-4" aria-hidden />{t('cycles.new')}</Button>}
      </div>

      {error && <div className="mt-5"><Alert>{(error as Error).message}</Alert></div>}
      {isLoading && <div className="mt-8"><Spinner /></div>}
      {cycles && cycles.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">
          {isAdmin ? t('cycles.empty') : t('cycles.emptyMember')}
        </p>
      )}

      {cycles && cycles.length > 0 && (
        <ul className="mt-6 overflow-hidden rounded-xl border border-line bg-card">
          {cycles.map((c) => {
            const due = c.status === 'nomination' ? c.nomination_due : c.status === 'review' ? c.review_due : null
            return (
              <li key={c.id} className="border-b border-line last:border-b-0">
                <Link to={`/app/cycles/${c.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-ink/[0.025]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-bold">{c.name}</h2>
                      <StageBadge stage={c.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {t('cycles.participants', { count: c.participantCount })}
                      {due && <> · {t('cycles.due', { date: formatDate(due, lang) })}</>}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {isAdmin && <CreateCycleDialog open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

function CreateCycleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { org } = useOrg()
  const navigate = useNavigate()
  const { data: templates } = useTemplates(org.id)
  const ops = useCycleOps(org.id)
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const tplValue = templateId || templates?.[0]?.id || ''

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    try {
      const id = await ops.create.mutateAsync({ name: name.trim(), templateId: tplValue || null })
      onClose()
      navigate(`/app/cycles/${id}`)
    } catch (e2) {
      setErr((e2 as Error).message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={t('cycles.createTitle')}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {err && <Alert>{err}</Alert>}
        <Field label={t('cycles.name')} placeholder={t('cycles.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus />
        <SelectField label={t('cycles.template')} value={tplValue} onChange={(e) => setTemplateId(e.target.value)}>
          {!templates?.length && <option value="">{t('cycles.noTemplate')}</option>}
          {templates?.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </SelectField>
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={ops.create.isPending} disabled={!name.trim()}>{t('cycles.create')}</Button>
        </div>
      </form>
    </Dialog>
  )
}
