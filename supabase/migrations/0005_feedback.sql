-- "Nasıldı?": what Lab players think of a game. One row per answer: a face, quick tags and an
-- optional note. Players see only their own answers; admins see everyone's.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  -- 4 Bayıldım, 3 Beğendim, 2 Eh işte, 1 Sevmedim
  rating smallint not null check (rating between 1 and 4),
  tags text[] not null default '{}'
    check (tags <@ array['tekrar', 'arkadas', 'zor', 'kolay', 'anlamadim', 'hata']::text[]),
  comment text check (comment is null or char_length(comment) <= 600),
  -- where and when it was given: { yer, not (the game's progress line), ekran, dokunmatik }
  context jsonb not null default '{}'::jsonb check (pg_column_size(context) <= 1024),
  created_at timestamptz not null default now()
);
create index feedback_game_created_idx on public.feedback (game, created_at desc);
create index feedback_profile_idx on public.feedback (profile_id, created_at desc);

alter table public.feedback enable row level security;
create policy "feedback: read own or admin" on public.feedback
  for select to authenticated using (private.owns_profile(profile_id) or (select private.is_admin()));
create policy "feedback: add own" on public.feedback
  for insert to authenticated with check (private.owns_profile(profile_id));
-- no update/delete: a new answer is a new row

revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;

-- Lets a page ask whether the signed-in user is an admin (to show the feedback page).
create or replace function public.yonetici_mi()
returns boolean
language sql stable security invoker
set search_path = ''
as $$ select private.is_admin() $$;
revoke execute on function public.yonetici_mi() from public, anon;
grant execute on function public.yonetici_mi() to authenticated;
