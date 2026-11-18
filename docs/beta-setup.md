# Switching on beta sign-in (Lovable Cloud)

The code for sign-in is in place. Until Lovable Cloud is connected, the app runs as a demo
on each device. These steps happen in the Lovable editor and take about ten minutes.

## 1. Turn on Lovable Cloud

In your Lovable project, open **Cloud** and enable it. Lovable then sets
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the app automatically. Nothing
secret goes in the code.

## 2. Create the beta tables

Apply both files in `supabase/migrations/`, oldest first:
`20261117120000_beta_access.sql`, then `20261118090000_beta_admin.sql`. Either ask Lovable's
chat to "apply the migrations in supabase/migrations", or paste each file into
**Cloud → Database → SQL editor** and run it. Together they create:

| Table / function      | What it is                                                                           |
| --------------------- | ------------------------------------------------------------------------------------ |
| `profiles`            | Name per account, created automatically on sign-up. Each person sees only their own. |
| `beta_allowlist`      | The invite list. Only you can edit it, from the dashboard.                           |
| `waitlist`            | Emails of people who asked to join. The app can add, never read.                     |
| `has_beta_access()`   | True when the signed-in email is on the invite list.                                 |
| `delete_my_account()` | Lets a person delete their own account (used by Delete Everything).                  |

## 3. Turn on sign-in methods

In **Cloud → Users → Authentication settings**:

- **Email:** on. Sign-in is by magic link; no passwords.
- **Google:** on. Lovable Cloud offers managed Google sign-in; or add your own Google OAuth
  client ID and secret from Google Cloud Console.
- **Redirect URLs:** add your site address followed by `/login`, for example
  `https://your-domain.co.za/login`, plus the Lovable preview address.

## 4. Make yourself the admin

Sign in to your app once (email link or Google), so your account exists. Then in
**Cloud → Database → SQL editor**, run this with your own email:

```sql
insert into public.beta_allowlist (email) values ('you@example.co.za')
  on conflict (email) do nothing;
insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = 'you@example.co.za';
```

Reload the app. You'll see **Beta dashboard** in the sidebar and on the home screen, at
`/admin`. Only accounts in `user_roles` with the admin role can open it, and the database
refuses admin actions from anyone else.

## 5. Run the beta from your dashboard

- **Requests:** people who sign in without access fill in a short request. Approve with
  14, 30 or 60 days, or decline.
- **Grant access:** type any email and pick 14, 30 or 60 days. Granting again adds days to
  what's left.
- **Testers:** days left per person, flagged "Ending soon" in the last 3 days. Extend or
  revoke. When access ends, the tester sees "Your beta access has ended" and can ask for
  more time.
- **Feedback:** testers send it from the Feedback button on every screen. It's sorted with
  open problems first (bug reports and 1-2 stars), then neutral, then praise. Mark
  items triaged or resolved. **Thank** opens a ready-written email in your mail app,
  quoting their words, and marks them thanked. Glowtrace doesn't send email itself yet.

## 6. Invite testers by hand (optional)

Rows added straight to **Cloud → Database → beta_allowlist** (email in lower case) have no
end date. Use the dashboard's **Grant access** instead when you want 14, 30 or 60 days.

## What is and isn't stored

- In Lovable Cloud: email, name, access requests, access dates and feedback. Nothing else.
- On the device only: scans, photos, shelf, clients, lookbooks, plan and usage.
- Payments are not switched on. Plans still change only on the person's own device.
