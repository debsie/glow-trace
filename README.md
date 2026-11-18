# Glowtrace

Skin, hair and nail check-ins from a photo, analysed on the device, with routines built from
the products you already own and tools for makeup artists. Built for South Africa; priced in
rands.

## Stack

TanStack Start (React 19, server rendering) on Vite, Tailwind CSS v4, Zod, Vitest. Supabase for
sign-in and the beta programme. Deployed on Vercel. Package manager: [bun](https://bun.sh).

## Develop

```sh
bun install
bun run dev        # http://localhost:8080
bun run test       # unit tests
bun run lint       # ESLint + Prettier
npx tsc --noEmit   # typecheck
```

Without Supabase settings the app runs in **demo mode**: no sign-in, sample data, everything
saved in the browser. To develop against Supabase, copy `.env.example` to `.env.local` and fill
it in.

## Deploy

See [`docs/deploy.md`](docs/deploy.md): Supabase project, database migrations, Vercel project,
environment variables, and making yourself the beta admin.

## Where things live

- `src/routes/` pages (file-based routing); `/` is the landing page, `/app` the dashboard,
  `/admin` the beta dashboard
- `src/lib/cv/` the on-device photo analysis engine; `src/lib/agent/` the care agent
- `src/lib/plans.ts`, `src/lib/referrals.ts`, `src/lib/beta.ts` business rules (all tested)
- `supabase/migrations/` database schema and security rules
- `docs/` product plan, analysis spec, legal drafts, deploy guide

## Licence

Copyright (c) 2026 debsie. All rights reserved. Proprietary software; see [LICENSE](LICENSE).
