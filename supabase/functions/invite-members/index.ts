// invite-members: add people to an organization by email (single add or CSV batch),
// set their managers, and send Supabase invite emails to people without an account.
// Only active admins of the organization may call it.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type InRow = { name?: string; email?: string; jobTitle?: string; managerEmail?: string }
type Body = { orgId?: string; members?: InRow[]; redirectTo?: string; resendOnly?: boolean }

type OutRow = {
  email: string
  status: 'created' | 'exists' | 'invalid' | 'error'
  error?: string
  managerError?: string
  emailSent: boolean
  emailNote?: 'existing_account' | 'send_failed' | 'skipped'
  emailError?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ROWS = 500

const json = (status: number, data: unknown) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ── Who is calling, and are they an admin of this org? ──
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) return json(401, { error: 'Not signed in' })
  const caller = userData.user

  let body: Body
  try { body = await req.json() } catch { return json(400, { error: 'Invalid JSON' }) }
  const orgId = body.orgId
  const rows = Array.isArray(body.members) ? body.members : []
  if (!orgId) return json(400, { error: 'orgId is required' })
  if (rows.length === 0) return json(400, { error: 'No members to add' })
  if (rows.length > MAX_ROWS) return json(400, { error: `At most ${MAX_ROWS} rows per import` })

  const { data: me } = await admin
    .from('memberships')
    .select('id')
    .eq('org_id', orgId).eq('user_id', caller.id).eq('role', 'admin').eq('status', 'active')
    .maybeSingle()
  if (!me) return json(403, { error: 'Only organization admins can add members' })

  const redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined

  // ── Normalize & validate ──
  const seen = new Set<string>()
  const out: OutRow[] = []
  const clean: { name: string; email: string; jobTitle: string; managerEmail: string; idx: number }[] = []
  rows.forEach((r) => {
    const email = String(r.email ?? '').trim().toLowerCase()
    const row: OutRow = { email, status: 'invalid', emailSent: false }
    out.push(row)
    if (!EMAIL_RE.test(email)) { row.error = 'invalid_email'; return }
    if (seen.has(email)) { row.error = 'duplicate_in_file'; return }
    seen.add(email)
    clean.push({
      name: String(r.name ?? '').trim().slice(0, 120),
      email,
      jobTitle: String(r.jobTitle ?? '').trim().slice(0, 120),
      managerEmail: String(r.managerEmail ?? '').trim().toLowerCase(),
      idx: out.length - 1,
    })
  })

  // ── Existing members ──
  const { data: existing, error: exErr } = await admin
    .from('memberships').select('id, email, status, user_id').eq('org_id', orgId)
  if (exErr) return json(500, { error: exErr.message })
  const byEmail = new Map(existing!.map((m) => [m.email, m]))

  // Resend mode: only re-send invite emails for people still invited.
  if (body.resendOnly) {
    for (const c of clean) {
      const row = out[c.idx]
      const m = byEmail.get(c.email)
      if (!m || m.status !== 'invited') { row.status = 'error'; row.error = 'not_pending'; continue }
      row.status = 'exists'
      await sendInvite(c.email, c.name, row)
    }
    return json(200, { results: out })
  }

  const toCreate = clean.filter((c) => {
    if (byEmail.has(c.email)) { out[c.idx].status = 'exists'; out[c.idx].emailNote = 'skipped'; return false }
    return true
  })

  if (toCreate.length > 0) {
    const { data: created, error: insErr } = await admin
      .from('memberships')
      .insert(toCreate.map((c) => ({
        org_id: orgId, email: c.email, full_name: c.name, job_title: c.jobTitle, status: 'invited', role: 'member',
      })))
      .select('id, email, status, user_id')
    if (insErr) return json(500, { error: insErr.message })
    for (const m of created!) byEmail.set(m.email, m)
    for (const c of toCreate) out[c.idx].status = 'created'
  }

  // ── Managers (row by row so one bad row doesn't block the rest) ──
  for (const c of toCreate) {
    if (!c.managerEmail) continue
    const mgr = byEmail.get(c.managerEmail)
    const self = byEmail.get(c.email)!
    if (!mgr) { out[c.idx].managerError = 'manager_not_found'; continue }
    const { error } = await admin.from('memberships').update({ manager_id: mgr.id }).eq('id', self.id)
    if (error) out[c.idx].managerError = error.message.includes('loop') ? 'manager_loop' : error.message
  }

  // ── Invite emails ──
  for (const c of toCreate) await sendInvite(c.email, c.name, out[c.idx])

  return json(200, { results: out })

  async function sendInvite(email: string, name: string, row: OutRow) {
    const { data: uid } = await admin.rpc('admin_user_id_by_email', { p_email: email })
    if (uid) {
      // Confirmed account? They'll see the invitation in the app. Unconfirmed (earlier invite)? Re-send.
      const { data: u } = await admin.auth.admin.getUserById(uid as string)
      if (u?.user?.email_confirmed_at || u?.user?.last_sign_in_at) {
        row.emailNote = 'existing_account'
        return
      }
    }
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: name },
    })
    if (error) {
      row.emailNote = 'send_failed'
      row.emailError = (error as { code?: string }).code ?? error.message
    } else {
      row.emailSent = true
    }
  }
})
