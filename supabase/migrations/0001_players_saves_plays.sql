-- Accounts belong to parents (Supabase Auth users). Under each account live player
-- profiles (kids and parents). Every game saves progress per profile and logs play sessions.

-- Admins see every family's play log (the "Kim ne oynuyor?" page).
create table public.admins (
  email text primary key check (email = lower(email))
);
alter table public.admins enable row level security;
-- no policies: clients can never read this table; is_admin() reads it as definer.
insert into public.admins (email) values ('umutguncan@gmail.com');

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  avatar text not null default 'harf' check (char_length(avatar) <= 24),
  color text not null default '#f27a32' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);
create index profiles_owner_idx on public.profiles (owner_id);

create or replace function public.owns_profile(p uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = p and pr.owner_id = auth.uid()
  );
$$;

create table public.saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (profile_id, game)
);

create table public.plays (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  seconds integer not null default 0 check (seconds between 0 and 86400),
  note text check (char_length(note) <= 80)
);
create index plays_profile_started_idx on public.plays (profile_id, started_at desc);
create index plays_started_idx on public.plays (started_at desc);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.plays enable row level security;

-- profiles: a family manages its own players; admins can read everyone's names
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: add own" on public.profiles
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "profiles: edit own" on public.profiles
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "profiles: delete own" on public.profiles
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- saves: only the owning family
create policy "saves: read own" on public.saves
  for select to authenticated using (public.owns_profile(profile_id));
create policy "saves: add own" on public.saves
  for insert to authenticated with check (public.owns_profile(profile_id));
create policy "saves: edit own" on public.saves
  for update to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));
create policy "saves: delete own" on public.saves
  for delete to authenticated using (public.owns_profile(profile_id));

-- plays: the family writes its own; the family and admins read
create policy "plays: read own or admin" on public.plays
  for select to authenticated
  using (public.owns_profile(profile_id) or (select public.is_admin()));
create policy "plays: add own" on public.plays
  for insert to authenticated with check (public.owns_profile(profile_id));
create policy "plays: edit own" on public.plays
  for update to authenticated
  using (public.owns_profile(profile_id)) with check (public.owns_profile(profile_id));

revoke all on public.admins from anon, authenticated;
revoke all on public.profiles, public.saves, public.plays from anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.saves to authenticated;
grant select, insert, update on public.plays to authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.owns_profile(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_profile(uuid) to authenticated;
