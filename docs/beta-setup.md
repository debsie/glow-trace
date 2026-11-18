# Switching on beta sign-in (Lovable Cloud)

The code for sign-in is in place. Until Lovable Cloud is connected, the app runs as a demo
on each device. These steps happen in the Lovable editor and take about ten minutes.

## 1. Turn on Lovable Cloud

In your Lovable project, open **Cloud** and enable it. Lovable then sets
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the app automatically. Nothing
secret goes in the code.

## 2. Create the beta tables

Apply `supabase/migrations/20261117120000_beta_access.sql`. Either ask Lovable's chat to
"apply the migration in supabase/migrations/20261117120000_beta_access.sql", or paste the
file into **Cloud → Database → SQL editor** and run it. It creates:

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

## 4. Invite testers

In **Cloud → Database → beta_allowlist**, add a row per tester with their email in
lower case. Testers not on the list can still sign in, but land on a "You're early" screen
and can join the waitlist. Check **waitlist** for people asking to join, and copy those you
accept into **beta_allowlist**.

## What is and isn't stored

- In Lovable Cloud: email, name, invite and waitlist entries. Nothing else.
- On the device only: scans, photos, shelf, clients, lookbooks, plan and usage.
- Payments are not switched on. Plans still change only on the person's own device.
