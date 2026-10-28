-- 0010 Ranking for a closed or released cycle.
-- Admins see every participant; managers see only the people they manage in that cycle; others get scope 'none'.
-- Same anonymity rules as get_report: peer and direct-report groups count only once they reach
-- min_raters, and the score is the average from everyone except the person themselves.
create or replace function public.cycle_ranking(p_cycle uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c        public.cycles;
  v_me     uuid;
  v_admin  boolean;
  v_scope  text;
  v_result jsonb;
begin
  select * into c from public.cycles where id = p_cycle;
  if not found then raise exception 'Cycle not found' using errcode = 'P0002'; end if;

  v_me := private.my_membership(c.org_id);
  if v_me is null then raise exception 'Not a member of this organization' using errcode = '42501'; end if;
  v_admin := private.is_org_admin(c.org_id);

  if v_admin then
    v_scope := 'org';
  elsif exists (select 1 from public.cycle_participants where cycle_id = p_cycle and manager_id = v_me) then
    v_scope := 'team';
  else
    return jsonb_build_object('scope', 'none');
  end if;

  if c.status not in ('closed', 'released') then
    return jsonb_build_object('scope', v_scope, 'available', false,
      'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'min_raters', c.min_raters));
  end if;

  with part as (
    select cp.reviewee_id
      from public.cycle_participants cp
     where cp.cycle_id = p_cycle and (v_admin or cp.manager_id = v_me)
  ),
  g as (
    select a.reviewee_id, a.relationship::text as rel,
           count(*) filter (where a.status = 'submitted') as sub
      from public.assignments a
      join part on part.reviewee_id = a.reviewee_id
     where a.cycle_id = p_cycle and a.status <> 'void'
     group by 1, 2
  ),
  vis as (
    select reviewee_id, rel, sub from g
     where case when rel in ('peer', 'direct_report') then sub >= c.min_raters else sub > 0 end
  ),
  othn as (
    select part.reviewee_id, coalesce(sum(vis.sub) filter (where vis.rel <> 'self'), 0)::int as n
      from part left join vis on vis.reviewee_id = part.reviewee_id
     group by 1
  ),
  stmt as (
    select (s ->> 'key')::uuid as sk, comp ->> 'key' as ck
      from jsonb_array_elements(c.template_snapshot -> 'competencies') comp,
           jsonb_array_elements(comp -> 'statements') s
  ),
  r as (
    select a.reviewee_id, a.relationship::text as rel, stmt.ck, rs.score
      from public.responses rs
      join public.assignments a on a.id = rs.assignment_id
      join vis on vis.reviewee_id = a.reviewee_id and vis.rel = a.relationship::text
      join stmt on stmt.sk = rs.statement_key
     where a.cycle_id = p_cycle and a.status = 'submitted' and rs.score is not null
  ),
  person as (
    select m.id, m.full_name, m.job_title, o.n as raters,
           case when o.n >= c.min_raters then
             (select round(avg(score)::numeric, 2) from r where r.reviewee_id = m.id and r.rel <> 'self') end as score,
           (select round(avg(score)::numeric, 2) from r where r.reviewee_id = m.id and r.rel = 'self') as self,
           case when o.n >= c.min_raters then
             (select jsonb_object_agg(ck, av) from (
                select ck, round(avg(score)::numeric, 2) as av from r
                 where r.reviewee_id = m.id and r.rel <> 'self' group by ck) q) end as by_comp
      from othn o
      join public.memberships m on m.id = o.reviewee_id
  )
  select jsonb_build_object(
    'scope', v_scope,
    'available', true,
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'min_raters', c.min_raters),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('key', comp ->> 'key', 'name', comp ->> 'name') order by ord)
        from jsonb_array_elements(c.template_snapshot -> 'competencies') with ordinality as x(comp, ord)), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'name', full_name, 'job_title', job_title, 'raters', raters,
               'score', score, 'self', self, 'by_comp', coalesce(by_comp, '{}'::jsonb))
             order by score desc nulls last, full_name)
        from person), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.cycle_ranking(uuid) from public, anon;
grant execute on function public.cycle_ranking(uuid) to authenticated;
