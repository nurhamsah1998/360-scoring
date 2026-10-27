import clsx from 'clsx'
import { ArrowLeft, CheckCircle2, Download, FileUp, TriangleAlert } from 'lucide-react'
import Papa from 'papaparse'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { Alert, Button, Spinner } from '../components/ui'
import { CSV_TEMPLATE, normalizeHeader, validateImport, type ImportRow } from '../lib/csvImport'
import { memberErrorMessage } from '../lib/memberErrors'
import { useInviteMembers, useMembers, type InviteResult } from '../lib/members'
import { useOrg } from '../lib/org-context'

export default function ImportMembers() {
  const { t } = useTranslation()
  const { org, isAdmin } = useOrg()
  const { data: members, isLoading } = useMembers(org.id)
  const invite = useInviteMembers(org.id)
  const fileRef = useRef<HTMLInputElement>(null)

  const [fileName, setFileName] = useState<string | null>(null)
  const [records, setRecords] = useState<Record<string, string>[] | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [results, setResults] = useState<InviteResult[] | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const rows = useMemo<ImportRow[] | null>(
    () => (records && members ? validateImport(records, members.map((m) => m.email)) : null),
    [records, members],
  )
  const importable = rows?.filter((r) => r.importable) ?? []
  const problems = rows?.filter((r) => !r.importable && !(r.issues.length === 1 && r.issues[0] === 'exists')) ?? []

  if (!isAdmin) return <Navigate to="/app/members" replace />

  const reset = () => {
    setFileName(null); setRecords(null); setParseError(null); setResults(null); setSubmitError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const onFile = (file: File) => {
    reset()
    setFileName(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
      complete: (res) => {
        const fields = res.meta.fields ?? []
        if (!fields.includes('name') || !fields.includes('email')) {
          return setParseError(t('import.missingColumns', { found: fields.join(', ') || '—' }))
        }
        if (res.data.length === 0) return setParseError(t('import.emptyFile'))
        setRecords(res.data)
      },
      error: (err) => setParseError(err.message),
    })
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = '360-scoring-members.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    setSubmitError(null)
    try {
      const res = await invite.mutateAsync(
        importable.map((r) => ({ name: r.name, email: r.email, jobTitle: r.jobTitle, managerEmail: r.managerEmail })),
      )
      setResults(res)
    } catch (err) {
      setSubmitError(memberErrorMessage(t, err))
    }
  }

  return (
    <div className="max-w-3xl">
      <Link to="/app/members" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />{t('import.back')}
      </Link>
      <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight">{t('import.title')}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t('import.body')}</p>

      {results ? (
        <ImportDone results={results} onAnother={reset} />
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              id="csv"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
            <label
              htmlFor="csv"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-hover focus-within:outline-2"
            >
              <FileUp className="size-4" aria-hidden />{t('import.choose')}
            </label>
            <Button variant="outline" onClick={downloadTemplate}><Download className="size-4" aria-hidden />{t('import.template')}</Button>
          </div>
          {fileName && <p className="mt-3 text-sm text-muted">{fileName}</p>}
          {parseError && <div className="mt-4"><Alert>{parseError}</Alert></div>}
          {records && isLoading && <div className="mt-6"><Spinner /></div>}

          {rows && (
            <section className="mt-6">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]">
                <span className="font-semibold">{t('import.rows', { count: rows.length })}</span>
                <span className="text-success">{t('import.ready', { count: importable.length })}</span>
                {problems.length > 0 && <span className="text-danger">{t('import.problems', { count: problems.length })}</span>}
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-card">
                <table className="w-full min-w-[560px] text-left text-[15px]">
                  <thead className="border-b border-line text-sm text-muted">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t('import.colRow')}</th>
                      <th className="px-3 py-2 font-semibold">{t('members.colName')}</th>
                      <th className="px-3 py-2 font-semibold">{t('members.colTitle')}</th>
                      <th className="px-3 py-2 font-semibold">{t('members.colManager')}</th>
                      <th className="px-3 py-2 font-semibold">{t('import.colIssue')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const skipped = !r.importable && r.issues.length === 1 && r.issues[0] === 'exists'
                      return (
                        <tr key={r.line} className={clsx('border-b border-line align-top last:border-b-0', !r.importable && !skipped && 'bg-danger/[0.04]')}>
                          <td className="px-3 py-2.5 text-muted">{r.line}</td>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold">{r.name || '—'}</div>
                            <div className="text-sm text-muted">{r.email || '—'}</div>
                          </td>
                          <td className="px-3 py-2.5">{r.jobTitle || <span className="text-muted">—</span>}</td>
                          <td className="px-3 py-2.5 text-sm">{r.managerEmail || <span className="text-muted">—</span>}</td>
                          <td className="px-3 py-2.5 text-sm">
                            {r.importable ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="size-4" aria-hidden />{t('import.ok')}</span>
                            ) : (
                              <ul className={clsx('flex flex-col gap-0.5', skipped ? 'text-muted' : 'text-danger')}>
                                {r.issues.map((c) => (
                                  <li key={c} className="flex gap-1"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />{t(`import.issues.${c}`)}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {submitError && <div className="mt-4"><Alert>{submitError}</Alert></div>}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={submit} loading={invite.isPending} disabled={importable.length === 0}>
                  {t('import.submit', { count: importable.length })}
                </Button>
                <Button variant="ghost" onClick={reset}>{t('common.cancel')}</Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function ImportDone({ results, onAnother }: { results: InviteResult[]; onAnother: () => void }) {
  const { t } = useTranslation()
  const created = results.filter((r) => r.status === 'created')
  const emailed = created.filter((r) => r.emailSent).length
  const failed = created.filter((r) => r.emailNote === 'send_failed')
  const managerErrors = created.filter((r) => r.managerError).length

  return (
    <section className="mt-6 rounded-xl border border-line bg-card p-5">
      <h2 className="flex items-center gap-2 text-xl font-extrabold"><CheckCircle2 className="size-5 text-success" aria-hidden />{t('import.doneTitle')}</h2>
      <ul className="mt-3 flex flex-col gap-1 text-[15px]">
        <li>{t('import.doneCreated', { count: created.length })}</li>
        {emailed > 0 && <li>{t('import.doneEmailed', { count: emailed })}</li>}
        {managerErrors > 0 && <li className="text-danger">{t('import.doneManagerErrors', { count: managerErrors })}</li>}
      </ul>
      {failed.length > 0 && (
        <div className="mt-4">
          <Alert tone="info">
            <p className="font-semibold">{t('import.doneEmailFailed', { count: failed.length })}</p>
            <p className="mt-1">{t('import.doneEmailFailedHint')}</p>
            <p className="mt-2 break-words text-muted">{failed.map((f) => f.email).join(', ')}</p>
          </Alert>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/app/members" className="inline-flex items-center rounded-lg bg-brand px-4 py-2.5 text-[15px] font-semibold text-white hover:bg-brand-hover">{t('import.back')}</Link>
        <Button variant="ghost" onClick={onAnother}>{t('import.another')}</Button>
      </div>
    </section>
  )
}
