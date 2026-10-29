-- ─── a photo of a box: counted in one step ──────────────────────────────────

-- Thirty photos a day per person (docs/model.md, "A photo of the box"): a
-- guard on the model's key, not a limit anyone adding their cabinet should
-- meet. A pack is two shots, the front and the flap. The same locked upsert as
-- Freshka's take_food_photo, so thirty requests sent at once do not all read
-- one count.
create table public.box_photo_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   int  not null,
  primary key (user_id, day)
);

-- Nobody reads or writes it but the functions below, called by recognise-box
-- with the service role.
alter table public.box_photo_days enable row level security;

-- Whether this person may call the model once more today, counting the call
-- if so.
create function public.take_box_photo(p_user uuid, p_limit int)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  today date := (now() at time zone 'utc')::date;
  taken int;
begin
  -- Yesterday's count is of no use to anyone.
  delete from box_photo_days where user_id = p_user and day < today;

  insert into box_photo_days as d (user_id, day, count)
  values (p_user, today, 1)
  on conflict (user_id, day) do update set count = d.count + 1
    where d.count < p_limit
  returning d.count into taken;

  return taken is not null;
end;
$$;

-- A photo the model failed on is not counted.
create function public.give_back_box_photo(p_user uuid)
returns void
language sql
set search_path = public
as $$
  update box_photo_days set count = greatest(count - 1, 0)
  where user_id = p_user and day = (now() at time zone 'utc')::date;
$$;

revoke execute on function public.take_box_photo(uuid, int) from public, anon, authenticated;
revoke execute on function public.give_back_box_photo(uuid) from public, anon, authenticated;
grant execute on function public.take_box_photo(uuid, int) to service_role;
grant execute on function public.give_back_box_photo(uuid) to service_role;
