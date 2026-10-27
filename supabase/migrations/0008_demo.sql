-- 0008 Public demo: flag, safeguards, seeded data and a daily reset.
-- Applied in steps 0008a–0008f. Demo logins share the password 'demo-360-scoring' (public by design);
-- the demo org can't send invite emails and demo accounts can't create organizations.

alter table public.organizations add column is_demo boolean not null default false;

create or replace function private.is_demo_user()
returns boolean language sql stable set search_path = '' as $$
  select private.jwt_email() like '%@demo.360scoring.app'
$$;
grant execute on function private.is_demo_user() to authenticated;

-- Demo accounts can't create extra organizations.
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
  if private.is_demo_user() then
    raise exception 'Demo accounts can''t create organizations. Sign up to create your own.' using errcode = '42501';
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

create or replace function private.demo_user(p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_pw text := 'demo-360-scoring';
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
            extensions.crypt(v_pw, extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"],"demo":true}'::jsonb,
            jsonb_build_object('full_name', p_name, 'locale', 'en'), now(), now(), '', '', '', '');
    insert into auth.identities (user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
            'email', now(), now(), now());
  else
    update auth.users
       set encrypted_password = extensions.crypt(v_pw, extensions.gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()),
           banned_until = null,
           raw_user_meta_data = jsonb_build_object('full_name', p_name, 'locale', 'en')
     where id = v_id;
  end if;
  update public.profiles set full_name = p_name, locale = 'en' where user_id = v_id;
  return v_id;
end;
$$;

create or replace function private.demo_score(p_seed text, p_base numeric)
returns smallint language sql immutable set search_path = '' as $$
  select greatest(1, least(5, round(p_base + ((abs(hashtext(p_seed)) % 5) - 2) * 0.35)))::smallint
$$;

revoke execute on function private.demo_user(text, text)    from public, anon, authenticated;
revoke execute on function private.demo_score(text, numeric) from public, anon, authenticated;

-- Build one demo cycle with participants, assignments, nominations and (where the stage calls for it) answers.
create or replace function private.demo_make_cycle(
  p_org uuid, p_tpl uuid, p_snap jsonb, p_name text, p_status public.cycle_status,
  p_participants text[], p_age_days int)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_cycle  uuid;
  v_start  timestamptz := now() - make_interval(days => p_age_days);
  p        record;
  a        record;
  s        record;
  v_base   numeric;
  v_bias   numeric;
  v_h      int;
  v_ci     int;
  v_i      int;
  v_bank   jsonb := '[
    ["Explains decisions clearly in team meetings.", "Weekly updates sometimes arrive late; a short Monday summary would help.", "Very patient when explaining lesson plans to new tutors."],
    ["Always willing to cover a class when someone is ill.", "Could involve the marketing team earlier when planning new courses.", "Shares materials generously with the whole team."],
    ["Could take the lead more often in department meetings.", "Gives clear, kind feedback after class observations.", "Keeps the team calm when deadlines get tight."],
    ["Finds practical fixes for timetable clashes quickly.", "Sometimes jumps to a solution before hearing everyone out.", "Good at spotting why students drop a course."],
    ["Always does what they say they will.", "Fair with every student, whatever their level.", "Honest about mistakes and quick to fix them."]
  ]'::jsonb;
begin
  insert into public.cycles (org_id, name, status, template_id, template_snapshot, nomination_due, review_due,
                             peer_min, peer_max, min_raters, created_at, started_at, review_started_at, closed_at, released_at)
  values (p_org, p_name, p_status, p_tpl,
          case when p_status = 'draft' then null else p_snap end,
          case when p_status = 'nomination' then current_date + 5 else (v_start + interval '7 days')::date end,
          case when p_status in ('nomination', 'review') then current_date + 14 else (v_start + interval '21 days')::date end,
          3, 6, 3, v_start - interval '2 days',
          case when p_status <> 'draft' then v_start end,
          case when p_status in ('review', 'closed', 'released') then v_start + interval '7 days' end,
          case when p_status in ('closed', 'released') then v_start + interval '22 days' end,
          case when p_status = 'released' then v_start + interval '25 days' end)
  returning id into v_cycle;

  insert into public.cycle_participants (cycle_id, reviewee_id, manager_id)
  select v_cycle, m.id, case when p_status = 'draft' then null else m.manager_id end
    from public.memberships m
   where m.org_id = p_org and m.email = any (p_participants);

  if p_status = 'draft' then return v_cycle; end if;

  -- Automatic reviewers: self, manager, direct reports.
  insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship, created_at)
  select v_cycle, cp.reviewee_id, cp.reviewee_id, 'self'::public.relationship, v_start from public.cycle_participants cp where cp.cycle_id = v_cycle
  union all
  select v_cycle, cp.reviewee_id, cp.manager_id, 'manager'::public.relationship, v_start from public.cycle_participants cp where cp.cycle_id = v_cycle and cp.manager_id is not null
  union all
  select v_cycle, cp.reviewee_id, m.id, 'direct_report'::public.relationship, v_start
    from public.cycle_participants cp join public.memberships m on m.manager_id = cp.reviewee_id and m.status = 'active'
   where cp.cycle_id = v_cycle;

  -- Three peers each, picked deterministically from people who aren't already reviewers.
  for p in select cp.reviewee_id, cp.manager_id from public.cycle_participants cp where cp.cycle_id = v_cycle loop
    v_i := 0;
    for a in
      select m.id from public.memberships m
       where m.org_id = p_org and m.status = 'active' and m.id <> p.reviewee_id
         and m.id is distinct from p.manager_id and m.manager_id is distinct from p.reviewee_id
       order by md5(m.id::text || v_cycle::text) limit 3
    loop
      v_i := v_i + 1;
      insert into public.nominations (cycle_id, reviewee_id, peer_id, nominated_by, status, decided_by, decided_at, created_at)
      values (v_cycle, p.reviewee_id, a.id, p.reviewee_id,
              -- In the nomination stage leave some waiting so the demo has approvals to do.
              (case when p_status = 'nomination' and v_i > 1 then 'pending' else 'approved' end)::public.nomination_status,
              case when p_status = 'nomination' and v_i > 1 then null else p.manager_id end,
              case when p_status = 'nomination' and v_i > 1 then null else v_start + interval '3 days' end,
              v_start + interval '1 day');
      if p_status <> 'nomination' then
        insert into public.assignments (cycle_id, reviewee_id, reviewer_id, relationship, created_at)
        values (v_cycle, p.reviewee_id, a.id, 'peer', v_start + interval '7 days')
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  if p_status = 'nomination' then return v_cycle; end if;

  -- Who has submitted: everyone in finished cycles; in a running cycle, most people without a
  -- demo login, but never the demo logins themselves (so the demo has reviews to fill in).
  update public.assignments x
     set status = 'submitted',
         submitted_at = v_start + make_interval(days => 8 + abs(hashtext(x.id::text)) % 10)
    from public.memberships r
   where x.cycle_id = v_cycle and r.id = x.reviewer_id
     and (p_status in ('closed', 'released')
          or (r.user_id is null and abs(hashtext(x.id::text)) % 10 < 8));

  -- Answers for submitted reviews.
  for a in
    select x.id, x.reviewee_id, x.relationship::text as rel
      from public.assignments x where x.cycle_id = v_cycle and x.status = 'submitted'
  loop
    v_bias := case a.rel when 'self' then 0.45 when 'manager' then -0.1 when 'direct_report' then 0.2 else 0 end;
    v_ci := 0;
    for s in
      select comp ->> 'key' as ck, st ->> 'key' as sk, ci
        from jsonb_array_elements(p_snap -> 'competencies') with ordinality as c(comp, ci),
             jsonb_array_elements(comp -> 'statements') st
    loop
      v_base := 3.1 + (abs(hashtext(a.reviewee_id::text || s.ck)) % 16) / 10.0 + v_bias;
      insert into public.responses (assignment_id, statement_key, score, updated_at)
      values (a.id, s.sk::uuid,
              case when a.rel <> 'self' and abs(hashtext(a.id::text || s.sk)) % 25 = 0 then null
                   else private.demo_score(a.id::text || s.sk, v_base) end,
              v_start + interval '9 days');
    end loop;

    v_h := abs(hashtext(a.id::text || 'comment'));
    if v_h % 3 <> 0 then
      v_ci := v_h % jsonb_array_length(p_snap -> 'competencies');
      insert into public.comments (assignment_id, competency_key, body, updated_at)
      values (a.id, (p_snap -> 'competencies' -> v_ci ->> 'key')::uuid,
              v_bank -> (v_ci % 5) ->> ((v_h / 7) % 3), v_start + interval '9 days');
    end if;
  end loop;

  return v_cycle;
end;
$$;

revoke execute on function private.demo_make_cycle(uuid, uuid, jsonb, text, public.cycle_status, text[], int) from public, anon, authenticated;

-- Wipe and rebuild the demo organization. Runs daily and can be run by hand.
create or replace function private.reset_demo()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org   uuid;
  v_tpl   uuid;
  v_snap  jsonb;
  u_admin uuid;
  u_mgr   uuid;
  u_emp   uuid;
  v_c     uuid;
begin
  delete from public.organizations where is_demo;

  u_admin := private.demo_user('admin@demo.360scoring.app', 'Sari Wulandari');
  u_mgr   := private.demo_user('manager@demo.360scoring.app', 'Bima Prasetyo');
  u_emp   := private.demo_user('employee@demo.360scoring.app', 'Laras Ayuningtyas');

  insert into public.organizations (name, slug, created_by, is_demo)
  values ('Northwind Language Institute', 'northwind-demo', u_admin, true)
  returning id into v_org;

  insert into public.memberships (org_id, user_id, email, full_name, job_title, role, status) values
    (v_org, u_admin, 'admin@demo.360scoring.app',    'Sari Wulandari',    'Director',            'admin',  'active'),
    (v_org, u_mgr,   'manager@demo.360scoring.app',  'Bima Prasetyo',     'Academic Manager',    'member', 'active'),
    (v_org, u_emp,   'employee@demo.360scoring.app', 'Laras Ayuningtyas', 'Senior Tutor',        'member', 'active'),
    (v_org, null, 'yoga@northwind.example',  'Yoga Pratama',   'Marketing Lead',      'member', 'active'),
    (v_org, null, 'mega@northwind.example',  'Mega Lestari',   'Operations Lead',     'member', 'active'),
    (v_org, null, 'dewa@northwind.example',  'Dewa Saputra',   'Tutor',               'member', 'active'),
    (v_org, null, 'intan@northwind.example', 'Intan Permata',  'Tutor',               'member', 'active'),
    (v_org, null, 'rafi@northwind.example',  'Rafi Hidayat',   'Tutor',               'member', 'active'),
    (v_org, null, 'nadia@northwind.example', 'Nadia Kusuma',   'Curriculum Designer', 'member', 'active'),
    (v_org, null, 'putri@northwind.example', 'Putri Maharani', 'Content Marketer',    'member', 'active'),
    (v_org, null, 'kevin@northwind.example', 'Kevin Santoso',  'Admissions Officer',  'member', 'active'),
    (v_org, null, 'eko@northwind.example',   'Eko Nugroho',    'Student Services',    'member', 'active'),
    (v_org, null, 'hana@northwind.example',  'Hana Wijaya',    'Tutor',               'member', 'invited');

  update public.memberships m
     set manager_id = mm.id
    from (values
      ('manager@demo.360scoring.app',  'admin@demo.360scoring.app'),
      ('yoga@northwind.example',       'admin@demo.360scoring.app'),
      ('mega@northwind.example',       'admin@demo.360scoring.app'),
      ('employee@demo.360scoring.app', 'manager@demo.360scoring.app'),
      ('dewa@northwind.example',       'manager@demo.360scoring.app'),
      ('intan@northwind.example',      'manager@demo.360scoring.app'),
      ('rafi@northwind.example',       'manager@demo.360scoring.app'),
      ('nadia@northwind.example',      'manager@demo.360scoring.app'),
      ('hana@northwind.example',       'manager@demo.360scoring.app'),
      ('putri@northwind.example',      'yoga@northwind.example'),
      ('kevin@northwind.example',      'yoga@northwind.example'),
      ('eko@northwind.example',        'mega@northwind.example')
    ) as rel(member_email, manager_email)
    join public.memberships mm on mm.org_id = v_org and mm.email = rel.manager_email
   where m.org_id = v_org and m.email = rel.member_email;

  v_tpl := private.seed_default_template(v_org, 'en');
  select jsonb_build_object('name', t.name, 'competencies', (
           select jsonb_agg(jsonb_build_object(
                    'key', cp.id, 'name', cp.name, 'description', cp.description,
                    'statements', (select jsonb_agg(jsonb_build_object('key', s.id, 'body', s.body) order by s.position)
                                     from public.statements s where s.competency_id = cp.id))
                  order by cp.position)
             from public.competencies cp where cp.template_id = t.id))
    into v_snap from public.templates t where t.id = v_tpl;

  perform private.demo_make_cycle(v_org, v_tpl, v_snap, 'H1 2026 review', 'released',
    array['employee@demo.360scoring.app', 'manager@demo.360scoring.app', 'dewa@northwind.example', 'intan@northwind.example', 'yoga@northwind.example'], 150);
  v_c := private.demo_make_cycle(v_org, v_tpl, v_snap, 'Q4 2026 review', 'review',
    array['employee@demo.360scoring.app', 'manager@demo.360scoring.app', 'rafi@northwind.example', 'nadia@northwind.example', 'putri@northwind.example'], 10);
  perform private.demo_make_cycle(v_org, v_tpl, v_snap, 'Cross-team pulse', 'nomination',
    array['employee@demo.360scoring.app', 'kevin@northwind.example', 'eko@northwind.example'], 2);
  perform private.demo_make_cycle(v_org, v_tpl, v_snap, 'Marketing pilot', 'draft',
    array['yoga@northwind.example', 'putri@northwind.example'], 0);

  -- A few notifications so the bell isn't empty.
  insert into public.notifications (user_id, org_id, type, payload, created_at, read_at)
  select u, v_org, t, p, now() - ago, case when is_read then now() end
    from (values
      (u_emp,   'review_open',        jsonb_build_object('cycle_id', v_c, 'cycle', 'Q4 2026 review'), interval '3 days',  false),
      (u_emp,   'report_released',    jsonb_build_object('cycle_id', (select id from public.cycles where org_id = v_org and status = 'released'), 'cycle', 'H1 2026 review'), interval '100 days', true),
      (u_emp,   'nomination_open',    jsonb_build_object('cycle_id', (select id from public.cycles where org_id = v_org and status = 'nomination'), 'cycle', 'Cross-team pulse'), interval '2 days', false),
      (u_mgr,   'review_open',        jsonb_build_object('cycle_id', v_c, 'cycle', 'Q4 2026 review'), interval '3 days',  false),
      (u_admin, 'review_open',        jsonb_build_object('cycle_id', v_c, 'cycle', 'Q4 2026 review'), interval '3 days',  false)
    ) as n(u, t, p, ago, is_read);
end;
$$;

revoke execute on function private.reset_demo() from public, anon, authenticated;

create extension if not exists pg_cron;
-- Every day at 20:00 UTC (03:00 WIB).
select cron.schedule('reset-demo', '0 20 * * *', 'select private.reset_demo()');
select private.reset_demo();
