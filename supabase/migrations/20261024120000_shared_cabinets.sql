-- Shared cabinets (docs/model.md, "Person and Membership" and "Syncing a
-- shared cabinet"). Only shared cabinets live here; a phone's personal ones
-- never leave it. Ids are the phone's (uuidv7 text), so a row keeps its id.
--
-- Phones read through RLS and write only through the functions below, which
-- check the role themselves: push_change for the outbox, and one function per
-- action for profiles, invites, joining, roles and leaving.

-- ─── people and cabinets ─────────────────────────────────────────────────────

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null default '' check (char_length(name) <= 40),
  updated_at timestamptz not null default now()
);

create table public.cabinets (
  id                  text primary key,
  name                text not null,
  place               text not null,
  icon                text not null,
  mode                text not null check (mode in ('expiry_only', 'with_intake')),
  expiry_warning_days int not null default 30,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  field_edited_at     jsonb not null default '{}'::jsonb
);

create table public.cabinet_members (
  cabinet_id text not null references public.cabinets (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('owner', 'admin', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (cabinet_id, user_id)
);

create index cabinet_members_user on public.cabinet_members (user_id);

-- One code a cabinet at a time, good for seven days and any number of people.
create table public.invites (
  code       text primary key check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),
  cabinet_id text not null references public.cabinets (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index invites_cabinet on public.invites (cabinet_id, expires_at);

-- ─── what is in them ─────────────────────────────────────────────────────────

create table public.medicines (
  id                  text primary key,
  cabinet_id          text not null references public.cabinets (id) on delete cascade,
  name                text not null,
  inn                 text,
  form                text,
  strength            text,
  manufacturer        text,
  rx                  boolean not null default false,
  low_stock_threshold int,
  register_id         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  field_edited_at     jsonb not null default '{}'::jsonb
);

create index medicines_pull on public.medicines (cabinet_id, updated_at);

-- cabinet_id is the medicine's, kept here so a pull and RLS need no join.
create table public.packages (
  id              text primary key,
  medicine_id     text not null references public.medicines (id) on delete cascade,
  cabinet_id      text not null references public.cabinets (id) on delete cascade,
  expires         text check (expires ~ '^\d{4}-\d{2}-\d{2}$'),
  quantity        int check (quantity >= 0),
  opened_at       text,
  status          text not null default 'active' check (status in ('active', 'used_up', 'disposed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  field_edited_at jsonb not null default '{}'::jsonb
);

create index packages_pull on public.packages (cabinet_id, updated_at);

-- A built-in category key, or a custom_categories id.
create table public.medicine_categories (
  medicine_id     text not null references public.medicines (id) on delete cascade,
  category        text not null,
  cabinet_id      text not null references public.cabinets (id) on delete cascade,
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  field_edited_at jsonb not null default '{}'::jsonb,
  primary key (medicine_id, category)
);

create index medicine_categories_pull on public.medicine_categories (cabinet_id, updated_at);

-- A person's own category, seen by everyone in a cabinet whose medicines use it.
create table public.custom_categories (
  id              text primary key,
  owner_id        uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  icon            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz,
  field_edited_at jsonb not null default '{}'::jsonb
);

-- A medicine that moved to a cabinet some of its readers are not in: they
-- would never see the move through RLS, so the old cabinet keeps a note.
create table public.moved_out (
  medicine_id text not null,
  cabinet_id  text not null references public.cabinets (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (medicine_id, cabinet_id)
);

-- An outbox row's id once applied: a resend after a lost answer changes nothing.
create table public.applied_changes (
  id         text primary key,
  applied_at timestamptz not null default now()
);

-- ─── updated_at is the pull cursor ───────────────────────────────────────────

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  -- The clock, not the transaction's start: a cabinet shared in one call
  -- still has its rows in order, so a pull can page through them.
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'cabinets', 'medicines', 'packages', 'medicine_categories',
                           'custom_categories', 'moved_out'] loop
    execute format('create trigger touch before insert or update on public.%I
                    for each row execute function public.touch_updated_at()', t);
  end loop;
end;
$$;

-- ─── who may read what ───────────────────────────────────────────────────────

create function public.role_in(cabinet text) returns text
language sql stable security definer set search_path = public as $$
  select role from cabinet_members where cabinet_id = cabinet and user_id = auth.uid();
$$;

create function public.is_member(cabinet text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cabinet_members where cabinet_id = cabinet and user_id = auth.uid());
$$;

alter table public.profiles            enable row level security;
alter table public.cabinets            enable row level security;
alter table public.cabinet_members     enable row level security;
alter table public.invites             enable row level security;
alter table public.medicines           enable row level security;
alter table public.packages            enable row level security;
alter table public.medicine_categories enable row level security;
alter table public.custom_categories   enable row level security;
alter table public.moved_out           enable row level security;
alter table public.applied_changes     enable row level security;

-- Oneself, and the people one shares a cabinet with.
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from cabinet_members mine join cabinet_members theirs using (cabinet_id)
     where mine.user_id = auth.uid() and theirs.user_id = profiles.id));

create policy cabinets_read on public.cabinets for select to authenticated using (public.is_member(id));
create policy members_read on public.cabinet_members for select to authenticated using (public.is_member(cabinet_id));
create policy invites_read on public.invites for select to authenticated using (public.role_in(cabinet_id) in ('owner', 'admin'));
create policy medicines_read on public.medicines for select to authenticated using (public.is_member(cabinet_id));
create policy packages_read on public.packages for select to authenticated using (public.is_member(cabinet_id));
create policy medicine_categories_read on public.medicine_categories for select to authenticated using (public.is_member(cabinet_id));
create policy moved_out_read on public.moved_out for select to authenticated using (public.is_member(cabinet_id));
create policy custom_categories_read on public.custom_categories for select to authenticated using (
  owner_id = auth.uid() or exists (
    select 1 from medicine_categories mc
     where mc.category = custom_categories.id and public.is_member(mc.cabinet_id)));

-- No insert, update or delete policies: every write goes through a function.

-- ─── the person's name ───────────────────────────────────────────────────────

create function public.set_name(name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'set_name: not signed in'; end if;
  insert into profiles (id, name) values (auth.uid(), left(btrim(set_name.name), 40))
  on conflict (id) do update set name = excluded.name;
end;
$$;

-- ─── push_change: one outbox row ─────────────────────────────────────────────

-- Applies one change from a phone (docs/model.md, "Syncing a shared cabinet"):
-- - a field is written only if this edit is newer than the one that last wrote
--   it, the phone's time clamped to the server's;
-- - a pack's count comes as quantity_delta, added and floored at 0;
-- - an insert of a row that exists is an update; an outbox id seen before is
--   ignored;
-- - the role decides: owner and admin edit everything in the cabinet, a member
--   only a pack's count, opening and status; deleting the cabinet is the
--   owner's, and anyone else's delete is leaving it.
create function public.push_change(
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
    if public.role_in(cabinet) not in ('owner', 'admin') then
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
      if public.role_in(cabinet) not in ('owner', 'admin') then
        raise exception 'push_change: a member does not add medicines' using errcode = '42501';
      end if;
      insert into medicines
        select * from jsonb_populate_record(null::medicines, payload || jsonb_build_object(
          'id', row_id, 'updated_at', now(), 'field_edited_at', '{}'::jsonb));
      return;
    end if;
    if public.role_in(cabinet) not in ('owner', 'admin') then
      raise exception 'push_change: a member does not change medicines' using errcode = '42501';
    end if;
    moved_to := payload ->> 'cabinet_id';
    if moved_to is not null and moved_to <> cabinet then
      if public.role_in(moved_to) not in ('owner', 'admin') then
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
      if public.role_in(cabinet) not in ('owner', 'admin') then
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
      if moved_to is null or public.role_in(moved_to) not in ('owner', 'admin') then
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

  if entity = 'packages' and payload ? 'quantity_delta' then
    sets := sets || 'quantity = greatest(0, t.quantity + ($3 ->> ''quantity_delta'')::int)'::text;
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

-- The outbox in one call: each change on its own, so one refused change
-- does not stop the rest. Returns the refused ones with the error's code.
create function public.push_changes(changes jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c       jsonb;
  refused jsonb := '[]'::jsonb;
begin
  for c in select * from jsonb_array_elements(changes) loop
    begin
      perform public.push_change(c ->> 'id', c ->> 'entity', c ->> 'entity_id', c ->> 'op',
                                 (c ->> 'payload')::jsonb, (c ->> 'edited_at')::timestamptz);
    exception when others then
      refused := refused || jsonb_build_object('id', c ->> 'id', 'code', sqlstate, 'message', sqlerrm);
    end;
  end loop;
  return refused;
end;
$$;

-- A medicine that leaves a cabinet: its packs and categories go with it, and
-- the cabinet it left keeps a note for the readers who cannot follow it.
create function public.follow_medicine_move() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cabinet_id is distinct from old.cabinet_id then
    update packages set cabinet_id = new.cabinet_id where medicine_id = new.id;
    update medicine_categories set cabinet_id = new.cabinet_id where medicine_id = new.id;
    insert into moved_out (medicine_id, cabinet_id) values (new.id, old.cabinet_id)
    on conflict (medicine_id, cabinet_id) do update set updated_at = now();
    -- Back where it was: the note would take it away again on a full pull.
    delete from moved_out where medicine_id = new.id and cabinet_id = new.cabinet_id;
  end if;
  return new;
end;
$$;

create trigger follow_move after update of cabinet_id on public.medicines
  for each row execute function public.follow_medicine_move();

-- ─── invites ─────────────────────────────────────────────────────────────────

-- «Запросити»: the cabinet's code while it lasts, or a new one.
create function public.create_invite(cabinet text)
returns table (code text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  letters constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  fresh text;
begin
  if public.role_in(cabinet) not in ('owner', 'admin') then
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
create function public.peek_invite(code text)
returns table (cabinet_id text, name text, icon text, inviter text, medicines int, people int,
               expired boolean, joined boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.icon, coalesce(p.name, ''),
         (select count(*)::int from medicines m where m.cabinet_id = c.id and m.deleted_at is null),
         (select count(*)::int from cabinet_members cm where cm.cabinet_id = c.id),
         i.expires_at <= now(),
         public.is_member(c.id)
    from invites i
    join cabinets c on c.id = i.cabinet_id and c.deleted_at is null
    left join profiles p on p.id = i.created_by
   where i.code = upper(peek_invite.code);
$$;

-- «Приєднатися»: the person's name, and the cabinet as a member.
create function public.join_cabinet(code text, name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  cabinet text;
begin
  if auth.uid() is null then raise exception 'join_cabinet: not signed in'; end if;
  select i.cabinet_id into cabinet from invites i
    join cabinets c on c.id = i.cabinet_id and c.deleted_at is null
   where i.code = upper(join_cabinet.code) and i.expires_at > now();
  if cabinet is null then
    raise exception 'join_cabinet: no such invite' using errcode = 'P0002';
  end if;
  if coalesce(btrim(join_cabinet.name), '') <> '' then perform public.set_name(join_cabinet.name); end if;
  insert into cabinet_members (cabinet_id, user_id, role) values (cabinet, auth.uid(), 'member')
  on conflict do nothing;
  return cabinet;
end;
$$;

-- ─── people in a cabinet ─────────────────────────────────────────────────────

-- The owner gives or takes admin. The owner's own role does not change here.
create function public.set_member_role(cabinet text, person uuid, role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.role_in(cabinet) <> 'owner' then
    raise exception 'set_member_role: only the owner changes roles' using errcode = '42501';
  end if;
  if set_member_role.role not in ('admin', 'member') or person = auth.uid() then
    raise exception 'set_member_role: not a role to give';
  end if;
  update cabinet_members set role = set_member_role.role where cabinet_id = cabinet and user_id = person;
end;
$$;

-- «Прибрати з аптечки»: the owner takes someone out.
create function public.remove_member(cabinet text, person uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.role_in(cabinet) <> 'owner' or person = auth.uid() then
    raise exception 'remove_member: only the owner removes others' using errcode = '42501';
  end if;
  delete from cabinet_members where cabinet_id = cabinet and user_id = person;
end;
$$;

-- ─── grants ──────────────────────────────────────────────────────────────────

revoke all on all functions in schema public from public, anon;
grant execute on function public.set_name(text) to authenticated;
grant execute on function public.push_change(text, text, text, text, jsonb, timestamptz) to authenticated;
grant execute on function public.push_changes(jsonb) to authenticated;
grant execute on function public.create_invite(text) to authenticated;
grant execute on function public.peek_invite(text) to authenticated;
grant execute on function public.join_cabinet(text, text) to authenticated;
grant execute on function public.set_member_role(text, uuid, text) to authenticated;
grant execute on function public.remove_member(text, uuid) to authenticated;
grant execute on function public.role_in(text) to authenticated;
grant execute on function public.is_member(text) to authenticated;

-- ─── realtime: a nudge to pull ───────────────────────────────────────────────

alter publication supabase_realtime add table
  public.cabinets, public.cabinet_members, public.medicines, public.packages,
  public.medicine_categories, public.custom_categories, public.moved_out;
