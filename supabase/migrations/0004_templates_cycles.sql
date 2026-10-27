-- 0004 Templates, cycles, participants, nominations, assignments

create type public.cycle_status      as enum ('draft', 'nomination', 'review', 'closed', 'released');
create type public.relationship      as enum ('self', 'manager', 'peer', 'direct_report');
create type public.nomination_status as enum ('pending', 'approved', 'rejected');
create type public.assignment_status as enum ('pending', 'submitted', 'void');

-- ── Templates ───────────────────────────────────────────────
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create index templates_org_idx on public.templates (org_id);

create table public.competencies (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  position    int  not null default 0,
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300)
);
create index competencies_template_idx on public.competencies (template_id, position);

create table public.statements (
  id            uuid primary key default gen_random_uuid(),
  competency_id uuid not null references public.competencies(id) on delete cascade,
  position      int  not null default 0,
  body          text not null check (char_length(body) between 1 and 300)
);
create index statements_competency_idx on public.statements (competency_id, position);

-- ── Cycles ──────────────────────────────────────────────────
create table public.cycles (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations(id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 80),
  status             public.cycle_status not null default 'draft',
  template_id        uuid references public.templates(id) on delete set null,
  template_snapshot  jsonb,
  nomination_due     date,
  review_due         date,
  peer_min           int not null default 3 check (peer_min between 0 and 20),
  peer_max           int not null default 8 check (peer_max between 1 and 20),
  min_raters         int not null default 3 check (min_raters between 1 and 10),
  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  review_started_at  timestamptz,
  closed_at          timestamptz,
  released_at        timestamptz,
  check (peer_min <= peer_max)
);
create index cycles_org_idx on public.cycles (org_id, created_at desc);

create table public.cycle_participants (
  cycle_id    uuid not null references public.cycles(id) on delete cascade,
  reviewee_id uuid not null references public.memberships(id) on delete cascade,
  manager_id  uuid references public.memberships(id) on delete set null, -- snapshot at start
  primary key (cycle_id, reviewee_id)
);
create index cycle_participants_manager_idx on public.cycle_participants (manager_id);

create table public.nominations (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references public.cycles(id) on delete cascade,
  reviewee_id  uuid not null references public.memberships(id) on delete cascade,
  peer_id      uuid not null references public.memberships(id) on delete cascade,
  status       public.nomination_status not null default 'pending',
  nominated_by uuid references public.memberships(id) on delete set null,
  decided_by   uuid references public.memberships(id) on delete set null,
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (cycle_id, reviewee_id, peer_id),
  check (reviewee_id <> peer_id)
);
create index nominations_cycle_idx on public.nominations (cycle_id, reviewee_id);

create table public.assignments (
  id           uuid primary key default gen_random_uuid(),
  cycle_id     uuid not null references public.cycles(id) on delete cascade,
  reviewee_id  uuid not null references public.memberships(id) on delete cascade,
  reviewer_id  uuid not null references public.memberships(id) on delete cascade,
  relationship public.relationship not null,
  status       public.assignment_status not null default 'pending',
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (cycle_id, reviewee_id, reviewer_id)
);
create index assignments_reviewer_idx on public.assignments (reviewer_id, cycle_id);

-- ── Helpers ─────────────────────────────────────────────────
create or replace function private.my_membership(p_org uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.memberships
  where org_id = p_org and user_id = auth.uid() and status = 'active'
$$;

create or replace function private.template_org(p_template uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.templates where id = p_template
$$;

create or replace function private.competency_org(p_competency uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select t.org_id from public.competencies c join public.templates t on t.id = c.template_id where c.id = p_competency
$$;

create or replace function private.cycle_org(p_cycle uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select org_id from public.cycles where id = p_cycle
$$;

create or replace function private.cycle_status_of(p_cycle uuid)
returns public.cycle_status language sql stable security definer set search_path = '' as $$
  select status from public.cycles where id = p_cycle
$$;

create or replace function private.is_active_member_of(p_membership uuid, p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships where id = p_membership and org_id = p_org and status = 'active')
$$;

grant execute on function private.my_membership(uuid)            to authenticated;
grant execute on function private.template_org(uuid)             to authenticated;
grant execute on function private.competency_org(uuid)           to authenticated;
grant execute on function private.cycle_org(uuid)                to authenticated;
grant execute on function private.cycle_status_of(uuid)          to authenticated;
grant execute on function private.is_active_member_of(uuid, uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────
alter table public.templates          enable row level security;
alter table public.competencies       enable row level security;
alter table public.statements         enable row level security;
alter table public.cycles             enable row level security;
alter table public.cycle_participants enable row level security;
alter table public.nominations        enable row level security;
alter table public.assignments        enable row level security;

create policy "templates: members read"  on public.templates for select to authenticated using (private.is_org_member(org_id));
create policy "templates: admins insert" on public.templates for insert to authenticated with check (private.is_org_admin(org_id));
create policy "templates: admins update" on public.templates for update to authenticated using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
create policy "templates: admins delete" on public.templates for delete to authenticated using (private.is_org_admin(org_id));

create policy "competencies: members read"  on public.competencies for select to authenticated using (private.is_org_member(private.template_org(template_id)));
create policy "competencies: admins insert" on public.competencies for insert to authenticated with check (private.is_org_admin(private.template_org(template_id)));
create policy "competencies: admins update" on public.competencies for update to authenticated using (private.is_org_admin(private.template_org(template_id))) with check (private.is_org_admin(private.template_org(template_id)));
create policy "competencies: admins delete" on public.competencies for delete to authenticated using (private.is_org_admin(private.template_org(template_id)));

create policy "statements: members read"  on public.statements for select to authenticated using (private.is_org_member(private.competency_org(competency_id)));
create policy "statements: admins insert" on public.statements for insert to authenticated with check (private.is_org_admin(private.competency_org(competency_id)));
create policy "statements: admins update" on public.statements for update to authenticated using (private.is_org_admin(private.competency_org(competency_id))) with check (private.is_org_admin(private.competency_org(competency_id)));
create policy "statements: admins delete" on public.statements for delete to authenticated using (private.is_org_admin(private.competency_org(competency_id)));

create policy "cycles: members read started, admins read all"
  on public.cycles for select to authenticated
  using (private.is_org_admin(org_id) or (private.is_org_member(org_id) and status <> 'draft'));
create policy "cycles: admins insert drafts"
  on public.cycles for insert to authenticated
  with check (private.is_org_admin(org_id) and status = 'draft');
create policy "cycles: admins update"
  on public.cycles for update to authenticated
  using (private.is_org_admin(org_id)) with check (private.is_org_admin(org_id));
create policy "cycles: admins delete drafts"
  on public.cycles for delete to authenticated
  using (private.is_org_admin(org_id) and status = 'draft');

create policy "participants: members read"
  on public.cycle_participants for select to authenticated
  using (private.is_org_admin(private.cycle_org(cycle_id))
         or (private.is_org_member(private.cycle_org(cycle_id)) and private.cycle_status_of(cycle_id) <> 'draft'));
create policy "participants: admins add in draft"
  on public.cycle_participants for insert to authenticated
  with check (private.is_org_admin(private.cycle_org(cycle_id))
              and private.cycle_status_of(cycle_id) = 'draft'
              and private.is_active_member_of(reviewee_id, private.cycle_org(cycle_id)));
create policy "participants: admins remove in draft"
  on public.cycle_participants for delete to authenticated
  using (private.is_org_admin(private.cycle_org(cycle_id)) and private.cycle_status_of(cycle_id) = 'draft');

-- Nominations & assignments are written only through the RPCs below.
create policy "nominations: admin, reviewee or their manager read"
  on public.nominations for select to authenticated
  using (
    private.is_org_admin(private.cycle_org(cycle_id))
    or reviewee_id = private.my_membership(private.cycle_org(cycle_id))
    or exists (
      select 1 from public.cycle_participants p
      where p.cycle_id = nominations.cycle_id and p.reviewee_id = nominations.reviewee_id
        and p.manager_id = private.my_membership(private.cycle_org(nominations.cycle_id))
    )
  );

create policy "assignments: admin or reviewer read"
  on public.assignments for select to authenticated
  using (
    private.is_org_admin(private.cycle_org(cycle_id))
    or reviewer_id = private.my_membership(private.cycle_org(cycle_id))
  );

-- ── Cycle status & snapshot can only change through advance_cycle ──
create or replace function private.guard_cycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('app.cycle_transition', true), '') = 'on' then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Use advance_cycle to change a cycle''s stage' using errcode = 'P0001';
  end if;
  if old.status <> 'draft' and (new.template_id is distinct from old.template_id
                                or new.template_snapshot is distinct from old.template_snapshot) then
    raise exception 'The template can''t change after a cycle has started' using errcode = 'P0001';
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'A cycle can''t move to another organization' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger cycles_guard before update on public.cycles
  for each row execute function private.guard_cycle();

-- ── Default template ────────────────────────────────────────
create or replace function private.seed_default_template(p_org uuid, p_lang text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_t   uuid;
  v_c   uuid;
  v_id  boolean := p_lang = 'id';
  comp  jsonb;
  stmt  text;
  i     int := 0;
  j     int;
  v_content jsonb := case when p_lang = 'id' then
    '[
      {"name":"Komunikasi","description":"Menyampaikan dan menerima informasi dengan jelas.","statements":["Menyampaikan informasi dengan jelas dan tepat waktu.","Mendengarkan dengan saksama dan bertanya untuk memastikan pemahaman.","Menyesuaikan cara berkomunikasi dengan lawan bicara."]},
      {"name":"Kerja sama","description":"Bekerja bersama tim untuk mencapai tujuan bersama.","statements":["Bekerja sama dengan baik untuk mencapai tujuan bersama.","Menawarkan bantuan saat rekan membutuhkan.","Menangani perbedaan pendapat dengan saling menghormati."]},
      {"name":"Kepemimpinan","description":"Mengambil tanggung jawab dan menggerakkan orang lain.","statements":["Bertanggung jawab atas hasil kerjanya.","Memotivasi orang lain menuju tujuan bersama.","Memberi masukan yang berguna dan tepat waktu."]},
      {"name":"Pemecahan masalah","description":"Menemukan akar masalah dan menyelesaikannya.","statements":["Menemukan akar penyebab masalah.","Mempertimbangkan beberapa pilihan sebelum memutuskan.","Menuntaskan masalah sampai benar-benar selesai."]},
      {"name":"Integritas","description":"Jujur, konsisten, dan adil.","statements":["Menepati komitmen.","Jujur meskipun dalam situasi sulit.","Memperlakukan semua orang dengan adil dan hormat."]}
    ]'::jsonb
  else
    '[
      {"name":"Communication","description":"Shares and receives information clearly.","statements":["Shares information clearly and on time.","Listens actively and asks questions to check understanding.","Adapts how they communicate to their audience."]},
      {"name":"Collaboration","description":"Works with the team toward shared goals.","statements":["Works well with others to reach shared goals.","Offers help when teammates need it.","Handles disagreements respectfully."]},
      {"name":"Leadership","description":"Takes ownership and moves others forward.","statements":["Takes ownership of results.","Motivates others toward a common goal.","Gives useful, timely feedback."]},
      {"name":"Problem solving","description":"Finds root causes and resolves them.","statements":["Identifies the root cause of problems.","Considers several options before deciding.","Follows through until the problem is solved."]},
      {"name":"Integrity","description":"Honest, consistent and fair.","statements":["Keeps commitments.","Is honest even when it is difficult.","Treats everyone fairly and with respect."]}
    ]'::jsonb
  end;
begin
  insert into public.templates (org_id, name)
  values (p_org, case when v_id then 'Template bawaan' else 'Default template' end)
  returning id into v_t;

  for comp in select * from jsonb_array_elements(v_content) loop
    insert into public.competencies (template_id, position, name, description)
    values (v_t, i, comp ->> 'name', comp ->> 'description')
    returning id into v_c;
    j := 0;
    for stmt in select * from jsonb_array_elements_text(comp -> 'statements') loop
      insert into public.statements (competency_id, position, body) values (v_c, j, stmt);
      j := j + 1;
    end loop;
    i := i + 1;
  end loop;
  return v_t;
end;
$$;

create or replace function public.create_default_template(p_org uuid, p_lang text default 'en')
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_org_admin(p_org) then
    raise exception 'Only admins can create templates' using errcode = '42501';
  end if;
  return private.seed_default_template(p_org, p_lang);
end;
$$;

-- New organizations get the default template in the creator's language.
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org  uuid;
  v_base text;
  v_name text;
  v_lang text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'org'; end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_base || '-' || substr(md5(random()::text), 1, 6), auth.uid())
  returning id into v_org;

  select full_name, locale into v_name, v_lang from public.profiles where user_id = auth.uid();

  insert into public.memberships (org_id, user_id, role, status, email, full_name)
  values (v_org, auth.uid(), 'admin', 'active', private.jwt_email(), coalesce(v_name, ''));

  perform private.seed_default_template(v_org, coalesce(v_lang, 'en'));

  return v_org;
end;
$$;

-- ── Advance a cycle one stage ───────────────────────────────
create or replace function public.advance_cycle(p_cycle uuid)
returns public.cycle_status language plpgsql security definer set search_path = '' as $$
declare
  c        public.cycles;
  v_snap   jsonb;
  v_next   public.cycle_status;
begin
  select * into c from public.cycles where id = p_cycle for update;
  if not found then raise exception 'Cycle not found' using errcode = 'P0002'; end if;
  if not private.is_org_admin(c.org_id) then
    raise exception 'Only admins can change a cycle''s stage' using errcode = '42501';
  end if;

  perform set_config('app.cycle_transition', 'on', true);

  if c.status = 'draft' then
    if c.template_id is null then
      raise exception 'Choose a template first' using errcode = 'P0001';
    end if;
    select jsonb_build_object(
             'name', t.name,
             'competencies', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'key', cp.id, 'name', cp.name, 'description', cp.description,
                        'statements', (select coalesce(jsonb_agg(jsonb_build_object('key', s.id, 'body', s.body) order by s.position, s.body), '[]'::jsonb)
                                       from public.statements s where s.competency_id = cp.id))
                      order by cp.position, cp.name)
               from public.competencies cp
               where cp.template_id = t.id
                 and exists (select 1 from public.statements s where s.competency_id = cp.id)
             ), '[]'::jsonb))
      into v_snap
      from public.templates t where t.id = c.template_id;

    if v_snap is null or jsonb_array_length(v_snap -> 'competencies') = 0 then
      raise exception 'The template needs at least one skill with a statement' using errcode = 'P0001';
    end if;

    -- Only active members take part.
    delete from public.cycle_participants p
     using public.memberships m
     where p.cycle_id = c.id and m.id = p.reviewee_id and m.status <> 'active';
    if not exists (select 1 from public.cycle_participants where cycle_id = c.id) then
      raise exception 'Add at least one participant' using errcode = 'P0001';
    end if;

    -- Snapshot each participant's manager (if that manager is active).
    update public.cycle_participants p
       set manager_id = (select mm.id from public.memberships m
                          join public.memberships mm on mm.id = m.manager_id and mm.status = 'active'
                          where m.id = p.reviewee_id)
     where p.cycle_id = c.id;

    -- Automatic assignments: self, manager, direct reports.
    insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship)
    select c.id, p.reviewee_id, p.reviewee_id, 'self' from public.cycle_participants p where p.cycle_id = c.id
    on conflict do nothing;

    insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship)
    select c.id, p.reviewee_id, p.manager_id, 'manager' from public.cycle_participants p
     where p.cycle_id = c.id and p.manager_id is not null
    on conflict do nothing;

    insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship)
    select c.id, p.reviewee_id, m.id, 'direct_report'
      from public.cycle_participants p
      join public.memberships m on m.manager_id = p.reviewee_id and m.status = 'active'
     where p.cycle_id = c.id
    on conflict do nothing;

    update public.cycles set status = 'nomination', template_snapshot = v_snap, started_at = now() where id = c.id;
    v_next := 'nomination';

  elsif c.status = 'nomination' then
    insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship)
    select n.cycle_id, n.reviewee_id, n.peer_id, 'peer'
      from public.nominations n
      join public.memberships m on m.id = n.peer_id and m.status = 'active'
     where n.cycle_id = c.id and n.status = 'approved'
    on conflict do nothing;
    update public.cycles set status = 'review', review_started_at = now() where id = c.id;
    v_next := 'review';

  elsif c.status = 'review' then
    update public.cycles set status = 'closed', closed_at = now() where id = c.id;
    v_next := 'closed';

  elsif c.status = 'closed' then
    update public.cycles set status = 'released', released_at = now() where id = c.id;
    v_next := 'released';

  else
    raise exception 'This cycle is already released' using errcode = 'P0001';
  end if;

  return v_next;
end;
$$;

-- ── Nominations ─────────────────────────────────────────────
create or replace function public.nominate_peer(p_cycle uuid, p_reviewee uuid, p_peer uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c       public.cycles;
  v_me    uuid;
  v_admin boolean;
  v_mgr   uuid;
  v_count int;
  v_id    uuid;
begin
  select * into c from public.cycles where id = p_cycle;
  if not found then raise exception 'Cycle not found' using errcode = 'P0002'; end if;
  if c.status <> 'nomination' then raise exception 'Nominations are closed' using errcode = 'P0001'; end if;

  v_me := private.my_membership(c.org_id);
  v_admin := private.is_org_admin(c.org_id);
  if v_me is null or (v_me <> p_reviewee and not v_admin) then
    raise exception 'You can only nominate reviewers for yourself' using errcode = '42501';
  end if;

  select manager_id into v_mgr from public.cycle_participants where cycle_id = p_cycle and reviewee_id = p_reviewee;
  if not found then raise exception 'This person isn''t in the cycle' using errcode = 'P0001'; end if;

  if p_peer = p_reviewee then raise exception 'You can''t nominate yourself' using errcode = 'P0001'; end if;
  if not private.is_active_member_of(p_peer, c.org_id) then
    raise exception 'Only active members can be nominated' using errcode = 'P0001';
  end if;
  if p_peer = v_mgr or exists (select 1 from public.memberships where id = p_peer and manager_id = p_reviewee) then
    raise exception 'Managers and direct reports already review automatically' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.nominations
   where cycle_id = p_cycle and reviewee_id = p_reviewee and status <> 'rejected';
  if v_count >= c.peer_max then
    raise exception 'You''ve reached the maximum number of peers' using errcode = 'P0001';
  end if;

  insert into public.nominations (cycle_id, reviewee_id, peer_id, nominated_by, status, decided_by, decided_at)
  values (p_cycle, p_reviewee, p_peer, v_me,
          case when v_admin and v_me <> p_reviewee then 'approved'::public.nomination_status else 'pending' end,
          case when v_admin and v_me <> p_reviewee then v_me end,
          case when v_admin and v_me <> p_reviewee then now() end)
  on conflict (cycle_id, reviewee_id, peer_id) do update
    set status = case when excluded.status = 'approved' then 'approved'::public.nomination_status else 'pending' end,
        nominated_by = excluded.nominated_by, decided_by = excluded.decided_by, decided_at = excluded.decided_at
    where public.nominations.status = 'rejected'
  returning id into v_id;

  if v_id is null then raise exception 'Already nominated' using errcode = 'P0001'; end if;
  return v_id;
end;
$$;

create or replace function public.withdraw_nomination(p_nomination uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n public.nominations;
  c public.cycles;
begin
  select * into n from public.nominations where id = p_nomination;
  if not found then raise exception 'Nomination not found' using errcode = 'P0002'; end if;
  select * into c from public.cycles where id = n.cycle_id;
  if c.status <> 'nomination' then raise exception 'Nominations are closed' using errcode = 'P0001'; end if;
  if not (private.is_org_admin(c.org_id)
          or (n.reviewee_id = private.my_membership(c.org_id) and n.status = 'pending')) then
    raise exception 'You can''t remove this nomination' using errcode = '42501';
  end if;
  delete from public.nominations where id = p_nomination;
end;
$$;

create or replace function public.decide_nomination(p_nomination uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  n     public.nominations;
  c     public.cycles;
  v_me  uuid;
  v_mgr uuid;
begin
  select * into n from public.nominations where id = p_nomination;
  if not found then raise exception 'Nomination not found' using errcode = 'P0002'; end if;
  select * into c from public.cycles where id = n.cycle_id;
  if c.status <> 'nomination' then raise exception 'Nominations are closed' using errcode = 'P0001'; end if;

  v_me := private.my_membership(c.org_id);
  select manager_id into v_mgr from public.cycle_participants where cycle_id = n.cycle_id and reviewee_id = n.reviewee_id;
  if not (private.is_org_admin(c.org_id) or (v_me is not null and v_me = v_mgr)) then
    raise exception 'Only their manager or an admin can decide' using errcode = '42501';
  end if;

  update public.nominations
     set status = case when p_approve then 'approved'::public.nomination_status else 'rejected' end,
         decided_by = v_me, decided_at = now()
   where id = p_nomination;
end;
$$;

revoke execute on function public.create_default_template(uuid, text)    from public, anon;
revoke execute on function public.advance_cycle(uuid)                     from public, anon;
revoke execute on function public.nominate_peer(uuid, uuid, uuid)         from public, anon;
revoke execute on function public.withdraw_nomination(uuid)               from public, anon;
revoke execute on function public.decide_nomination(uuid, boolean)        from public, anon;
grant  execute on function public.create_default_template(uuid, text)    to authenticated;
grant  execute on function public.advance_cycle(uuid)                     to authenticated;
grant  execute on function public.nominate_peer(uuid, uuid, uuid)         to authenticated;
grant  execute on function public.withdraw_nomination(uuid)               to authenticated;
grant  execute on function public.decide_nomination(uuid, boolean)        to authenticated;
revoke execute on all functions in schema private from public, anon;
