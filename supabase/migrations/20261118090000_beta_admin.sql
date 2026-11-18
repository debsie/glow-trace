-- Glowtrace beta administration: admin role, timed access, access requests and feedback.
-- Builds on 20261117120000_beta_access.sql.

-- ---------- Admin role ----------
do $$ begin
  create type public.app_role as enum ('admin');
exception when duplicate_object then null; end $$;

create table if not exists public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

create policy "Read own roles" on public.user_roles
  for select to authenticated using (user_id = auth.uid());
-- No insert/update policies: make yourself admin in the SQL editor (see docs/deploy.md).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------- Timed access on the invite list ----------
alter table public.beta_allowlist
  add column if not exists expires_at timestamptz,
  add column if not exists duration_days integer check (duration_days in (14, 30, 60)),
  add column if not exists granted_by uuid references auth.users (id) on delete set null,
  add column if not exists revoked_at timestamptz;
-- expires_at null = no end date (rows you add by hand).

create policy "Admins manage the invite list" on public.beta_allowlist
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.has_beta_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.beta_allowlist
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

-- The signed-in person's own access window, for "access until" and expiry notices.
create or replace function public.my_beta_access()
returns table (expires_at timestamptz, revoked boolean, on_list boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.expires_at, a.revoked_at is not null, true
  from public.beta_allowlist a
  where a.email = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

revoke all on function public.my_beta_access() from public;
grant execute on function public.my_beta_access() to authenticated;

-- ---------- Access requests (the waitlist) ----------
alter table public.waitlist
  add column if not exists name text check (char_length(name) <= 80),
  add column if not exists note text check (char_length(note) <= 500),
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'approved', 'declined')),
  add column if not exists decided_at timestamptz;

drop policy if exists "Join waitlist with own email" on public.waitlist;

create policy "Request access with own email" on public.waitlist
  for insert to authenticated
  with check (
    email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'pending'
    and decided_at is null
  );

create policy "Read own request" on public.waitlist
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Ask again (for example after access ends): only back to a fresh pending request.
create policy "Re-request own access" on public.waitlist
  for update to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (
    email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'pending'
    and decided_at is null
  );

create policy "Admins manage requests" on public.waitlist
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Feedback ----------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  email text not null,
  rating smallint not null check (rating between 1 and 5),
  category text not null check (category in ('bug', 'idea', 'praise', 'other')),
  message text not null check (char_length(message) between 1 and 2000),
  page text check (char_length(page) <= 200),
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved')),
  thanked_at timestamptz,
  admin_note text check (char_length(admin_note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

create policy "Testers send feedback as themselves" on public.feedback
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and email = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'new'
    and thanked_at is null
    and admin_note is null
  );

create policy "Read own feedback" on public.feedback
  for select to authenticated using (user_id = auth.uid());

create policy "Admins manage feedback" on public.feedback
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Admin actions ----------
-- Grant or extend access. Extending adds days to whatever access is left.
create or replace function public.admin_grant_access(p_email text, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  target text := lower(trim(p_email));
  new_expiry timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  if p_days not in (14, 30, 60) then
    raise exception 'Access must be 14, 30 or 60 days';
  end if;
  if target !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email';
  end if;

  insert into public.beta_allowlist (email, expires_at, duration_days, granted_by, revoked_at)
  values (target, now() + make_interval(days => p_days), p_days, auth.uid(), null)
  on conflict (email) do update
    set expires_at = greatest(now(), coalesce(public.beta_allowlist.expires_at, now()))
                     + make_interval(days => p_days),
        duration_days = p_days,
        granted_by = auth.uid(),
        revoked_at = null
  returning expires_at into new_expiry;

  update public.waitlist
    set status = 'approved', decided_at = now()
    where email = target;

  return new_expiry;
end;
$$;

create or replace function public.admin_revoke_access(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.beta_allowlist set revoked_at = now() where email = lower(trim(p_email));
end;
$$;

create or replace function public.admin_decline_request(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.waitlist
    set status = 'declined', decided_at = now()
    where email = lower(trim(p_email));
end;
$$;

revoke all on function public.admin_grant_access(text, integer) from public;
revoke all on function public.admin_revoke_access(text) from public;
revoke all on function public.admin_decline_request(text) from public;
grant execute on function public.admin_grant_access(text, integer) to authenticated;
grant execute on function public.admin_revoke_access(text) to authenticated;
grant execute on function public.admin_decline_request(text) to authenticated;
