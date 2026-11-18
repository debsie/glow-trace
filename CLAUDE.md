# Glow Trace — Claude Code guide

@AGENTS.md

## Stack

TanStack Start + React 19 + Vite (plain `vite.config.ts`, Nitro building for Vercel), Tailwind v4 (oklch tokens in `src/styles.css`), shadcn/Radix UI, Zod, Vitest. Package manager: **bun** (`bun.lock`).

## Commands

- `bun install` — install deps (done automatically by the SessionStart hook)
- `bun run dev` — dev server on port 8080
- `bun run build` — production build
- `bun run test` — Vitest (run before every commit)
- `npx tsc --noEmit` — typecheck
- `bun run lint` / `bun run format` — ESLint + Prettier (keep both clean)

## Layout

- `src/routes/` — file-based routes (`/` is the marketing landing page with its own header; the app dashboard is `/app`); `src/routeTree.gen.ts` is generated, never edit by hand
- `src/components/` — UI; `src/components/ui/` is shadcn, regenerate rather than hand-edit
- `src/lib/` — pure logic (`beauty.ts`, `mock-data.ts`, `types.ts`); keep it framework-free and tested in `src/test/`
- `src/lib/plans.ts` — the three ZAR plans, their limits and every gate message; `src/lib/referrals.ts` — referral and partner rules; `src/lib/seo.ts` — page metadata and JSON-LD. Change prices, caps or rewards only here, and update `src/test/plans.test.ts` / `referrals.test.ts`
- Plan, monthly usage and invite state are device-local (`src/lib/storage.ts`, Zod-validated) until accounts and payments exist
- Scans, photos, shelf, clients and lookbooks persist in IndexedDB: `src/lib/vault.ts` (Zod schema, pure save/load transforms, tested) and `src/lib/vault-store.ts` (browser plumbing). Never store `blob:` URLs; photos live in their own store keyed by scan id. `/privacy` offers download and delete-all
- Offline: `public/sw.js` (hand-written service worker, registered in production only) and `public/manifest.webmanifest`. Bump `CACHE_VERSION` in `sw.js` when its caching rules change. Manifest colours are literal hex copies of the light theme tokens
- Format dates with `shortDate` / `longDate` from `src/lib/progress.ts`, never `toLocaleDateString`: locale formatting differs between server and browser and breaks hydration
- Sign-in (private beta): Supabase via `src/integrations/supabase/client.ts`, `src/context/auth.tsx` (email link + Google, beta check, waitlist, delete account), gate rules in `src/lib/access.ts` (tested), schema in `supabase/migrations/`. Without `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` the app runs in demo mode (see `.env.example`). Deploy and setup: `docs/deploy.md`. Only email, name, access and feedback live in Supabase; scans stay on the device
- Beta programme: rules in `src/lib/beta.ts` (14/30/60-day access, triage order, thank-you email; tested), data in `src/integrations/beta-api.ts` (Supabase, or the in-memory sample store `src/lib/beta-demo.ts` in demo mode), admin dashboard at `/admin`, Feedback button in the app shell. Admin rights live in the `user_roles` table and are enforced by RLS and the `admin_*` database functions, never by the app alone
- `src/lib/agent/` is the personal care agent: `knowledge.ts` (concerns, product profiles keyed by catalogue id, active-ingredient conflicts, DIY links) and `agent.ts` (findings, suggestions, question answering). Pure, on-device and deterministic; add a profile for every new catalogue product or the agent will ignore it. It is not a chatbot and sends nothing anywhere
- `src/lib/cv/` is the on-device analysis kernel (MojoCV). Bump `KERNEL_VERSION` and document the change in `docs/cv-kernel-spec.md` whenever a formula or constant changes
- Set `VITE_SITE_URL` to the live origin to switch on canonical URLs and absolute social-image links
- `docs/cv-kernel-spec.md` — spec for the on-device CV analysis kernel

## Rules

- TypeScript strict, no `any`, named exports, no `console.log`.
- Zod-validate payloads before they enter app state.
- Design system ("clinical atelier"): light Porcelain theme by default, dark Aubergine via the OS setting or `data-theme="dark"`.
- Semantic oklch tokens in `src/styles.css` only, never hardcoded colors. Flat surfaces: no gradients, glass, glow, shadows or sparkle icons. `primary` (garnet) is the only action colour, one primary button per view; fills use `text-primary-foreground`, never literal white.
- Fonts: Bricolage Grotesque (headings, weight 600), Hanken Grotesk (text), IBM Plex Mono via the `readout` utility for every measured value (one decimal).
- Radius: buttons `rounded-lg`, cards `rounded-xl` (`surface` utility), tabs and rows `rounded-2xl`, only badges, avatars and the workspace switcher `rounded-full`. Motion is welcome but quiet: scroll reveals (`Reveal`), the `lift` hover on interactive cards, `page-enter` on route change, animated gauges. Nothing bounces or scales up, and everything must switch off under `prefers-reduced-motion`.
- The product is "Glowtrace" — never "AI" in the name or button labels. Call results "wellness indicators", never a diagnosis. No emoji or exclamation marks in UI copy.
- WebGL decoration lives in `src/components/three/` (`ThreeCanvas` + `scenes.ts`): flat line and point work in theme tokens only, loaded on demand, paused off-screen, still under reduced motion. Keep it decorative (`aria-hidden`) and never required to read the page.
- Build screens from `Badge`, `Gauge`, `SectionCard`, `PrimaryButton`/`GhostButton` in `src/components/ui/bits.tsx`.
- Touch targets ≥50×50 px; `aria-live="polite"` for analysis progress/results; never rely on color alone.
- Children's data (COPPA/GDPR-K): keep data local or parent-owned; no third-party analytics or uploads of photos.
- Never force-push, rebase, or amend pushed commits. Every push to `main` deploys to production on Vercel, so keep it buildable.
- Proprietary code: do not add dependencies with copyleft licenses (GPL/AGPL) without asking.
- Extend tests in `src/test/` whenever logic rules change.

## Agent skills

### Issue tracker

GitHub Issues on `debsie/glow-trace`; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.
