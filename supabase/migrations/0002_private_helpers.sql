-- 0002 Move internal SECURITY DEFINER helpers out of the exposed `public` schema.
-- `private` is not exposed by PostgREST, so these can't be called via /rest/v1/rpc.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_org_member(uuid)   set schema private;
alter function public.is_org_admin(uuid)    set schema private;
alter function public.shares_org_with(uuid) set schema private;
alter function public.handle_new_user()     set schema private;

revoke execute on all functions in schema private from public, anon;
grant  execute on function private.is_org_member(uuid)   to authenticated;
grant  execute on function private.is_org_admin(uuid)    to authenticated;
grant  execute on function private.shares_org_with(uuid) to authenticated;

-- create_organization is an intended public RPC for signed-in users only.
revoke execute on function public.create_organization(text) from public, anon;
