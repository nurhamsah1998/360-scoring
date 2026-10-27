import { createContext, useContext } from 'react'
import type { MyOrg } from './orgs'

export type OrgCtx = MyOrg & { isAdmin: boolean }

export const OrgContext = createContext<OrgCtx | null>(null)

export function useOrg(): OrgCtx {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used inside AppLayout')
  return ctx
}
