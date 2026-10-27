/**
 * Slim Supabase client: only Auth, the REST API (PostgREST) and Edge Functions.
 *
 * `@supabase/supabase-js` always bundles Realtime and Storage too, which this app never
 * uses (~270 kB of source on the first load). This wires the three pieces the same way
 * supabase-js does: same auth storage key (existing sessions keep working), the user's JWT
 * on every request, and the publishable key as `apikey`.
 */
import { AuthClient } from '@supabase/auth-js'
import { FunctionsClient } from '@supabase/functions-js'
import { PostgrestClient } from '@supabase/postgrest-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

const base = url.replace(/\/+$/, '')
const isNewKey = key.startsWith('sb_')

const auth = new AuthClient({
  url: `${base}/auth/v1`,
  headers: { apikey: key, Authorization: `Bearer ${key}` },
  storageKey: `sb-${new URL(base).hostname.split('.')[0]}-auth-token`,
  // Implicit flow: works for sign-up confirmation, password reset and admin invite links alike.
  flowType: 'implicit',
  detectSessionInUrl: true,
  persistSession: true,
  autoRefreshToken: true,
})

/** Adds the apikey and the signed-in user's token (or the key, where allowed) to each request. */
const authedFetch = (allowKeyAsBearer: boolean): typeof fetch => async (input, init) => {
  const { data } = await auth.getSession()
  const headers = new Headers(init?.headers)
  if (!headers.has('apikey')) headers.set('apikey', key)
  const bearer = data.session?.access_token ?? (allowKeyAsBearer ? key : null)
  if (bearer && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${bearer}`)
  return fetch(input, { ...init, headers })
}

const rest = new PostgrestClient(`${base}/rest/v1`, { fetch: authedFetch(true) })
const functions = new FunctionsClient(`${base}/functions/v1`, { customFetch: authedFetch(!isNewKey) })

export const supabase = {
  auth,
  functions,
  from: rest.from.bind(rest) as PostgrestClient['from'],
  rpc: rest.rpc.bind(rest) as PostgrestClient['rpc'],
}

export const appUrl = (path: string) => `${window.location.origin}${path}`
