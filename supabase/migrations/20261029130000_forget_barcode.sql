-- ─── barcodes: taking a pick back ────────────────────────────────────────────

-- «Змінити ліки» to a medicine typed by hand: the code was picked wrong, and
-- there is no Register entry to point it at instead, so the asker's pick goes.
-- Other people's picks stay; they count for themselves.
create function public.forget_barcode(p_gtin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from barcode_map where gtin = p_gtin and user_id = auth.uid();
end;
$$;

revoke execute on function public.forget_barcode(text) from public, anon;
grant execute on function public.forget_barcode(text) to authenticated;
