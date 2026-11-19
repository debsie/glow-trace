-- Opt-in photo sharing for training (beta testers). Separate from beta access: joining the beta
-- never requires it. A person can add photos only while their consent is active, see and delete
-- only their own, and withdraw at any time (their photos are deleted). Admins can read them.
-- Photos are kept for 2 years at most.

create table if not exists public.training_consents (
  user_id uuid primary key references auth.users (id) on delete cascade,
  terms_version text not null check (length(terms_version) between 1 and 20),
  consented_at timestamptz not null default now(),
  withdrawn_at timestamptz
);

alter table public.training_consents enable row level security;

create policy "Read own consent" on public.training_consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Give own consent" on public.training_consents
  for insert to authenticated with check (user_id = (select auth.uid()) and withdrawn_at is null);
create policy "Renew own consent" on public.training_consents
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Admins read consents" on public.training_consents
  for select to authenticated using (public.is_admin());

create trigger training_consents_audit
  after insert or update or delete on public.training_consents
  for each row execute function public.audit_row();

create or replace function public.has_training_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.training_consents
    where user_id = auth.uid() and withdrawn_at is null
  );
$$;

revoke all on function public.has_training_consent() from public, anon;
grant execute on function public.has_training_consent() to authenticated;

create table if not exists public.training_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  path text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'),
  area text not null check (area in ('skin', 'hair', 'nails')),
  kernel_version text not null check (length(kernel_version) <= 40),
  scores jsonb not null default '{}'::jsonb check (pg_column_size(scores) < 4000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 years'
);

alter table public.training_photos enable row level security;

create policy "Share own photo while consenting" on public.training_photos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_training_consent()
    and split_part(path, '/', 1) = (select auth.uid())::text
  );
create policy "See own shared photos" on public.training_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Delete own shared photos" on public.training_photos
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "Admins read shared photos" on public.training_photos
  for select to authenticated using (public.is_admin());

revoke update, truncate on public.training_photos from anon, authenticated;

-- Private bucket: JPEG only, 2 MB at most, one folder per person.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('training-photos', 'training-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

create policy "Upload own training photo while consenting" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'training-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_training_consent()
  );
create policy "Read own training photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'training-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Delete own training photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'training-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Admins read training photos" on storage.objects
  for select to authenticated using (bucket_id = 'training-photos' and public.is_admin());
