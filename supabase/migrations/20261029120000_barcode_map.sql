-- ─── barcodes: what a pack's code is, as people picked it ───────────────────

-- There is no open barcode catalogue for Ukraine (docs/model.md, "Barcodes"),
-- so the map is made by the people who scan: a code nobody knows is found once
-- by a photo or the search, and the pick is kept here for everyone. One row per
-- person and code, their latest pick, so a person's mistake is corrected by
-- picking again and never counts twice.
create table public.barcode_map (
  gtin         text not null check (gtin ~ '^\d{8,14}$'),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The State Register's own ID of the entry, as the app's search index has it.
  register_id  text not null check (length(register_id) between 1 and 64),
  -- How much a full pack holds, when what was added was a full one.
  pack_size    int check (pack_size between 1 and 10000),
  confirmed_at timestamptz not null default now(),
  primary key (gtin, user_id)
);

-- Nobody reads or writes it but the two functions below: a person sees what a
-- code is, never who picked it.
alter table public.barcode_map enable row level security;

-- What a code is: the entry most people picked, the asker's own pick first.
-- `mine` and `confirmations` let the app decide whether to trust it.
create function public.lookup_barcode(p_gtin text)
returns table (register_id text, pack_size int, confirmations int, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select m.register_id,
         mode() within group (order by m.pack_size),
         count(*)::int,
         bool_or(m.user_id = auth.uid())
  from barcode_map m
  where m.gtin = p_gtin and auth.uid() is not null
  group by m.register_id
  order by bool_or(m.user_id = auth.uid()) desc, count(*) desc, max(m.confirmed_at) desc
  limit 1;
$$;

-- The asker's pick for a code: a new one replaces their old one.
create function public.confirm_barcode(p_gtin text, p_register_id text, p_pack_size int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into barcode_map as m (gtin, user_id, register_id, pack_size)
  values (p_gtin, auth.uid(), p_register_id, p_pack_size)
  on conflict (gtin, user_id) do update
    set register_id = excluded.register_id,
        pack_size = excluded.pack_size,
        confirmed_at = now();
end;
$$;

revoke execute on function public.lookup_barcode(text) from public, anon;
revoke execute on function public.confirm_barcode(text, text, int) from public, anon;
grant execute on function public.lookup_barcode(text) to authenticated;
grant execute on function public.confirm_barcode(text, text, int) to authenticated;
