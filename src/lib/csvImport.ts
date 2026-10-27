// Pure CSV-import validation, kept free of React so it can be tested in isolation.

export type IssueCode =
  | 'missing_name'
  | 'invalid_email'
  | 'duplicate_in_file'
  | 'exists'
  | 'manager_self'
  | 'manager_not_found'
  | 'manager_loop'

export type ImportRow = {
  line: number // line number in the file (header = 1)
  name: string
  email: string
  jobTitle: string
  managerEmail: string
  issues: IssueCode[]
  /** true when the row will be sent to the server */
  importable: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BLOCKING: IssueCode[] = ['missing_name', 'invalid_email', 'duplicate_in_file', 'manager_self', 'manager_not_found', 'manager_loop']

const HEADER_ALIASES: Record<string, string> = {
  name: 'name', full_name: 'name', fullname: 'name', nama: 'name',
  email: 'email', 'e-mail': 'email',
  job_title: 'job_title', jobtitle: 'job_title', title: 'job_title', jabatan: 'job_title',
  manager_email: 'manager_email', manager: 'manager_email', atasan: 'manager_email', email_atasan: 'manager_email',
}

export function normalizeHeader(h: string): string {
  const k = h.trim().toLowerCase().replace(/\s+/g, '_')
  return HEADER_ALIASES[k] ?? k
}

export function validateImport(
  records: Record<string, string | undefined>[],
  existingEmails: Iterable<string>,
): ImportRow[] {
  const existing = new Set([...existingEmails].map((e) => e.toLowerCase()))
  const seen = new Set<string>()

  const rows: ImportRow[] = records.map((r, i) => {
    const row: ImportRow = {
      line: i + 2,
      name: (r.name ?? '').trim(),
      email: (r.email ?? '').trim().toLowerCase(),
      jobTitle: (r.job_title ?? '').trim(),
      managerEmail: (r.manager_email ?? '').trim().toLowerCase(),
      issues: [],
      importable: false,
    }
    if (!row.name) row.issues.push('missing_name')
    if (!EMAIL_RE.test(row.email)) row.issues.push('invalid_email')
    else if (seen.has(row.email)) row.issues.push('duplicate_in_file')
    else {
      seen.add(row.email)
      if (existing.has(row.email)) row.issues.push('exists')
    }
    if (row.managerEmail && row.managerEmail === row.email) row.issues.push('manager_self')
    return row
  })

  // Rows that will be created, keyed by email (first occurrence only).
  const newByEmail = new Map<string, ImportRow>()
  for (const r of rows) {
    if (!r.issues.some((c) => c === 'invalid_email' || c === 'duplicate_in_file' || c === 'exists')) {
      newByEmail.set(r.email, r)
    }
  }

  for (const r of rows) {
    if (!r.managerEmail || r.issues.includes('manager_self')) continue
    if (!existing.has(r.managerEmail) && !newByEmail.has(r.managerEmail)) {
      r.issues.push('manager_not_found')
    }
  }

  // Loops can only form among new rows (existing people never point at new ones).
  for (const r of newByEmail.values()) {
    if (r.issues.includes('manager_self')) continue
    const visited = new Set<string>([r.email])
    let cur = r.managerEmail
    while (cur && newByEmail.has(cur)) {
      if (visited.has(cur)) { r.issues.push('manager_loop'); break }
      visited.add(cur)
      cur = newByEmail.get(cur)!.managerEmail
    }
  }

  for (const r of rows) {
    r.importable = !r.issues.some((c) => BLOCKING.includes(c)) && !r.issues.includes('exists')
  }

  // A row whose manager is a new row that won't be imported can't get that manager.
  let changed = true
  while (changed) {
    changed = false
    for (const r of rows) {
      if (!r.importable || !r.managerEmail || existing.has(r.managerEmail)) continue
      const mgr = newByEmail.get(r.managerEmail)
      if (!mgr || !mgr.importable) {
        r.issues.push('manager_not_found')
        r.importable = false
        changed = true
      }
    }
  }

  return rows
}

export const CSV_TEMPLATE =
  'name,email,job_title,manager_email\n' +
  'Rina Santoso,rina@example.com,Head of Academics,\n' +
  'Dimas Pratama,dimas@example.com,Senior Tutor,rina@example.com\n' +
  'Ayu Lestari,ayu@example.com,Tutor,dimas@example.com\n'
