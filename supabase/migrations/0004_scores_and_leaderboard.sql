-- One row per finished round, for any game. Leaderboards read from here.
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game ~ '^[a-z0-9-]{1,40}$'),
  score numeric not null check (score >= 0 and score <= 1000000),
  detail jsonb not null default '{}'::jsonb check (pg_column_size(detail) <= 2048),
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game, score desc);
create index scores_game_created_idx on public.scores (game, created_at desc);
create index scores_profile_idx on public.scores (profile_id);

alter table public.scores enable row level security;
create policy "scores: read all signed in" on public.scores
  for select to authenticated using (true);
create policy "scores: add own" on public.scores
  for insert to authenticated with check (private.owns_profile(profile_id));
-- no update/delete: a round's score is final

revoke all on public.scores from anon;
grant select, insert on public.scores to authenticated;

-- Best score per player for a game, optionally since a moment (e.g. start of this week).
create or replace function public.leaderboard(p_game text, p_since timestamptz default null, p_limit integer default 10)
returns table (profile_id uuid, name text, color text, best numeric, rounds bigint, best_at timestamptz)
language sql stable security invoker
set search_path = ''
as $$
  with ranked as (
    select s.profile_id, s.score, s.created_at,
           row_number() over (partition by s.profile_id order by s.score desc, s.created_at asc) as rn,
           count(*) over (partition by s.profile_id) as rounds
    from public.scores s
    where s.game = p_game and (p_since is null or s.created_at >= p_since)
  )
  select r.profile_id, p.name, p.color, r.score as best, r.rounds, r.created_at as best_at
  from ranked r
  join public.profiles p on p.id = r.profile_id
  where r.rn = 1
  order by r.score desc, r.created_at asc
  limit least(greatest(coalesce(p_limit, 10), 1), 100);
$$;
revoke execute on function public.leaderboard(text, timestamptz, integer) from public, anon;
grant execute on function public.leaderboard(text, timestamptz, integer) to authenticated;
