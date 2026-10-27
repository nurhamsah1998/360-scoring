-- 0006 Reviews (responses, comments, draft/submit RPCs) and in-app notifications.
-- Applied to the project in three steps: 0006a_responses_comments, 0006b_review_rpcs, 0006c_notifications.

-- ── Responses & comments ────────────────────────────────────
create table public.responses (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  statement_key uuid not null,
  score         smallint check (score between 1 and 5),  -- null = "not able to rate"
  updated_at    timestamptz not null default now(),
  primary key (assignment_id, statement_key)
);

create table public.comments (
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  competency_key uuid not null,
  body           text not null default '' check (char_length(body) <= 2000),
  updated_at     timestamptz not null default now(),
  primary key (assignment_id, competency_key)
);

create or replace function private.is_my_assignment(p_assignment uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.assignments a
    join public.memberships m on m.id = a.reviewer_id
    where a.id = p_assignment and m.user_id = auth.uid() and m.status = 'active'
  )
$$;
grant execute on function private.is_my_assignment(uuid) to authenticated;

alter table public.responses enable row level security;
alter table public.comments  enable row level security;

-- Raw answers are visible only to the person who wrote them. Nobody else, admins included.
create policy "responses: reviewer reads own" on public.responses for select to authenticated
  using (private.is_my_assignment(assignment_id));
create policy "comments: reviewer reads own" on public.comments for select to authenticated
  using (private.is_my_assignment(assignment_id));

-- ── Review RPCs ─────────────────────────────────────────────
create or replace function private.assert_can_review(p_assignment uuid)
returns public.cycles language plpgsql stable security definer set search_path = '' as $$
declare
  a public.assignments;
  c public.cycles;
begin
  select * into a from public.assignments where id = p_assignment;
  if not found then raise exception 'Review not found' using errcode = 'P0002'; end if;
  select * into c from public.cycles where id = a.cycle_id;
  if a.reviewer_id is distinct from private.my_membership(c.org_id) then
    raise exception 'This isn''t your review' using errcode = '42501';
  end if;
  if c.status <> 'review' then raise exception 'Reviews are closed for this cycle' using errcode = 'P0001'; end if;
  if a.status <> 'pending' then raise exception 'This review was already submitted' using errcode = 'P0001'; end if;
  return c;
end;
$$;

create or replace function public.save_review_draft(p_assignment uuid, p_scores jsonb default '{}'::jsonb, p_comments jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c        public.cycles;
  v_stmts  uuid[];
  v_comps  uuid[];
  k        text;
  v        jsonb;
  t        text;
  v_score  smallint;
begin
  c := private.assert_can_review(p_assignment);

  select coalesce(array_agg((s ->> 'key')::uuid), '{}') into v_stmts
    from jsonb_array_elements(c.template_snapshot -> 'competencies') comp,
         jsonb_array_elements(comp -> 'statements') s;
  select coalesce(array_agg((comp ->> 'key')::uuid), '{}') into v_comps
    from jsonb_array_elements(c.template_snapshot -> 'competencies') comp;

  for k, v in select * from jsonb_each(coalesce(p_scores, '{}'::jsonb)) loop
    if not (k::uuid = any (v_stmts)) then raise exception 'Unknown statement' using errcode = 'P0001'; end if;
    if jsonb_typeof(v) = 'null' then
      v_score := null;
    elsif jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric in (1, 2, 3, 4, 5) then
      v_score := (v #>> '{}')::smallint;
    else
      raise exception 'Scores must be 1 to 5, or empty for "not able to rate"' using errcode = 'P0001';
    end if;
    insert into public.responses (assignment_id, statement_key, score, updated_at)
    values (p_assignment, k::uuid, v_score, now())
    on conflict (assignment_id, statement_key) do update set score = excluded.score, updated_at = now();
  end loop;

  for k, t in select * from jsonb_each_text(coalesce(p_comments, '{}'::jsonb)) loop
    if not (k::uuid = any (v_comps)) then raise exception 'Unknown skill' using errcode = 'P0001'; end if;
    insert into public.comments (assignment_id, competency_key, body, updated_at)
    values (p_assignment, k::uuid, left(trim(coalesce(t, '')), 2000), now())
    on conflict (assignment_id, competency_key) do update set body = excluded.body, updated_at = now();
  end loop;
end;
$$;

create or replace function public.submit_review(p_assignment uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c         public.cycles;
  v_missing int;
begin
  c := private.assert_can_review(p_assignment);

  select count(*) into v_missing
    from jsonb_array_elements(c.template_snapshot -> 'competencies') comp,
         jsonb_array_elements(comp -> 'statements') s
   where not exists (
     select 1 from public.responses r
      where r.assignment_id = p_assignment and r.statement_key = (s ->> 'key')::uuid
   );
  if v_missing > 0 then
    raise exception 'Answer every statement before submitting (% left)', v_missing using errcode = 'P0001';
  end if;

  update public.assignments set status = 'submitted', submitted_at = now() where id = p_assignment;
end;
$$;

revoke execute on function public.save_review_draft(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.submit_review(uuid)                   from public, anon;
grant  execute on function public.save_review_draft(uuid, jsonb, jsonb) to authenticated;
grant  execute on function public.submit_review(uuid)                   to authenticated;
grant  execute on function private.assert_can_review(uuid)              to authenticated;

-- ── Notifications ───────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  org_id     uuid not null references public.organizations(id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "notifications: read own" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
$$;
revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant  execute on function public.mark_notifications_read(uuid[]) to authenticated;

create or replace function private.notify_cycle_stage()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_payload jsonb := jsonb_build_object('cycle_id', new.id, 'cycle', new.name);
begin
  if new.status = old.status then return new; end if;

  if new.status in ('nomination', 'released') then
    insert into public.notifications (user_id, org_id, type, payload)
    select distinct m.user_id, new.org_id,
           case when new.status = 'nomination' then 'nomination_open' else 'report_released' end, v_payload
      from public.cycle_participants p
      join public.memberships m on m.id = p.reviewee_id and m.status = 'active' and m.user_id is not null
     where p.cycle_id = new.id;
  elsif new.status = 'review' then
    insert into public.notifications (user_id, org_id, type, payload)
    select distinct m.user_id, new.org_id, 'review_open', v_payload
      from public.assignments a
      join public.memberships m on m.id = a.reviewer_id and m.status = 'active' and m.user_id is not null
     where a.cycle_id = new.id and a.status = 'pending';
  end if;
  return new;
end;
$$;

create trigger cycles_notify after update of status on public.cycles
  for each row execute function private.notify_cycle_stage();

create or replace function private.notify_nomination()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  c      public.cycles;
  v_user uuid;
  v_name text;
begin
  select * into c from public.cycles where id = new.cycle_id;
  select full_name into v_name from public.memberships where id = new.reviewee_id;

  -- A participant nominated a peer: tell their manager there's something to approve.
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select m.user_id into v_user
      from public.cycle_participants p
      join public.memberships m on m.id = p.manager_id and m.status = 'active'
     where p.cycle_id = new.cycle_id and p.reviewee_id = new.reviewee_id;
    if v_user is not null then
      insert into public.notifications (user_id, org_id, type, payload)
      values (v_user, c.org_id, 'nomination_pending',
              jsonb_build_object('cycle_id', c.id, 'cycle', c.name, 'reviewee', v_name));
    end if;
  end if;

  -- A manager or admin decided: tell the participant.
  if tg_op = 'UPDATE' and new.status::text in ('approved', 'rejected') and old.status is distinct from new.status then
    select user_id into v_user from public.memberships where id = new.reviewee_id and status = 'active';
    if v_user is not null then
      insert into public.notifications (user_id, org_id, type, payload)
      values (v_user, c.org_id, 'nomination_decided',
              jsonb_build_object('cycle_id', c.id, 'cycle', c.name, 'status', new.status,
                                 'peer', (select full_name from public.memberships where id = new.peer_id)));
    end if;
  end if;
  return new;
end;
$$;

create trigger nominations_notify after insert or update of status on public.nominations
  for each row execute function private.notify_nomination();
