# Glowtrace: notes for coding agents

Read `CLAUDE.md` for the full project guide. The essentials:

- Run `bun run test`, `npx tsc --noEmit` and `bun run lint` before every commit; keep all three
  clean.
- Never force-push, rebase or amend commits that are already pushed. Keep `main` deployable:
  every push to it deploys to production on Vercel.
- Photos and scan results stay on the person's device. Only email, name, beta access,
  access requests, feedback, opt-in calibration numbers and photos explicitly shared for training (separate opt-in, per photo; see `docs/legal/privacy.md`) live in Supabase. Do not add analytics, trackers or uploads
  without updating `docs/legal/privacy.md` and asking the owner.
- Security for anything in Supabase lives in row-level security and the database functions in
  `supabase/migrations/`, never only in the app. Add schema changes as new migration files;
  never edit one that has been applied.
- Proprietary code: no GPL/AGPL dependencies without asking.
