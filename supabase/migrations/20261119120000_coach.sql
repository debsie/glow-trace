-- Paid plans and the written coach's daily allowance. Security lives here, not in the app:
-- a person can read only their own plan and usage; plans change only through admins (or a future
-- billing webhook with the service role); usage is counted only by the coach edge function.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'pro', 'studio')),
  source text not null default 'admin' check (source in ('admin', 'billing')),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "Read own plan" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Admins manage plans" on public.subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

revoke insert, update, delete, truncate on public.subscriptions from anon;

create trigger subscriptions_audit
  after insert or update or delete on public.subscriptions
  for each row execute function public.audit_row();

create table if not exists public.coach_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default (now() at time zone 'Africa/Johannesburg')::date,
  questions integer not null default 0 check (questions >= 0),
  primary key (user_id, day)
);

alter table public.coach_usage enable row level security;

create policy "Read own coach usage" on public.coach_usage
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.coach_usage from anon, authenticated;

-- Takes one question from today's allowance atomically. Returns the number left after this one,
-- or -1 when the allowance is used up. Only the edge function (service role) may call it.
create or replace function public.coach_consume(p_user uuid, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
  today date := (now() at time zone 'Africa/Johannesburg')::date;
begin
  if p_limit <= 0 then
    return -1;
  end if;
  insert into public.coach_usage (user_id, day, questions)
  values (p_user, today, 1)
  on conflict (user_id, day) do update
    set questions = public.coach_usage.questions + 1
    where public.coach_usage.questions < p_limit
  returning questions into used;
  if used is null then
    return -1;
  end if;
  return p_limit - used;
end;
$$;

revoke all on function public.coach_consume(uuid, integer) from public, anon, authenticated;
grant execute on function public.coach_consume(uuid, integer) to service_role;
