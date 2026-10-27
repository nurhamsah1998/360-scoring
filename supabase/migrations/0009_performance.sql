-- 0009 Performance pass (Supabase advisors + query review)

-- 1. Cover every foreign key with an index (joins, RLS lookups, cascading deletes).
create index if not exists assignments_reviewee_idx on public.assignments (reviewee_id);
create index if not exists cycle_participants_reviewee_idx on public.cycle_participants (reviewee_id);
create index if not exists cycles_template_idx on public.cycles (template_id);
create index if not exists nominations_reviewee_idx on public.nominations (reviewee_id);
create index if not exists nominations_peer_idx on public.nominations (peer_id);
create index if not exists nominations_nominated_by_idx on public.nominations (nominated_by);
create index if not exists nominations_decided_by_idx on public.nominations (decided_by) where decided_by is not null;
create index if not exists notifications_org_idx on public.notifications (org_id);
create index if not exists organizations_created_by_idx on public.organizations (created_by);

-- 2. (cycle_id, reviewee_id) is already the leading part of the unique (cycle_id, reviewee_id, peer_id) index.
drop index if exists public.nominations_cycle_idx;

-- 3. One permissive SELECT policy per table instead of two.
alter policy "memberships: read own or same org" on public.memberships
  using (
    user_id = (select auth.uid())
    or private.is_org_member(org_id)
    or (status = 'invited' and user_id is null and email = (select private.jwt_email()))
  );
drop policy if exists "memberships: invitee reads own invite" on public.memberships;

alter policy "organizations: members read" on public.organizations
  using (private.is_org_member(id) or private.has_pending_invite(id));
drop policy if exists "organizations: invitee reads" on public.organizations;

-- 4. Dashboard tasks in one round trip (was 5 requests, 2 of them sequential, and it read
--    every nomination of every running cycle). SECURITY INVOKER: RLS applies as before.
create or replace function public.my_tasks(p_org uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with me as (
    select private.my_membership(p_org) as id
  ),
  c as (
    select id, name, status, peer_min, nomination_due, review_due, created_at
      from public.cycles
     where org_id = p_org and status in ('nomination', 'review', 'released')
  ),
  t as (
    select c.created_at, 1 as ord, jsonb_build_object(
             'kind', 'nominate', 'cycleId', c.id, 'cycle', c.name, 'count', n.cnt,
             'min', c.peer_min, 'due', c.nomination_due) as task
      from c cross join me
      join public.cycle_participants p on p.cycle_id = c.id and p.reviewee_id = me.id
      cross join lateral (
        select count(*)::int as cnt from public.nominations x
         where x.cycle_id = c.id and x.reviewee_id = me.id and x.status in ('pending', 'approved')
      ) n
     where c.status = 'nomination' and n.cnt < c.peer_min
    union all
    select c.created_at, 2, jsonb_build_object(
             'kind', 'approve', 'cycleId', c.id, 'cycle', c.name, 'count', w.cnt, 'due', c.nomination_due)
      from c cross join me
      cross join lateral (
        select count(*)::int as cnt
          from public.nominations x
          join public.cycle_participants p on p.cycle_id = x.cycle_id and p.reviewee_id = x.reviewee_id
         where x.cycle_id = c.id and x.status = 'pending' and p.manager_id = me.id
      ) w
     where c.status = 'nomination' and w.cnt > 0
    union all
    select c.created_at, 3, jsonb_build_object(
             'kind', 'review', 'cycleId', c.id, 'cycle', c.name, 'count', a.cnt, 'due', c.review_due)
      from c cross join me
      cross join lateral (
        select count(*)::int as cnt from public.assignments x
         where x.cycle_id = c.id and x.reviewer_id = me.id and x.status = 'pending'
      ) a
     where c.status = 'review' and a.cnt > 0
    union all
    select c.created_at, 4, jsonb_build_object(
             'kind', 'report', 'cycleId', c.id, 'cycle', c.name, 'revieweeId', me.id, 'due', null)
      from c cross join me
      join public.cycle_participants p on p.cycle_id = c.id and p.reviewee_id = me.id
     where c.status = 'released'
  )
  select coalesce(jsonb_agg(task order by created_at desc, ord), '[]'::jsonb) from t
$$;

revoke execute on function public.my_tasks(uuid) from public, anon;
grant execute on function public.my_tasks(uuid) to authenticated;
