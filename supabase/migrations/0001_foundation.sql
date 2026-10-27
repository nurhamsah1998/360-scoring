-- 0001 Foundation: profiles, organizations, memberships + RLS

-- ── Profiles ────────────────────────────────────────────────
create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  locale     text not null default 'en' check (locale in ('en', 'id')),
  created_at timestamptz not null default now()
);

-- Create a profile automatically when a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'locale' = 'id' then 'id' else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Organizations ───────────────────────────────────────────
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  slug       text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- ── Memberships ─────────────────────────────────────────────
create type public.member_role   as enum ('admin', 'member');
create type public.member_status as enum ('invited', 'active', 'inactive');

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  role       public.member_role   not null default 'member',
  status     public.member_status not null default 'invited',
  job_title  text not null default '',
  manager_id uuid references public.memberships(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id),
  check (manager_id is null or manager_id <> id)
);

create index memberships_user_idx    on public.memberships (user_id);
create index memberships_manager_idx on public.memberships (manager_id);

-- ── Helper functions (bypass RLS to avoid recursive policies) ──
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and user_id = auth.uid()
      and status = 'active' and role = 'admin'
  );
$$;

-- Users who share at least one active organization with the caller.
create or replace function public.shares_org_with(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user
  );
$$;

-- ── Create organization (caller becomes admin) ──────────────
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  uuid;
  v_base text;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'org'; end if;
  v_slug := v_base || '-' || substr(md5(random()::text), 1, 6);

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_slug, auth.uid())
  returning id into v_org;

  insert into public.memberships (org_id, user_id, role, status)
  values (v_org, auth.uid(), 'admin', 'active');

  return v_org;
end;
$$;

revoke execute on function public.create_organization(text) from public, anon;
grant  execute on function public.create_organization(text) to authenticated;

-- ── Row Level Security ──────────────────────────────────────
alter table public.profiles      enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships   enable row level security;

-- profiles
create policy "profiles: read own or org-mates"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.shares_org_with(user_id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- organizations (insert only via create_organization)
create policy "organizations: members read"
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

create policy "organizations: admins update"
  on public.organizations for update to authenticated
  using (public.is_org_admin(id))
  with check (public.is_org_admin(id));

-- memberships
create policy "memberships: read own or same org"
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_member(org_id));

create policy "memberships: admins insert"
  on public.memberships for insert to authenticated
  with check (public.is_org_admin(org_id));

create policy "memberships: admins update"
  on public.memberships for update to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

create policy "memberships: admins delete"
  on public.memberships for delete to authenticated
  using (public.is_org_admin(org_id) and user_id is distinct from (select auth.uid()));
