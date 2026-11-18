-- Close database functions to visitors who aren't signed in.
-- Supabase grants EXECUTE to the anon and authenticated roles directly, so the earlier
-- "revoke ... from public" left them callable through /rest/v1/rpc. Found by Supabase's
-- security advisor.

-- Nothing in Glowtrace is meant to be called without signing in.
revoke execute on function public.has_beta_access() from anon;
revoke execute on function public.my_beta_access() from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.delete_my_account() from anon;
revoke execute on function public.admin_grant_access(text, integer) from anon;
revoke execute on function public.admin_revoke_access(text) from anon;
revoke execute on function public.admin_decline_request(text) from anon;

-- The sign-up trigger runs as the database itself; nobody should call it through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- New functions in this schema start closed to anonymous visitors.
alter default privileges in schema public revoke execute on functions from anon;
