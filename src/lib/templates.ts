import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type Statement = { id: string; position: number; body: string }
export type Competency = { id: string; position: number; name: string; description: string; statements: Statement[] }
export type Template = { id: string; name: string; created_at: string; competencies: Competency[] }

const sortByPos = <T extends { position: number }>(a: T[]) => [...a].sort((x, y) => x.position - y.position)

export function useTemplates(orgId: string | undefined) {
  return useQuery({
    queryKey: ['templates', orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Template[]> => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, created_at, competencies(id, position, name, description, statements(id, position, body))')
        .eq('org_id', orgId!)
        .order('created_at')
      if (error) throw error
      return (data as Template[]).map((t) => ({
        ...t,
        competencies: sortByPos(t.competencies).map((c) => ({ ...c, statements: sortByPos(c.statements) })),
      }))
    },
  })
}

export function useTemplate(orgId: string, id: string | undefined) {
  const q = useTemplates(orgId)
  return { ...q, data: q.data?.find((t) => t.id === id) }
}

/** All template edits go through one mutation that refreshes the list afterwards. */
export function useTemplateOps(orgId: string) {
  const qc = useQueryClient()
  const done = () => qc.invalidateQueries({ queryKey: ['templates', orgId] })
  // Called in a fixed order on every render, so the hook rules hold.
  const run = <A,>(fn: (a: A) => Promise<unknown>) => useMutation({ mutationFn: fn, onSettled: done })

  const check = ({ error }: { error: unknown }) => { if (error) throw error }

  return {
    createDefault: run(async (lang: string) => {
      const { data, error } = await supabase.rpc('create_default_template', { p_org: orgId, p_lang: lang })
      if (error) throw error
      return data as string
    }),
    createBlank: run(async (name: string) => {
      const { data, error } = await supabase.from('templates').insert({ org_id: orgId, name }).select('id').single()
      if (error) throw error
      return data.id as string
    }),
    renameTemplate: run(async ({ id, name }: { id: string; name: string }) =>
      check(await supabase.from('templates').update({ name }).eq('id', id))),
    deleteTemplate: run(async (id: string) => check(await supabase.from('templates').delete().eq('id', id))),

    addCompetency: run(async ({ templateId, position, name }: { templateId: string; position: number; name: string }) =>
      check(await supabase.from('competencies').insert({ template_id: templateId, position, name }))),
    updateCompetency: run(async ({ id, patch }: { id: string; patch: Partial<Pick<Competency, 'name' | 'description'>> }) =>
      check(await supabase.from('competencies').update(patch).eq('id', id))),
    deleteCompetency: run(async (id: string) => check(await supabase.from('competencies').delete().eq('id', id))),

    addStatement: run(async ({ competencyId, position, body }: { competencyId: string; position: number; body: string }) =>
      check(await supabase.from('statements').insert({ competency_id: competencyId, position, body }))),
    updateStatement: run(async ({ id, body }: { id: string; body: string }) =>
      check(await supabase.from('statements').update({ body }).eq('id', id))),
    deleteStatement: run(async (id: string) => check(await supabase.from('statements').delete().eq('id', id))),

    /** Swap the positions of two rows in the same table. */
    swap: run(async ({ table, a, b }: { table: 'competencies' | 'statements'; a: { id: string; position: number }; b: { id: string; position: number } }) => {
      // Positions may collide (e.g. both 0); fall back to index-based values supplied by the caller.
      check(await supabase.from(table).update({ position: b.position }).eq('id', a.id))
      check(await supabase.from(table).update({ position: a.position }).eq('id', b.id))
    }),
  }
}
