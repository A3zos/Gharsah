-- غَرْسة — pairing (replaces functions/src/pairing.ts + claim.ts). Transactional
-- SQL functions called ONLY by the Edge Functions (service role) after they
-- verified the caller's JWT; clients cannot execute them.

-- Codes live 10 minutes and are single-use (the demo code excepted, DEMO_MODE only).
create or replace function public.pairing_ttl()
returns interval language sql immutable set search_path = '' as $$ select interval '10 minutes' $$;

-- A fresh code for the parent's child (or the still-valid one unless p_revoke).
-- p_revoke also unpairs every device of that child.
create or replace function public.issue_pairing_code(p_parent uuid, p_child uuid, p_revoke boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cur record;
  c text;
  i int;
begin
  perform 1 from public.children where id = p_child and parent_id = p_parent for update;
  if not found then
    raise exception 'child-not-found' using errcode = 'P0002';
  end if;
  if public.active_plan(p_parent) = 'none' then
    raise exception 'no-active-subscription' using errcode = 'P0001';
  end if;
  select * into cur from public.pairing_codes
  where child_id = p_child and not revoked and claimed_at is null and not is_demo and expires_at > now()
  order by created_at desc limit 1;
  if not p_revoke and cur.code is not null then
    return jsonb_build_object('code', cur.code, 'expiresAt', cur.expires_at);
  end if;
  update public.pairing_codes set revoked = true
  where child_id = p_child and not is_demo and not revoked and claimed_at is null;
  if p_revoke then
    update public.child_sessions set revoked = true where child_id = p_child and not revoked;
  end if;
  for i in 1..20 loop
    c := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.pairing_codes p
      where p.code = c and (p.is_demo or (not p.revoked and p.claimed_at is null and p.expires_at > now())));
    c := null;
  end loop;
  if c is null then
    raise exception 'no-free-code' using errcode = 'P0001';
  end if;
  delete from public.pairing_codes where code = c; -- a dead row with the same digits
  insert into public.pairing_codes (code, parent_id, child_id, expires_at)
  values (c, p_parent, p_child, now() + public.pairing_ttl());
  return jsonb_build_object('code', c, 'expiresAt', now() + public.pairing_ttl());
end $$;

-- The anonymous device claims a code: 5 wrong codes / 10 min / device; one device per child.
create or replace function public.claim_pairing_code(p_device uuid, p_code text, p_demo_mode boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pc record;
  ch record;
  fails int;
begin
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception 'bad-code' using errcode = 'P0001';
  end if;
  select count(*) into fails from public.claim_attempts
  where device_uid = p_device and attempted_at > now() - interval '10 minutes';
  if fails >= 5 then
    raise exception 'too-many-attempts' using errcode = 'P0001';
  end if;
  select * into pc from public.pairing_codes where code = p_code for update;
  if pc.code is null
     or pc.revoked
     or (pc.is_demo and not p_demo_mode)
     or (not pc.is_demo and (pc.claimed_at is not null or pc.expires_at <= now())) then
    -- Counted even though the caller's transaction then fails: the Edge Function
    -- records the attempt separately (record_failed_claim).
    raise exception 'wrong-code' using errcode = 'P0002';
  end if;
  select * into ch from public.children where id = pc.child_id;
  if ch.id is null then
    raise exception 'wrong-code' using errcode = 'P0002';
  end if;
  if not pc.is_demo then
    -- One device per child (the demo code may be shared).
    update public.child_sessions set revoked = true
    where child_id = pc.child_id and device_uid <> p_device and not revoked;
    update public.pairing_codes set claimed_by = p_device, claimed_at = now() where code = p_code;
  end if;
  insert into public.child_sessions (device_uid, parent_id, child_id, paired_at, revoked)
  values (p_device, pc.parent_id, pc.child_id, now(), false)
  on conflict (device_uid) do update
    set parent_id = excluded.parent_id, child_id = excluded.child_id, paired_at = now(), revoked = false;
  -- What the child device learns — only what the child app needs.
  return jsonb_build_object(
    'parentId', pc.parent_id, 'childId', pc.child_id,
    'name', ch.name, 'avatar', ch.avatar, 'gender', ch.gender);
end $$;

create or replace function public.record_failed_claim(p_device uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.claim_attempts (device_uid) values (p_device)
$$;

-- The parent's view of a child's current code (the table itself stays server-only).
create or replace function public.child_pairing(p_child uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not public.is_parent_of(p_child) then null else jsonb_build_object(
    'code', p.code,
    'expiresAt', p.expires_at,
    'status', case when p.claimed_at is not null then 'claimed'
                   when p.revoked then 'revoked'
                   when p.expires_at <= now() then 'expired'
                   else 'active' end,
    'linked', exists (select 1 from public.child_sessions s where s.child_id = p_child and not s.revoked)
  ) end
  from public.pairing_codes p
  where p.child_id = p_child and not p.is_demo
  order by p.created_at desc limit 1
$$;

revoke execute on function public.issue_pairing_code(uuid, uuid, boolean),
  public.claim_pairing_code(uuid, text, boolean), public.record_failed_claim(uuid)
  from public, anon, authenticated;
revoke execute on function public.child_pairing(uuid) from public, anon;
grant execute on function public.child_pairing(uuid) to authenticated;
