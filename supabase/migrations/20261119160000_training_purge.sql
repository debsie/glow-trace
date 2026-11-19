-- Daily deletion of shared training photos past their 2-year limit, plus admin tools for plans
-- and shared photos. The purge secret is generated here and lives only in Supabase Vault.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'training_purge_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'training_purge_secret');
  end if;
end;
$$;

create or replace function public.training_purge_secret_ok(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'training_purge_secret' and decrypted_secret = p_secret
  );
$$;

revoke all on function public.training_purge_secret_ok(text) from public, anon, authenticated;
grant execute on function public.training_purge_secret_ok(text) to service_role;

select cron.unschedule('purge-training-photos')
where exists (select 1 from cron.job where jobname = 'purge-training-photos');

select cron.schedule(
  'purge-training-photos',
  '17 1 * * *',
  $$
  select net.http_post(
    url := 'https://ysbruktqgqpbkhbshthi.supabase.co/functions/v1/purge-training',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'training_purge_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Admins may delete a shared photo too (for example on an emailed request).
create policy "Admins delete shared photos" on public.training_photos
  for delete to authenticated using (public.is_admin());
create policy "Admins delete training photos" on storage.objects
  for delete to authenticated using (bucket_id = 'training-photos' and public.is_admin());

-- Admins set a member's plan by email (until billing does it).
create or replace function public.admin_set_plan(p_email text, p_tier text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_tier not in ('free', 'pro', 'studio') then
    raise exception 'Unknown plan';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then
    raise exception 'No account with that email yet';
  end if;
  insert into public.subscriptions (user_id, tier, source, updated_at)
  values (target, p_tier, 'admin', now())
  on conflict (user_id) do update set tier = excluded.tier, source = 'admin', updated_at = now();
  return p_tier;
end;
$$;

revoke all on function public.admin_set_plan(text, text) from public, anon;
grant execute on function public.admin_set_plan(text, text) to authenticated;

-- Admin list of plans with emails (auth.users is not exposed to the API).
create or replace function public.admin_list_plans()
returns table (email text, tier text, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  return query
    select u.email::text, s.tier, s.updated_at
    from public.subscriptions s join auth.users u on u.id = s.user_id
    order by s.updated_at desc;
end;
$$;

revoke all on function public.admin_list_plans() from public, anon;
grant execute on function public.admin_list_plans() to authenticated;
