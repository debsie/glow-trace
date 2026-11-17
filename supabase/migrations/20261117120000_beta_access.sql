-- Glowtrace beta: profiles, an invite list, a waitlist and self-service account deletion.
-- Scans and photos are NOT stored here: they stay on the person's device.

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "Update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Create a profile for every new account, named from Google or the email address.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Beta invite list ----------
-- Add testers here (Lovable Cloud → Database → beta_allowlist). Emails are stored lower-case.
create table if not exists public.beta_allowlist (
  email text primary key check (email = lower(email)),
  note text,
  added_at timestamptz not null default now()
);

alter table public.beta_allowlist enable row level security;
-- No policies: nobody can read or change the list from the app. Only the dashboard can.

-- True when the signed-in person's email is on the invite list.
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
  );
$$;

revoke all on function public.has_beta_access() from public;
grant execute on function public.has_beta_access() to authenticated;

-- ---------- Waitlist ----------
create table if not exists public.waitlist (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  requested_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

-- Signed-in people may add their own email once; nobody can read the list from the app.
create policy "Join waitlist with own email" on public.waitlist
  for insert to authenticated
  with check (email = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------- Delete my account ----------
-- Removes the account and, by cascade, the profile. Device data is cleared by the app.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  delete from public.waitlist where email = my_email;
  delete from auth.users where id = me;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
