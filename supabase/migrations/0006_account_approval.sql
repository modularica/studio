-- New accounts wait for an admin's approval before they can use the Lab.
-- Anyone can still sign up (username + password), but until an admin approves the account it can
-- not read or write players, saves, scores, play logs or feedback. Accounts that existed when this
-- ran, and accounts whose e-mail is in public.admins, count as approved.

create table public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.members enable row level security;
-- no policies: clients never touch this table directly; the functions below do.
revoke all on public.members from anon, authenticated;

insert into public.members (user_id, status, created_at, decided_at)
select id, 'approved', created_at, now() from auth.users
on conflict (user_id) do nothing;

-- Every new sign-up gets a row: pending, or approved straight away for an admin e-mail.
create or replace function private.on_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin boolean := exists (select 1 from public.admins a where a.email = lower(coalesce(new.email, '')));
begin
  insert into public.members (user_id, status, decided_at)
  values (new.id, case when admin then 'approved' else 'pending' end, case when admin then now() end)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created_member
  after insert on auth.users
  for each row execute function private.on_new_user();

-- Policy helper: is the signed-in account allowed into the Lab?
create or replace function private.approved()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_admin() or exists (
    select 1 from public.members m where m.user_id = auth.uid() and m.status = 'approved'
  );
$$;
revoke execute on function private.approved() from public, anon;
grant execute on function private.approved() to authenticated;

-- Owning a player now also needs an approved account: this covers every saves, plays, scores and
-- feedback policy, which all go through owns_profile().
create or replace function private.owns_profile(p uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.approved() and exists (
    select 1 from public.profiles pr
    where pr.id = p and pr.owner_id = auth.uid()
  );
$$;

-- Players: shared names and colours, and each family's own players, for approved accounts only.
drop policy "profiles: read all signed in" on public.profiles;
create policy "profiles: read all approved" on public.profiles
  for select to authenticated using ((select private.approved()));
drop policy "profiles: add own" on public.profiles;
create policy "profiles: add own" on public.profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.approved()));
drop policy "profiles: edit own" on public.profiles;
create policy "profiles: edit own" on public.profiles
  for update to authenticated
  using (owner_id = (select auth.uid()) and (select private.approved()))
  with check (owner_id = (select auth.uid()) and (select private.approved()));
drop policy "profiles: delete own" on public.profiles;
create policy "profiles: delete own" on public.profiles
  for delete to authenticated
  using (owner_id = (select auth.uid()) and (select private.approved()));

-- The shared play log ("Kim ne oynuyor?") and scores: approved accounts only.
drop policy "plays: read all signed in" on public.plays;
create policy "plays: read all approved" on public.plays
  for select to authenticated using ((select private.approved()));
drop policy "scores: read all signed in" on public.scores;
create policy "scores: read all approved" on public.scores
  for select to authenticated using ((select private.approved()));

-- For pages: 'approved', 'pending' or 'rejected' for the signed-in account.
create or replace function public.onay_durumu()
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when private.is_admin() then 'approved'
    else coalesce((select m.status from public.members m where m.user_id = auth.uid()), 'pending')
  end;
$$;
revoke execute on function public.onay_durumu() from public, anon;
grant execute on function public.onay_durumu() to authenticated;

-- Admins: every account with its status, username, players and last play, waiting ones first.
create or replace function public.hesaplar()
returns table (
  user_id uuid, kullanici text, status text, created_at timestamptz, decided_at timestamptz,
  oyuncular text, son_oynama timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  return query
  select m.user_id,
         coalesce(u.raw_user_meta_data ->> 'kullanici_adi',
                  case when u.email like '%@oyuncu.bringthepoint.com' then split_part(u.email, '@', 1) else u.email end)::text,
         m.status, m.created_at, m.decided_at,
         (select string_agg(p.name, ', ' order by p.created_at) from public.profiles p where p.owner_id = m.user_id)::text,
         (select max(pl.last_seen) from public.plays pl join public.profiles p on p.id = pl.profile_id where p.owner_id = m.user_id)
  from public.members m
  join auth.users u on u.id = m.user_id
  order by (m.status = 'pending') desc, m.created_at desc;
end;
$$;
revoke execute on function public.hesaplar() from public, anon;
grant execute on function public.hesaplar() to authenticated;

-- Admins: approve, reject, or put an account back to waiting.
create or replace function public.hesap_karar(p_user uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'bad status %', p_status using errcode = '22023';
  end if;
  update public.members
     set status = p_status, decided_at = case when p_status = 'pending' then null else now() end
   where user_id = p_user;
end;
$$;
revoke execute on function public.hesap_karar(uuid, text) from public, anon;
grant execute on function public.hesap_karar(uuid, text) to authenticated;

-- Admins: how many accounts are waiting (for the badge on the Lab home page).
create or replace function public.bekleyen_sayisi()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select case when private.is_admin()
    then (select count(*)::int from public.members where status = 'pending')
    else 0 end;
$$;
revoke execute on function public.bekleyen_sayisi() from public, anon;
grant execute on function public.bekleyen_sayisi() to authenticated;
