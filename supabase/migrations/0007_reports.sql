-- 0007 Reports: anonymous aggregates for one participant in one cycle.
--
-- Access:  closed or released → org admins and the participant's manager (snapshot)
--          released            → the participant themselves
-- Privacy: only submitted reviews count. Peer and direct-report groups (scores and comments)
--          are left out entirely unless at least `min_raters` people in that group submitted.
--          "Others" combines the manager with the visible anonymous groups only, so a hidden
--          group can never be worked out by subtraction, and needs `min_raters` people too.
--          Comments carry their group but never their author, in a stable shuffled order.

create or replace function public.get_report(p_cycle uuid, p_reviewee uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c          public.cycles;
  v_me       uuid;
  v_admin    boolean;
  v_mgr      uuid;
  v_min      int;
  v_groups   jsonb;
  v_visible  text[];
  v_others_n int;
  v_result   jsonb;
begin
  select * into c from public.cycles where id = p_cycle;
  if not found then raise exception 'Cycle not found' using errcode = 'P0002'; end if;

  v_me := private.my_membership(c.org_id);
  if v_me is null then raise exception 'Not a member of this organization' using errcode = '42501'; end if;
  v_admin := private.is_org_admin(c.org_id);

  select manager_id into v_mgr from public.cycle_participants where cycle_id = p_cycle and reviewee_id = p_reviewee;
  if not found then raise exception 'This person isn''t in the cycle' using errcode = 'P0002'; end if;

  if not (
       (c.status in ('closed', 'released') and (v_admin or v_me = v_mgr))
    or (c.status = 'released' and v_me = p_reviewee)
  ) then
    raise exception 'This report isn''t available to you yet' using errcode = '42501';
  end if;

  v_min := c.min_raters;

  -- Group sizes and visibility.
  select coalesce(jsonb_object_agg(rel, jsonb_build_object(
           'total', total, 'submitted', submitted,
           'visible', case when rel in ('peer', 'direct_report') then submitted >= v_min else submitted > 0 end)), '{}'::jsonb),
         coalesce(array_agg(rel) filter (where case when rel in ('peer', 'direct_report') then submitted >= v_min else submitted > 0 end), '{}'),
         coalesce(sum(submitted) filter (where rel <> 'self' and case when rel in ('peer', 'direct_report') then submitted >= v_min else submitted > 0 end), 0)
    into v_groups, v_visible, v_others_n
    from (
      select relationship::text as rel, count(*) as total, count(*) filter (where status = 'submitted') as submitted
        from public.assignments
       where cycle_id = p_cycle and reviewee_id = p_reviewee and status <> 'void'
       group by 1
    ) g;

  with r as (
    select a.relationship::text as rel, rs.statement_key, rs.score
      from public.responses rs
      join public.assignments a on a.id = rs.assignment_id
     where a.cycle_id = p_cycle and a.reviewee_id = p_reviewee and a.status = 'submitted'
       and a.relationship::text = any (v_visible)
  ),
  comps as (
    select comp, ord
      from jsonb_array_elements(c.template_snapshot -> 'competencies') with ordinality as x(comp, ord)
  )
  select jsonb_build_object(
    'cycle', jsonb_build_object('id', c.id, 'name', c.name, 'status', c.status, 'min_raters', v_min),
    'reviewee', (select jsonb_build_object('id', m.id, 'name', m.full_name, 'email', m.email, 'job_title', m.job_title)
                   from public.memberships m where m.id = p_reviewee),
    'groups', v_groups,
    'others_n', v_others_n,
    'others_visible', v_others_n >= v_min,
    'overall', jsonb_build_object(
      'by_group', coalesce((select jsonb_object_agg(rel, av) from (
                    select rel, round(avg(score)::numeric, 2) as av from r where score is not null group by rel) s), '{}'::jsonb),
      'others', case when v_others_n >= v_min
                     then (select round(avg(score)::numeric, 2) from r where rel <> 'self' and score is not null) end),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', comp ->> 'key',
               'name', comp ->> 'name',
               'description', comp ->> 'description',
               'by_group', coalesce((select jsonb_object_agg(rel, av) from (
                             select rel, round(avg(score)::numeric, 2) as av from r
                              where score is not null
                                and statement_key in (select (s ->> 'key')::uuid from jsonb_array_elements(comp -> 'statements') s)
                              group by rel) q), '{}'::jsonb),
               'others', case when v_others_n >= v_min then (
                             select round(avg(score)::numeric, 2) from r
                              where rel <> 'self' and score is not null
                                and statement_key in (select (s ->> 'key')::uuid from jsonb_array_elements(comp -> 'statements') s)) end,
               'statements', (
                 select coalesce(jsonb_agg(jsonb_build_object(
                          'key', s ->> 'key',
                          'body', s ->> 'body',
                          'by_group', coalesce((select jsonb_object_agg(rel, av) from (
                                        select rel, round(avg(score)::numeric, 2) as av from r
                                         where score is not null and statement_key = (s ->> 'key')::uuid
                                         group by rel) q2), '{}'::jsonb),
                          'others', case when v_others_n >= v_min then (
                                        select round(avg(score)::numeric, 2) from r
                                         where rel <> 'self' and score is not null and statement_key = (s ->> 'key')::uuid) end,
                          'na', (select count(*) from r where rel <> 'self' and score is null and statement_key = (s ->> 'key')::uuid)
                        ) order by so), '[]'::jsonb)
                   from jsonb_array_elements(comp -> 'statements') with ordinality as y(s, so))
             ) order by ord)
        from comps), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object('competency_key', cm.competency_key, 'group', a.relationship, 'body', cm.body)
                       order by cm.competency_key, a.relationship, md5(cm.body || p_reviewee::text))
        from public.comments cm
        join public.assignments a on a.id = cm.assignment_id
       where a.cycle_id = p_cycle and a.reviewee_id = p_reviewee and a.status = 'submitted'
         and a.relationship::text = any (v_visible) and cm.body <> ''), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_report(uuid, uuid) from public, anon;
grant  execute on function public.get_report(uuid, uuid) to authenticated;
