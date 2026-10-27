import { ChevronRight, FilePlus2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, Button, Spinner } from '../components/ui'
import { currentLang } from '../i18n'
import { useOrg } from '../lib/org-context'
import { useTemplateOps, useTemplates } from '../lib/templates'

export default function Templates() {
  const { t } = useTranslation()
  const { org, isAdmin } = useOrg()
  const navigate = useNavigate()
  const { data: templates, isLoading, error } = useTemplates(org.id)
  const ops = useTemplateOps(org.id)
  const [err, setErr] = useState<string | null>(null)

  if (!isAdmin) return <Navigate to="/app" replace />

  const create = async (kind: 'default' | 'blank') => {
    setErr(null)
    try {
      const id = kind === 'default'
        ? await ops.createDefault.mutateAsync(currentLang())
        : await ops.createBlank.mutateAsync(t('templates.blankName'))
      navigate(`/app/templates/${id}`)
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">{t('templates.title')}</h1>
          <p className="mt-1 max-w-[62ch] text-muted">{t('templates.body')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => create('default')} loading={ops.createDefault.isPending}>
            <Sparkles className="size-4" aria-hidden />{t('templates.addDefault')}
          </Button>
          <Button onClick={() => create('blank')} loading={ops.createBlank.isPending}>
            <FilePlus2 className="size-4" aria-hidden />{t('templates.new')}
          </Button>
        </div>
      </div>

      {err && <div className="mt-5"><Alert>{err}</Alert></div>}
      {error && <div className="mt-5"><Alert>{(error as Error).message}</Alert></div>}
      {isLoading && <div className="mt-8"><Spinner /></div>}

      {templates && templates.length === 0 && (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">{t('templates.empty')}</p>
      )}

      {templates && templates.length > 0 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => {
            const statements = tpl.competencies.reduce((n, c) => n + c.statements.length, 0)
            return (
              <li key={tpl.id}>
                <Link to={`/app/templates/${tpl.id}`} className="flex items-center gap-4 rounded-xl border border-line bg-card p-5 hover:border-ink/30">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-bold">{tpl.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {t('templates.skills', { count: tpl.competencies.length })} · {t('templates.statements', { count: statements })}
                    </p>
                    <p className="mt-3 line-clamp-2 text-[15px] text-muted">{tpl.competencies.map((c) => c.name).join(', ')}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
