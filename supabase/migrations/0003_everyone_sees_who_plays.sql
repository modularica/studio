-- "Kim ne oynuyor?" is shared: every signed-in player can see every player's name/colour and play log.
-- Game saves stay private to the owning account.
drop policy "profiles: read own or admin" on public.profiles;
create policy "profiles: read all signed in" on public.profiles
  for select to authenticated using (true);

drop policy "plays: read own or admin" on public.plays;
create policy "plays: read all signed in" on public.plays
  for select to authenticated using (true);
