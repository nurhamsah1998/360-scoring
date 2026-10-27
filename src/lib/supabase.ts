import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
})

export const appUrl = (path: string) => `${window.location.origin}${path}`
