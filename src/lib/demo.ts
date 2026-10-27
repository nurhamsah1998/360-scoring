import { setCurrentOrgSlug } from './orgs'
import { supabase } from './supabase'

/** Public demo accounts. They only belong to the demo organization, which resets every day. */
export const DEMO_PASSWORD = 'demo-360-scoring'
export const DEMO_ORG_SLUG = 'northwind-demo'
export const DEMO_ROLES = ['admin', 'manager', 'employee'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export const DEMO_ACCOUNTS: Record<DemoRole, { email: string; name: string }> = {
  admin: { email: 'admin@demo.360scoring.app', name: 'Sari Wulandari' },
  manager: { email: 'manager@demo.360scoring.app', name: 'Bima Prasetyo' },
  employee: { email: 'employee@demo.360scoring.app', name: 'Laras Ayuningtyas' },
}

export const isDemoEmail = (email: string | undefined | null) => !!email?.endsWith('@demo.360scoring.app')

export function demoRoleOf(email: string | undefined | null): DemoRole | null {
  const hit = DEMO_ROLES.find((r) => DEMO_ACCOUNTS[r].email === email)
  return hit ?? null
}

export async function signInDemo(role: DemoRole) {
  await supabase.auth.signOut()
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role].email, password: DEMO_PASSWORD })
  if (error) throw error
  setCurrentOrgSlug(DEMO_ORG_SLUG)
}
