-- Tamper-evident audit trail for everything that changes who can use Glowtrace or how
-- feedback is handled. Rows are written only by triggers; nobody (admins included) can edit
-- or delete them through the API, and only admins can read them.

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_key text,
  old_data jsonb,
  new_data jsonb
);

create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;

create policy "Admins read the audit log" on public.audit_log
  for select to authenticated using (public.is_admin());

-- Append-only: no insert, update or delete for any API role.
revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, actor_email, action, table_name, record_key, old_data, new_data)
  values (
    auth.uid(),
    nullif(lower(coalesce(auth.jwt() ->> 'email', '')), ''),
    tg_op,
    tg_table_name,
    coalesce(row_data ->> 'email', row_data ->> 'id', row_data ->> 'user_id'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

revoke execute on function public.audit_row() from public, anon, authenticated;

drop trigger if exists audit_beta_allowlist on public.beta_allowlist;
create trigger audit_beta_allowlist
  after insert or update or delete on public.beta_allowlist
  for each row execute function public.audit_row();

drop trigger if exists audit_waitlist on public.waitlist;
create trigger audit_waitlist
  after insert or update or delete on public.waitlist
  for each row execute function public.audit_row();

drop trigger if exists audit_user_roles on public.user_roles;
create trigger audit_user_roles
  after insert or update or delete on public.user_roles
  for each row execute function public.audit_row();

-- Feedback: log status changes and deletions, not every submission.
drop trigger if exists audit_feedback on public.feedback;
create trigger audit_feedback
  after update or delete on public.feedback
  for each row execute function public.audit_row();
