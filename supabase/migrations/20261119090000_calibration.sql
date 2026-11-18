-- Calibration contributions: numbers only, never photos.
-- A tester can choose to share the scores the app computed on their device, plus their own
-- rating of what they see, so we can check the analysis against real people.
-- Deleting the account deletes every contribution (cascade). Testers can also delete them alone.

create table if not exists public.calibration_samples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  kernel_version text not null check (char_length(kernel_version) between 1 and 60),
  category text not null check (category in ('skin', 'hair', 'nails')),
  -- {indicator key: 0-100 score from the app}
  metrics jsonb not null check (jsonb_typeof(metrics) = 'object' and pg_column_size(metrics) < 1500),
  -- {indicator key: 1-5 rating from the person}
  self_report jsonb not null check (jsonb_typeof(self_report) = 'object' and pg_column_size(self_report) < 1500),
  lighting text not null check (
    lighting in ('daylight_window', 'outdoor_shade', 'indoor_warm', 'indoor_white', 'flash', 'other')
  ),
  sharpness real check (sharpness between 0 and 100),
  cast_warning boolean not null default false,
  -- Optional, self-assessed Fitzpatrick type (I to VI), to check results hold across skin tones.
  fitzpatrick smallint check (fitzpatrick between 1 and 6),
  -- Set when this is a repeat photo of an earlier contribution (a test-retest pair).
  repeat_of uuid references public.calibration_samples (id) on delete set null
);

create index if not exists calibration_samples_created_idx
  on public.calibration_samples (created_at desc);
create index if not exists calibration_samples_user_idx
  on public.calibration_samples (user_id);

alter table public.calibration_samples enable row level security;
revoke all on table public.calibration_samples from anon;

create policy "Testers contribute as themselves" on public.calibration_samples
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.has_beta_access()
    and (
      repeat_of is null
      or exists (
        select 1 from public.calibration_samples earlier
        where earlier.id = repeat_of and earlier.user_id = auth.uid()
      )
    )
  );

create policy "Read own contributions" on public.calibration_samples
  for select to authenticated using (user_id = auth.uid());

create policy "Delete own contributions" on public.calibration_samples
  for delete to authenticated using (user_id = auth.uid());

create policy "Admins read all contributions" on public.calibration_samples
  for select to authenticated using (public.is_admin());

-- No update policy: a contribution is never edited, only added or deleted.

-- At most 40 contributions per person per day, so a script cannot flood the table.
create or replace function public.limit_calibration_rate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.calibration_samples
    where user_id = new.user_id and created_at > now() - interval '1 day'
  ) >= 40 then
    raise exception 'Daily contribution limit reached';
  end if;
  return new;
end;
$$;

revoke execute on function public.limit_calibration_rate() from public, anon, authenticated;

create trigger limit_calibration_rate
  before insert on public.calibration_samples
  for each row execute function public.limit_calibration_rate();
