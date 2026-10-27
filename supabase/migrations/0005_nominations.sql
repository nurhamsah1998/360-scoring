-- 0005 Nomination RPCs. Withdrawn nominations are kept with status 'withdrawn' (history), not deleted.
-- (The enum value must be committed before it is used, so it lives in its own statement/migration step.)

alter type public.nomination_status add value if not exists 'withdrawn';

create or replace function public.nominate_peer(p_cycle uuid, p_reviewee uuid, p_peer uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c       public.cycles;
  v_me    uuid;
  v_admin boolean;
  v_auto  boolean;
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
  v_auto := v_admin and v_me <> p_reviewee;  -- admin nominating for someone else: approved right away

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
   where cycle_id = p_cycle and reviewee_id = p_reviewee and status in ('pending', 'approved');
  if v_count >= c.peer_max then
    raise exception 'You''ve reached the maximum number of peers' using errcode = 'P0001';
  end if;

  insert into public.nominations (cycle_id, reviewee_id, peer_id, nominated_by, status, decided_by, decided_at)
  values (p_cycle, p_reviewee, p_peer, v_me,
          (case when v_auto then 'approved' else 'pending' end)::public.nomination_status,
          case when v_auto then v_me end,
          case when v_auto then now() end)
  on conflict (cycle_id, reviewee_id, peer_id) do update
    set status = excluded.status, nominated_by = excluded.nominated_by,
        decided_by = excluded.decided_by, decided_at = excluded.decided_at
    where public.nominations.status::text in ('rejected', 'withdrawn')
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
  update public.nominations
     set status = 'withdrawn'::text::public.nomination_status, decided_by = null, decided_at = now()
   where id = p_nomination;
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
  if n.status::text = 'withdrawn' then raise exception 'This nomination was withdrawn' using errcode = 'P0001'; end if;
  select * into c from public.cycles where id = n.cycle_id;
  if c.status <> 'nomination' then raise exception 'Nominations are closed' using errcode = 'P0001'; end if;

  v_me := private.my_membership(c.org_id);
  select manager_id into v_mgr from public.cycle_participants where cycle_id = n.cycle_id and reviewee_id = n.reviewee_id;
  if not (private.is_org_admin(c.org_id) or (v_me is not null and v_me = v_mgr)) then
    raise exception 'Only their manager or an admin can decide' using errcode = '42501';
  end if;

  update public.nominations
     set status = (case when p_approve then 'approved' else 'rejected' end)::public.nomination_status,
         decided_by = v_me, decided_at = now()
   where id = p_nomination;
end;
$$;

revoke execute on function public.nominate_peer(uuid, uuid, uuid)  from public, anon;
revoke execute on function public.withdraw_nomination(uuid)        from public, anon;
revoke execute on function public.decide_nomination(uuid, boolean) from public, anon;
grant  execute on function public.nominate_peer(uuid, uuid, uuid)  to authenticated;
grant  execute on function public.withdraw_nomination(uuid)        to authenticated;
grant  execute on function public.decide_nomination(uuid, boolean) to authenticated;
