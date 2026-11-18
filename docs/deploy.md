# Deploying Glowtrace (Supabase + Vercel)

Glowtrace runs on two services you own:

- **Supabase:** sign-in (email link and Google), and the beta tables (profiles, invite list,
  requests, feedback). Photos and scans never go here.
- **Vercel:** hosts the site. Every push to `main` deploys to production, and every pull request
  gets its own preview link.

Without Supabase settings the app still runs, in demo mode.

## 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com). Pick the region closest to most
   testers: **Johannesburg** if offered, otherwise **London** or **Frankfurt** (EU hosting suits
   the privacy policy; see `docs/legal/privacy.md`).
2. Apply the migrations in `supabase/migrations/`, **oldest first**:
   `20261117120000_beta_access.sql`, then `20261118090000_beta_admin.sql`. Either paste each into
   **SQL Editor** and run it, or with the Supabase CLI: `supabase link` then `supabase db push`.
3. **Authentication → Sign In / Providers**
   - **Email:** on (magic link). Turn off "Confirm email" only if you want to; links work
     either way.
   - **Google:** on. Create an OAuth client in Google Cloud Console (type: Web application) and
     paste its client ID and secret. In Google, add the callback URL Supabase shows you.
4. **Authentication → URL Configuration**
   - **Site URL:** your live address, e.g. `https://glowtrace.co.za`
   - **Redirect URLs:** `https://glowtrace.co.za/login`, `https://*-your-team.vercel.app/login`
     (preview deployments) and `http://localhost:8080/login`.
5. **Project Settings → API:** copy the **Project URL** and the **publishable** (or anon) key.

### What the database contains

| Table / function                        | What it is                                                             |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `profiles`                              | Name per account, created on sign-up. Each person sees only their own. |
| `beta_allowlist`                        | Who has access and until when. Managed from the beta dashboard.        |
| `waitlist`                              | Access requests. People add their own; only admins read them.          |
| `feedback`                              | Tester feedback. Testers add and read their own; admins see all.       |
| `user_roles`, `is_admin()`              | Who can open the beta dashboard.                                       |
| `has_beta_access()`, `my_beta_access()` | The access check and the person's own access window.                   |
| `admin_*()` functions                   | Grant, extend, revoke, decline. They refuse anyone who isn't an admin. |
| `delete_my_account()`                   | Lets a person delete their own account (Delete Everything).            |

## 2. Vercel project

1. Import the GitHub repository `debsie/glow-trace` at [vercel.com/new](https://vercel.com/new).
   Framework preset: **Other**. The build settings are in `vercel.json`, nothing to change.
2. **Settings → Environment Variables**, for Production and Preview:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key
   - `VITE_SITE_URL` = your live address (optional; switches on canonical links)
3. Deploy. Then add your domain under **Settings → Domains**, and update the Supabase Site URL
   and redirect URLs if the address changed.

These variables are built into the site, so redeploy after changing them.

## 3. Make yourself the admin

Sign in to the live site once (email link or Google) so your account exists. Then in Supabase
**SQL Editor**, with your own email:

```sql
insert into public.beta_allowlist (email) values ('you@example.co.za')
  on conflict (email) do nothing;
insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = 'you@example.co.za';
```

Reload. **Beta dashboard** appears in the sidebar and on the home screen (`/admin`). Only
accounts with the admin role can open it, and the database refuses admin actions from anyone
else.

## 4. Run the beta from the dashboard

- **Requests:** people who sign in without access fill in a short request. Approve for 14, 30
  or 60 days, or decline.
- **Grant access:** type any email and pick 14, 30 or 60 days. Granting again adds days to what
  is left.
- **Testers:** days left per person, flagged "Ending soon" in the last 3 days. Extend or revoke.
  When access ends the tester sees "Your beta access has ended" and can ask for more time.
- **Feedback:** sent from the Feedback button on every screen. Open problems first (bug reports
  and 1-2 stars), then neutral, then praise. **Thank** opens a ready-written email in your mail
  app and marks the person thanked. Glowtrace doesn't send email itself yet.

Rows added straight to `beta_allowlist` in the table editor have no end date.

## Local development against Supabase

Copy `.env.example` to `.env.local`, fill in the two Supabase values, and `bun run dev`.
Add `http://localhost:8080/login` to the Supabase redirect URLs.

## Building for another host

The server build targets Vercel. For a plain Node server instead:

```sh
NITRO_PRESET=node-server bun run build
node .output/server/index.mjs
```

## What is and isn't stored

- In Supabase: email, name, access requests, access dates and feedback. Nothing else.
- On the device only: scans, photos, shelf, clients, lookbooks, plan and usage.
- Payments are not switched on. Plans still change only on the person's own device.
