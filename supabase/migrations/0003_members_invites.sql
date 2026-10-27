-- 0003 Members & invitations
-- A membership is created by email. It stays `invited` until the person with that
-- (confirmed) email accepts it, which links user_id and makes it `active`.

alter table public.memberships
  add column email     text not null default '',
  add column full_name text not null default '',
  add constraint memberships_email_lower check (email = lower(email));

alter table public.memberships alter column email drop default;
alter table public.memberships add constraint memberships_org_email_key unique (org_id, email);

-- ── Caller's verified email from the JWT ────────────────────
create or replace function private.jwt_email()
returns text
language sql
stable
set search_path = ''
as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function private.has_pending_invite(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where org_id = p_org and status = 'invited'
      and user_id is null and email = private.jwt_email() and email <> ''
  );
$$;

grant execute on function private.jwt_email()             to authenticated;
grant execute on function private.has_pending_invite(uuid) to authenticated;

-- ── RLS additions: invitees can see their invitation & its org ──
create policy "memberships: invitee reads own invite"
  on public.memberships for select to authenticated
  using (status = 'invited' and user_id is null and email = private.jwt_email());

create policy "organizations: invitee reads"
  on public.organizations for select to authenticated
  using (private.has_pending_invite(id));

-- Only pending invitations can be deleted; active people are deactivated instead.
alter policy "memberships: admins delete" on public.memberships
  using (private.is_org_admin(org_id) and status = 'invited');
alter policy "memberships: admins delete" on public.memberships
  rename to "memberships: admins delete invites";

-- ── create_organization now records email & name on the admin membership ──
create or replace function public.create_organization(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  uuid;
  v_base text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  if v_base = '' then v_base := 'org'; end if;

  insert into public.organizations (name, slug, created_by)
  values (trim(p_name), v_base || '-' || substr(md5(random()::text), 1, 6), auth.uid())
  returning id into v_org;

  select full_name into v_name from public.profiles where user_id = auth.uid();

  insert into public.memberships (org_id, user_id, role, status, email, full_name)
  values (v_org, auth.uid(), 'admin', 'active', private.jwt_email(), coalesce(v_name, ''));

  return v_org;
end;
$$;

-- ── Accept / decline ────────────────────────────────────────
create or replace function public.accept_invitation(p_membership uuid)
returns text  -- org slug
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org  uuid;
  v_slug text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select full_name into v_name from public.profiles where user_id = auth.uid();

  update public.memberships m
     set user_id   = auth.uid(),
         status    = 'active',
         full_name = case when m.full_name = '' then coalesce(v_name, '') else m.full_name end
   where m.id = p_membership
     and m.status = 'invited'
     and m.user_id is null
     and m.email = private.jwt_email()
     and m.email <> ''
  returning m.org_id into v_org;

  if v_org is null then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  select slug into v_slug from public.organizations where id = v_org;
  return v_slug;
end;
$$;

create or replace function public.decline_invitation(p_membership uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.memberships
   where id = p_membership and status = 'invited' and user_id is null
     and email = private.jwt_email() and email <> '';
  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.accept_invitation(uuid)  from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
grant  execute on function public.accept_invitation(uuid)  to authenticated;
grant  execute on function public.decline_invitation(uuid) to authenticated;

-- ── Integrity: manager in same org, no reporting loops, keep one admin ──
create or replace function private.check_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cursor uuid;
  v_depth  int := 0;
begin
  if tg_op = 'DELETE' then
    if old.role = 'admin' and old.status = 'active'
       and exists (select 1 from public.organizations where id = old.org_id)
       and not exists (
         select 1 from public.memberships
         where org_id = old.org_id and role = 'admin' and status = 'active' and id <> old.id
       ) then
      raise exception 'An organization needs at least one active admin' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if new.manager_id is not null then
    if not exists (select 1 from public.memberships where id = new.manager_id and org_id = new.org_id) then
      raise exception 'Manager must belong to the same organization' using errcode = 'P0001';
    end if;
    v_cursor := new.manager_id;
    while v_cursor is not null loop
      if v_cursor = new.id then
        raise exception 'This manager would create a reporting loop' using errcode = 'P0001';
      end if;
      v_depth := v_depth + 1;
      exit when v_depth > 500;
      select manager_id into v_cursor from public.memberships where id = v_cursor;
    end loop;
  end if;

  if tg_op = 'UPDATE'
     and old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active')
     and not exists (
       select 1 from public.memberships
       where org_id = old.org_id and role = 'admin' and status = 'active' and id <> old.id
     ) then
    raise exception 'An organization needs at least one active admin' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger memberships_integrity
  before insert or update or delete on public.memberships
  for each row execute function private.check_membership();

-- ── Service-role helper for the invite-members edge function ──
create or replace function public.admin_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;

revoke execute on function public.admin_user_id_by_email(text) from public, anon, authenticated;
grant  execute on function public.admin_user_id_by_email(text) to service_role;
