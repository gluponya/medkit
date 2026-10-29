-- Fixes to the shared-cabinet functions (20261024120000_shared_cabinets.sql)
-- and to signing in (20261029150000_merge_account.sql):
--
-- 1. role_in() is null for someone not in the cabinet, and `null not in (...)`
--    is null, so a check written that way never refused anyone: anyone signed
--    in who knew a cabinet's id could invite, change roles, take people out and
--    write its medicines. Every check now treats "not a member" as refused.
-- 2. peek_invite gave an expired code's cabinet away; now an expired code says
--    only that it is expired, unless the person is in the cabinet already.
-- 3. A count taken off a pack nobody counted (quantity null) left it at 0; it
--    stays null.
-- 4. Counts are numeric, not int: a dose can be 2.5 tablets, and the phone
--    keeps the count as a real number.
-- 5. merge_account no longer takes the anonymous user's memberships away, and
--    the sign-in function no longer deletes it at once: the phone may still
--    fail to open the account's session, and its anonymous session must then
--    keep every cabinet. The phone confirms with the account's session, and
--    only then is the anonymous user deleted (account_merges, sign-in "forget").

-- ─── counts are numeric ──────────────────────────────────────────────────────

alter table public.packages  alter column quantity            type numeric using quantity::numeric;
alter table public.medicines alter column low_stock_threshold type numeric using low_stock_threshold::numeric;

-- ─── push_change ─────────────────────────────────────────────────────────────

create or replace function public.push_change(
  change_id text,
  entity    text,
  row_id    text,
  op        text,
  payload   jsonb,
  edited_at timestamptz
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me       uuid := auth.uid();
  stamp    timestamptz := least(edited_at, now());
  fresh    int;
  cabinet  text;
  role     text;
  times    jsonb;
  field    text;
  sets     text[] := array[]::text[];
  stamps   jsonb := '{}'::jsonb;
  key_med  text;
  key_cat  text;
  moved_to text;
begin
  if me is null then raise exception 'push_change: not signed in'; end if;
  if entity not in ('cabinets', 'medicines', 'packages', 'medicine_categories', 'custom_categories') then
    raise exception 'push_change: % is not written from phones', entity;
  end if;
  if op not in ('insert', 'update', 'delete') then
    raise exception 'push_change: unknown op %', op;
  end if;

  insert into applied_changes (id) values (change_id) on conflict do nothing;
  get diagnostics fresh = row_count;
  if fresh = 0 then return; end if;

  -- The server's own columns, never the phone's.
  payload := payload - 'id' - 'updated_at' - 'deleted_at' - 'field_edited_at' - 'owner_id';

  -- ── a cabinet ──
  if entity = 'cabinets' then
    if not exists (select 1 from cabinets where id = row_id) then
      if op <> 'insert' then return; end if;
      -- Shared for the first time: it comes with its first member, the owner.
      insert into cabinets
        select * from jsonb_populate_record(null::cabinets, payload || jsonb_build_object(
          'id', row_id, 'updated_at', now(), 'field_edited_at', '{}'::jsonb));
      insert into cabinet_members (cabinet_id, user_id, role) values (row_id, me, 'owner');
      return;
    end if;
    role := public.role_in(row_id);
    if role is null then
      raise exception 'push_change: cabinet % is not yours', row_id using errcode = '42501';
    end if;
    if op = 'delete' then
      if role = 'owner' then
        update cabinets set deleted_at = stamp where id = row_id;
      else
        delete from cabinet_members where cabinet_id = row_id and user_id = me;
      end if;
      return;
    end if;
    if role = 'member' then
      raise exception 'push_change: a member does not change the cabinet' using errcode = '42501';
    end if;
    payload := payload - 'created_at';
    cabinet := row_id;

  -- ── an own category ──
  elsif entity = 'custom_categories' then
    if not exists (select 1 from custom_categories where id = row_id) then
      if op <> 'insert' then return; end if;
      insert into custom_categories
        select * from jsonb_populate_record(null::custom_categories, payload || jsonb_build_object(
          'id', row_id, 'owner_id', me, 'updated_at', now(), 'field_edited_at', '{}'::jsonb));
      return;
    end if;
    -- Someone else's, come to this phone with a shared medicine: theirs to change.
    if not exists (select 1 from custom_categories where id = row_id and owner_id = me) then return; end if;
    if op = 'delete' then
      update custom_categories set deleted_at = stamp where id = row_id;
      return;
    end if;

  -- ── a medicine's category ──
  elsif entity = 'medicine_categories' then
    key_med := split_part(row_id, '|', 1);
    key_cat := substr(row_id, char_length(key_med) + 2);
    select m.cabinet_id into cabinet from medicines m where m.id = key_med;
    if cabinet is null then return; end if;
    if coalesce(public.role_in(cabinet), '') not in ('owner', 'admin') then
      raise exception 'push_change: a member does not change categories' using errcode = '42501';
    end if;
    select field_edited_at into times from medicine_categories where medicine_id = key_med and category = key_cat;
    if times ? 'deleted_at' and (times ->> 'deleted_at')::timestamptz >= stamp then return; end if;
    insert into medicine_categories (medicine_id, category, cabinet_id, deleted_at, field_edited_at)
    values (key_med, key_cat, cabinet, case when op = 'delete' then stamp end,
            jsonb_build_object('deleted_at', stamp))
    on conflict (medicine_id, category) do update
      set deleted_at = excluded.deleted_at, cabinet_id = excluded.cabinet_id,
          field_edited_at = medicine_categories.field_edited_at || excluded.field_edited_at;
    return;

  -- ── a medicine ──
  elsif entity = 'medicines' then
    select m.cabinet_id into cabinet from medicines m where m.id = row_id;
    if cabinet is null then
      if op <> 'insert' then return; end if;
      cabinet := payload ->> 'cabinet_id';
      if coalesce(public.role_in(cabinet), '') not in ('owner', 'admin') then
        raise exception 'push_change: a member does not add medicines' using errcode = '42501';
      end if;
      insert into medicines
        select * from jsonb_populate_record(null::medicines, payload || jsonb_build_object(
          'id', row_id, 'updated_at', now(), 'field_edited_at', '{}'::jsonb));
      return;
    end if;
    if coalesce(public.role_in(cabinet), '') not in ('owner', 'admin') then
      raise exception 'push_change: a member does not change medicines' using errcode = '42501';
    end if;
    moved_to := payload ->> 'cabinet_id';
    if moved_to is not null and moved_to <> cabinet then
      if coalesce(public.role_in(moved_to), '') not in ('owner', 'admin') then
        raise exception 'push_change: % is not a cabinet to move into', moved_to using errcode = '42501';
      end if;
    end if;
    if op = 'delete' then
      update medicines set deleted_at = stamp
       where id = row_id and not (field_edited_at ? 'deleted_at' and (field_edited_at ->> 'deleted_at')::timestamptz >= stamp);
      return;
    end if;
    -- An insert of a medicine that is there: its own resend, or one moved
    -- back in after it was deleted when it moved out. Either way it lives.
    if op = 'insert' then
      update medicines set deleted_at = null, field_edited_at = field_edited_at || jsonb_build_object('deleted_at', stamp)
       where id = row_id;
    end if;
    payload := payload - 'created_at';

  -- ── a pack ──
  else
    select p.cabinet_id into cabinet from packages p where p.id = row_id;
    if cabinet is null then
      if op <> 'insert' then return; end if;
      select m.cabinet_id into cabinet from medicines m where m.id = payload ->> 'medicine_id';
      if cabinet is null then return; end if;
      if coalesce(public.role_in(cabinet), '') not in ('owner', 'admin') then
        raise exception 'push_change: a member does not add packs' using errcode = '42501';
      end if;
      insert into packages
        select * from jsonb_populate_record(null::packages, payload - 'quantity_delta' || jsonb_build_object(
          'id', row_id, 'cabinet_id', cabinet, 'updated_at', now(), 'field_edited_at', '{}'::jsonb));
      return;
    end if;
    role := public.role_in(cabinet);
    if role is null then
      raise exception 'push_change: pack % is not yours', row_id using errcode = '42501';
    end if;
    if role = 'member' and (op <> 'update' or exists (
        select 1 from jsonb_object_keys(payload) k where k not in ('quantity', 'quantity_delta', 'opened_at', 'status'))) then
      raise exception 'push_change: a member only changes a pack''s count' using errcode = '42501';
    end if;
    if op = 'delete' then
      update packages set deleted_at = stamp where id = row_id;
      return;
    end if;
    if payload ? 'medicine_id' then
      select m.cabinet_id into moved_to from medicines m where m.id = payload ->> 'medicine_id';
      if moved_to is null or coalesce(public.role_in(moved_to), '') not in ('owner', 'admin') then
        raise exception 'push_change: no medicine % to put the pack in', payload ->> 'medicine_id' using errcode = '42501';
      end if;
      payload := payload || jsonb_build_object('cabinet_id', moved_to);
    end if;
    if op = 'insert' then
      payload := payload - 'quantity_delta';
      update packages set deleted_at = null where id = row_id;
    end if;
    payload := payload - 'created_at';
  end if;

  -- ── an update of a row that is there: field by field, the later edit wins ──
  execute format('select field_edited_at from %I where id = $1 for update', entity) into times using row_id;

  for field in select jsonb_object_keys(payload) loop
    continue when field = 'quantity_delta';
    continue when times ? field and (times ->> field)::timestamptz >= stamp;
    sets := sets || format('%I = r.%I', field, field);
    stamps := stamps || jsonb_build_object(field, stamp);
  end loop;

  -- A count taken off a pack nobody counted stays "not counted" (null), and a
  -- delta may be a fraction of a tablet.
  if entity = 'packages' and payload ? 'quantity_delta' then
    sets := sets || ('quantity = case when t.quantity is null then null else greatest(0, t.quantity + '
                     'coalesce(($3 ->> ''quantity_delta'')::numeric, 0)) end')::text;
  end if;

  if cardinality(sets) = 0 then return; end if;

  execute format(
    'update %I t set %s, field_edited_at = t.field_edited_at || $2
       from jsonb_populate_record(null::%I, $3) r
      where t.id = $1',
    entity, array_to_string(sets, ', '), entity
  ) using row_id, stamps, payload;
end;
$$;

-- ─── invites ─────────────────────────────────────────────────────────────────

create or replace function public.create_invite(cabinet text)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  letters constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  fresh text;
begin
  if coalesce(public.role_in(cabinet), '') not in ('owner', 'admin') then
    raise exception 'create_invite: only the owner and admins invite' using errcode = '42501';
  end if;
  return query
    select i.code, i.expires_at from invites i
     where i.cabinet_id = cabinet and i.expires_at > now() + interval '1 day'
     order by i.expires_at desc limit 1;
  if found then return; end if;
  loop
    select string_agg(substr(letters, 1 + floor(random() * length(letters))::int, 1), '')
      into fresh from generate_series(1, 6);
    begin
      insert into invites (code, cabinet_id, created_by) values (fresh, cabinet, auth.uid());
      exit;
    exception when unique_violation then
      -- Taken already: draw again.
    end;
  end loop;
  return query select i.code, i.expires_at from invites i where i.code = fresh;
end;
$$;

-- What the Join screen shows before joining: no rows of the cabinet itself.
-- No row: the code leads nowhere. An expired code, to someone not in the
-- cabinet, gives only `expired` (everything else null): what it was is no
-- longer theirs to know.
create or replace function public.peek_invite(code text)
returns table (cabinet_id text, name text, icon text, inviter text, medicines int, people int,
               expired boolean, joined boolean)
language sql stable security definer set search_path = public as $$
  select case when v.shown then c.id end,
         case when v.shown then c.name end,
         case when v.shown then c.icon end,
         case when v.shown then coalesce(p.name, '') end,
         case when v.shown then (select count(*)::int from medicines m where m.cabinet_id = c.id and m.deleted_at is null) end,
         case when v.shown then (select count(*)::int from cabinet_members cm where cm.cabinet_id = c.id) end,
         i.expires_at <= now(),
         v.joined
    from invites i
    join cabinets c on c.id = i.cabinet_id and c.deleted_at is null
    left join profiles p on p.id = i.created_by
    cross join lateral (select public.is_member(c.id) as joined) j
    cross join lateral (select j.joined, (i.expires_at > now() or j.joined) as shown) v
   where i.code = upper(peek_invite.code);
$$;

-- ─── people in a cabinet ─────────────────────────────────────────────────────

create or replace function public.set_member_role(cabinet text, person uuid, role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.role_in(cabinet) is distinct from 'owner' then
    raise exception 'set_member_role: only the owner changes roles' using errcode = '42501';
  end if;
  if set_member_role.role not in ('admin', 'member') or person = auth.uid() then
    raise exception 'set_member_role: not a role to give';
  end if;
  update cabinet_members set role = set_member_role.role where cabinet_id = cabinet and user_id = person;
end;
$$;

create or replace function public.remove_member(cabinet text, person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.role_in(cabinet) is distinct from 'owner' or person = auth.uid() then
    raise exception 'remove_member: only the owner removes others' using errcode = '42501';
  end if;
  delete from cabinet_members where cabinet_id = cabinet and user_id = person;
end;
$$;

-- ─── signing in: merge now, delete the anonymous user once confirmed ─────────

-- An anonymous user merged into an account and not deleted yet. The sign-in
-- function writes it on the merge and deletes the anonymous user when the
-- phone, signed in to the account by then, says so.
create table public.account_merges (
  from_id   uuid not null references auth.users (id) on delete cascade,
  to_id     uuid not null references auth.users (id) on delete cascade,
  merged_at timestamptz not null default now(),
  primary key (from_id, to_id)
);

alter table public.account_merges enable row level security;
-- No policies: only the service role reads and writes it.

-- As before, except that the anonymous user keeps its memberships: until the
-- phone has the account's session it still syncs as the anonymous user, and
-- a cabinet it is not in any more would be dropped from the phone. Running it
-- again changes nothing, so a sign-in that failed halfway can be tried again.
create or replace function public.merge_account(p_from uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from = p_to then
    return;
  end if;

  -- A cabinet both are in keeps the stronger role.
  insert into cabinet_members as m (cabinet_id, user_id, role, joined_at)
  select cabinet_id, p_to, role, joined_at from cabinet_members where user_id = p_from
  on conflict (cabinet_id, user_id) do update
    set role = case
      when 'owner' in (m.role, excluded.role) then 'owner'
      when 'admin' in (m.role, excluded.role) then 'admin'
      else 'member'
    end;

  update invites set created_by = p_to where created_by = p_from;
  update custom_categories set owner_id = p_to where owner_id = p_from;

  -- The account's own name wins; an empty one takes the phone's.
  insert into profiles as p (id, name)
  select p_to, name from profiles where id = p_from and name <> ''
  on conflict (id) do update set name = excluded.name where p.name = '';

  -- One pick a person a code: the account's own stays.
  update barcode_map b set user_id = p_to
   where b.user_id = p_from
     and not exists (select 1 from barcode_map t where t.gtin = b.gtin and t.user_id = p_to);

  update box_photo_days d set user_id = p_to
   where d.user_id = p_from
     and not exists (select 1 from box_photo_days t where t.day = d.day and t.user_id = p_to);

  insert into account_merges (from_id, to_id) values (p_from, p_to)
  on conflict (from_id, to_id) do update set merged_at = now();
end;
$$;

revoke execute on function public.merge_account(uuid, uuid) from public, anon, authenticated;
