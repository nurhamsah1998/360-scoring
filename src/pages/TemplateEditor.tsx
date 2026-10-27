import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Spinner } from '../components/ui'
import { useOrg } from '../lib/org-context'
import { useTemplate, useTemplateOps, type Competency } from '../lib/templates'

/** Text input that saves on blur when its value changed. */
function InlineInput({ value, onSave, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const next = v.trim()
        if (!next) return setV(value)
        if (next !== value) onSave(next)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      className={`w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 outline-none hover:border-line focus:border-brand focus:bg-card focus:ring-2 focus:ring-brand/15 ${className ?? ''}`}
    />
  )
}

function IconButton({ label, onClick, disabled, children, danger }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`rounded-md p-1.5 text-muted disabled:opacity-30 ${danger ? 'hover:bg-danger/8 hover:text-danger' : 'hover:bg-ink/5 hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

export default function TemplateEditor() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { org, isAdmin } = useOrg()
  const { data: tpl, isLoading, error } = useTemplate(org.id, id)
  const ops = useTemplateOps(org.id)
  const [err, setErr] = useState<string | null>(null)

  if (!isAdmin) return <Navigate to="/app" replace />
  if (isLoading) return <Spinner />
  if (error) return <Alert>{(error as Error).message}</Alert>
  if (!tpl) return <Navigate to="/app/templates" replace />

  const act = async (p: Promise<unknown>) => {
    setErr(null)
    try { await p } catch (e) { setErr((e as Error).message) }
  }

  const comps = tpl.competencies
  const nextPos = (list: { position: number }[]) => (list.length ? Math.max(...list.map((x) => x.position)) + 1 : 0)
  const swapComp = (i: number, j: number) =>
    act(ops.swap.mutateAsync({ table: 'competencies', a: { id: comps[i].id, position: j }, b: { id: comps[j].id, position: i } }))
  const swapStmt = (c: Competency, i: number, j: number) =>
    act(ops.swap.mutateAsync({ table: 'statements', a: { id: c.statements[i].id, position: j }, b: { id: c.statements[j].id, position: i } }))

  return (
    <div className="max-w-3xl">
      <Link to="/app/templates" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{t('templates.back')}
      </Link>

      <div className="mt-3 flex items-start gap-2">
        <label className="sr-only" htmlFor="tpl-name">{t('templates.name')}</label>
        <InlineInput
          id="tpl-name"
          value={tpl.name}
          maxLength={80}
          onSave={(name) => act(ops.renameTemplate.mutateAsync({ id: tpl.id, name }))}
          className="-mx-2 text-[28px] font-extrabold tracking-tight"
        />
        <IconButton
          label={t('templates.deleteTemplate')}
          danger
          onClick={() => {
            if (!window.confirm(t('templates.confirmDelete'))) return
            act(ops.deleteTemplate.mutateAsync(tpl.id).then(() => navigate('/app/templates', { replace: true })))
          }}
        >
          <Trash2 className="size-5" aria-hidden />
        </IconButton>
      </div>
      <p className="mt-1 text-sm text-muted">{t('templates.scale')} {t('templates.savedHint')}</p>

      {err && <div className="mt-4"><Alert>{err}</Alert></div>}

      <ol className="mt-6 flex flex-col gap-4">
        {comps.map((c, ci) => (
          <li key={c.id} className="rounded-xl border border-line bg-card p-4 sm:p-5">
            <div className="flex items-start gap-2">
              <span className="mt-2 w-6 shrink-0 text-sm font-semibold text-muted">{ci + 1}</span>
              <div className="min-w-0 flex-1">
                <InlineInput
                  aria-label={t('templates.skillName')}
                  value={c.name}
                  maxLength={80}
                  onSave={(name) => act(ops.updateCompetency.mutateAsync({ id: c.id, patch: { name } }))}
                  className="-mx-2 text-lg font-bold"
                />
                <InlineInput
                  aria-label={t('templates.skillDescription')}
                  placeholder={t('templates.skillDescription')}
                  value={c.description}
                  maxLength={300}
                  onSave={(description) => act(ops.updateCompetency.mutateAsync({ id: c.id, patch: { description } }))}
                  className="-mx-2 text-[15px] text-muted"
                />
              </div>
              <div className="flex shrink-0">
                <IconButton label={t('templates.moveUp')} disabled={ci === 0} onClick={() => swapComp(ci, ci - 1)}><ArrowUp className="size-4" aria-hidden /></IconButton>
                <IconButton label={t('templates.moveDown')} disabled={ci === comps.length - 1} onClick={() => swapComp(ci, ci + 1)}><ArrowDown className="size-4" aria-hidden /></IconButton>
                <IconButton label={t('templates.deleteSkill')} danger onClick={() => act(ops.deleteCompetency.mutateAsync(c.id))}><Trash2 className="size-4" aria-hidden /></IconButton>
              </div>
            </div>

            <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3 sm:ml-8">
              {c.statements.map((s, si) => (
                <li key={s.id} className="flex items-center gap-1">
                  <InlineInput
                    aria-label={t('templates.statement')}
                    value={s.body}
                    maxLength={300}
                    onSave={(body) => act(ops.updateStatement.mutateAsync({ id: s.id, body }))}
                    className="text-[15px]"
                  />
                  <div className="flex shrink-0">
                    <IconButton label={t('templates.moveUp')} disabled={si === 0} onClick={() => swapStmt(c, si, si - 1)}><ArrowUp className="size-4" aria-hidden /></IconButton>
                    <IconButton label={t('templates.moveDown')} disabled={si === c.statements.length - 1} onClick={() => swapStmt(c, si, si + 1)}><ArrowDown className="size-4" aria-hidden /></IconButton>
                    <IconButton label={t('templates.deleteStatement')} danger onClick={() => act(ops.deleteStatement.mutateAsync(s.id))}><Trash2 className="size-4" aria-hidden /></IconButton>
                  </div>
                </li>
              ))}
              <li>
                <Button
                  variant="ghost"
                  className="mt-1 px-2 py-1.5 text-sm text-brand"
                  onClick={() => act(ops.addStatement.mutateAsync({ competencyId: c.id, position: nextPos(c.statements), body: t('templates.newStatement') }))}
                >
                  <Plus className="size-4" aria-hidden />{t('templates.addStatement')}
                </Button>
              </li>
            </ul>
          </li>
        ))}
      </ol>

      <Button
        variant="outline"
        className="mt-4"
        loading={ops.addCompetency.isPending}
        onClick={() => act(ops.addCompetency.mutateAsync({ templateId: tpl.id, position: nextPos(comps), name: t('templates.newSkill') }))}
      >
        <Plus className="size-4" aria-hidden />{t('templates.addSkill')}
      </Button>
    </div>
  )
}
