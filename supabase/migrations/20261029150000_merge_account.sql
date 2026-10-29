-- Signing in on a phone (docs/model.md, "Signing in"): the phone's anonymous
-- user goes into the account it signs in to, so its cabinets, name, own
-- categories and barcode picks stay with the person. Called by the sign-in
-- function with the service role only; the anonymous user is deleted after.

create function public.merge_account(p_from uuid, p_to uuid)
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
  delete from cabinet_members where user_id = p_from;

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
end;
$$;

revoke execute on function public.merge_account(uuid, uuid) from public, anon, authenticated;
