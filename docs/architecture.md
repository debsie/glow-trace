# Architecture map

Where each feature lives. Read this first, then open only the files you need.

## Pages (`src/routes/`, file-based; `routeTree.gen.ts` is generated)

| Route                                           | File                | Notes                                                     |
| ----------------------------------------------- | ------------------- | --------------------------------------------------------- |
| `/`                                             | `index.tsx`         | Marketing landing page; own header and footer             |
| `/pricing`, `/refer`, `/affiliates`, `/cookies` | same names          | Public; SEO metadata via `lib/seo.ts`                     |
| `/login`                                        | `login.tsx`         | Email link and Google sign-in                             |
| `/app`                                          | `app.tsx`           | Dashboard                                                 |
| `/scan`                                         | `scan.tsx`          | Photo analysis with `lib/cv`                              |
| `/routine`                                      | `routine.tsx`       | Routines, shelf, plan gates                               |
| `/agent`                                        | `agent.tsx`         | Care agent UI over `lib/agent`                            |
| `/progress`                                     | `progress.tsx`      | Charts (`components/progress/score-chart.tsx`)            |
| `/privacy`                                      | `privacy.tsx`       | Your Data: download, delete, sign out                     |
| `/admin`                                        | `admin.tsx`         | Beta dashboard: feedback, requests, testers, grant, audit |
| `/pro/clients/*`                                | `pro.clients.*.tsx` | MUA Studio client roster and lookbooks                    |
| `/sitemap.xml`                                  | `sitemap[.]xml.ts`  | Server route                                              |

`__root.tsx` holds site-wide head tags and providers. `components/layout/site-nav.tsx` is the app
shell, the access gate placement and navigation.

## Logic (`src/lib/`, pure and tested in `src/test/`)

| Area                              | Files                                                                                     | Tests                            |
| --------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------- |
| Photo analysis (MojoCV)           | `cv/kernel.ts`, `cv/image.ts`, `cv/skin.ts`, `cv/hair.ts`, `cv/nails.ts`, `cv/schemas.ts` | `cv-kernel.test.ts`              |
| Care agent                        | `agent/knowledge.ts` (rules, product profiles), `agent/agent.ts`                          | `agent.test.ts`                  |
| Plans and limits (ZAR)            | `plans.ts`                                                                                | `plans.test.ts`                  |
| Referral and partner rules        | `referrals.ts`                                                                            | `referrals.test.ts`              |
| Beta access, feedback, audit text | `beta.ts`, demo data `beta-demo.ts`                                                       | `beta.test.ts`                   |
| Access gate rules                 | `access.ts`                                                                               | `access.test.ts`                 |
| On-device storage                 | `vault.ts` (schema, transforms), `vault-store.ts` (IndexedDB), `storage.ts` (plan/usage)  | `vault.test.ts`, `plans.test.ts` |
| Progress and dates                | `progress.ts` (`shortDate`, `longDate`)                                                   | `progress.test.ts`               |
| SEO metadata and JSON-LD          | `seo.ts`                                                                                  | —                                |
| Security headers                  | `security-headers.ts`                                                                     | `security-headers.test.ts`       |
| Routines and care maths           | `routines.ts`, `beauty.ts`                                                                | `glowtrace-core.test.ts`         |

## State and services

- `context/app-state.tsx`: scans, shelf, clients, looks, plan and usage; loads and saves the vault.
- `context/auth.tsx`: Supabase session, beta access state, admin flag, request access, delete account.
- `integrations/supabase/client.ts`: the one Supabase client (null in demo mode).
- `integrations/beta-api.ts`: admin and feedback calls (Supabase or the demo store).

## Database (`supabase/migrations/`, apply in filename order, never edit applied files)

`profiles`, `beta_allowlist` (access windows), `waitlist` (requests), `feedback`, `user_roles`,
`audit_log` (append-only, trigger-written). Admin actions are `admin_*()` functions.

## Build and hosting

`vite.config.ts` (Nitro → Vercel, security headers via route rules), `vercel.json`,
`public/sw.js` (offline, registered in production only; bump `CACHE_VERSION` when its rules
change), `public/manifest.webmanifest` (colours are literal copies of the light tokens). Env:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (demo mode without them), `VITE_SITE_URL`
(canonical links). Deploy steps: `docs/deploy.md`.

## Docs

`docs/product-plan.md` (roadmap), `docs/cv-kernel-spec.md` (analysis formulas and calibration),
`docs/legal/` (draft terms and privacy), `SECURITY.md`.
