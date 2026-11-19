-- The coach on every plan, within a monthly spend budget per user (millionths of a dollar) and a
-- daily question cap. Only the coach edge function (service role) reads or writes the counters;
-- people can read their own.

create table if not exists public.coach_spend (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null,
  micro_usd bigint not null default 0 check (micro_usd >= 0),
  primary key (user_id, month)
);

alter table public.coach_spend enable row level security;

create policy "Read own coach spend" on public.coach_spend
  for select to authenticated using (user_id = (select auth.uid()));

revoke insert, update, delete, truncate on public.coach_spend from anon, authenticated;

-- Before an answer: 'ok' (and counts the question), 'daily' or 'budget'.
create or replace function public.coach_begin(p_user uuid, p_daily integer, p_budget bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  this_month date := date_trunc('month', now() at time zone 'Africa/Johannesburg')::date;
  spent bigint;
begin
  select coalesce(sum(micro_usd), 0) into spent from public.coach_spend
    where user_id = p_user and month = this_month;
  if spent >= p_budget then
    return 'budget';
  end if;
  if public.coach_consume(p_user, p_daily) = -1 then
    return 'daily';
  end if;
  return 'ok';
end;
$$;

-- After an answer: adds what it actually cost.
create or replace function public.coach_record_spend(p_user uuid, p_micro_usd bigint)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.coach_spend (user_id, month, micro_usd)
  values (p_user, date_trunc('month', now() at time zone 'Africa/Johannesburg')::date, greatest(p_micro_usd, 0))
  on conflict (user_id, month) do update
    set micro_usd = public.coach_spend.micro_usd + excluded.micro_usd;
$$;

revoke all on function public.coach_begin(uuid, integer, bigint) from public, anon, authenticated;
revoke all on function public.coach_record_spend(uuid, bigint) from public, anon, authenticated;
grant execute on function public.coach_begin(uuid, integer, bigint) to service_role;
grant execute on function public.coach_record_spend(uuid, bigint) to service_role;
