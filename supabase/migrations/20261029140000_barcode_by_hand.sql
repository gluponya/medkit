-- ─── barcodes: medicines typed by hand ──────────────────────────────────────

-- A pack the Register does not have (a supplement, a box from abroad) is added
-- by hand: its code then points to the name and form as typed, so the next
-- scan opens it at once. A pick is a Register entry or a typed name, never both.
alter table public.barcode_map
  alter column register_id drop not null,
  add column name text check (length(name) between 1 and 120),
  add column form text check (form in (
    'tablets', 'capsules', 'drops', 'syrup', 'ointment', 'spray', 'powder', 'other',
    'solution', 'injection', 'suspension', 'suppositories', 'tincture', 'emulsion', 'herbs', 'patch'
  )),
  add constraint barcode_map_pick check (
    (register_id is not null and name is null and form is null)
    or (register_id is null and name is not null and form is not null)
  );

-- «Змінити ліки» to a medicine typed by hand now points the code at it.
drop function public.forget_barcode(text);

-- Typed names count as one pick when they are the same words in any case.
drop function public.lookup_barcode(text);
create function public.lookup_barcode(p_gtin text)
returns table (register_id text, name text, form text, pack_size int, confirmations int, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select min(m.register_id),
         -- The asker's own spelling, else the latest one.
         (array_agg(m.name order by (m.user_id = auth.uid()) desc, m.confirmed_at desc))[1],
         min(m.form),
         mode() within group (order by m.pack_size),
         count(*)::int,
         bool_or(m.user_id = auth.uid())
  from barcode_map m
  where m.gtin = p_gtin and auth.uid() is not null
  group by coalesce(m.register_id, lower(btrim(m.name)) || '|' || m.form)
  order by bool_or(m.user_id = auth.uid()) desc, count(*) desc, max(m.confirmed_at) desc
  limit 1;
$$;

drop function public.confirm_barcode(text, text, int);
create function public.confirm_barcode(p_gtin text, p_register_id text, p_name text, p_form text, p_pack_size int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into barcode_map as m (gtin, user_id, register_id, name, form, pack_size)
  values (p_gtin, auth.uid(), p_register_id, nullif(btrim(p_name), ''), p_form, p_pack_size)
  on conflict (gtin, user_id) do update
    set register_id = excluded.register_id,
        name = excluded.name,
        form = excluded.form,
        pack_size = excluded.pack_size,
        confirmed_at = now();
end;
$$;

revoke execute on function public.lookup_barcode(text) from public, anon;
revoke execute on function public.confirm_barcode(text, text, text, text, int) from public, anon;
grant execute on function public.lookup_barcode(text) to authenticated;
grant execute on function public.confirm_barcode(text, text, text, text, int) to authenticated;
