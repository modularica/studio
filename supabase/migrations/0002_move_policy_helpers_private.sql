-- Policy helpers do not need to be callable over the API; keep them out of the exposed schema.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;
alter function public.is_admin() set schema private;
alter function public.owns_profile(uuid) set schema private;
