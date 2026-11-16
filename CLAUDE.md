# Glow Trace — Claude Code guide

@AGENTS.md

## Stack

TanStack Start + React 19 + Vite, Tailwind v4 (oklch tokens in `src/styles.css`), shadcn/Radix UI, Zod, Vitest. Package manager: **bun** (`bun.lock`).

## Commands

- `bun install` — install deps (done automatically by the SessionStart hook)
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run test` — Vitest (run before every commit)
- `npx tsc --noEmit` — typecheck
- `bun run lint` / `bun run format` — ESLint + Prettier (keep both clean)

## Layout

- `src/routes/` — file-based routes; `src/routeTree.gen.ts` is generated, never edit by hand
- `src/components/` — UI; `src/components/ui/` is shadcn, regenerate rather than hand-edit
- `src/lib/` — pure logic (`beauty.ts`, `mock-data.ts`, `types.ts`); keep it framework-free and tested in `src/test/`
- `src/lib/plans.ts` — the three ZAR plans, their limits and every gate message; `src/lib/referrals.ts` — referral and partner rules; `src/lib/seo.ts` — page metadata and JSON-LD. Change prices, caps or rewards only here, and update `src/test/plans.test.ts` / `referrals.test.ts`
- Plan, monthly usage and invite state are device-local (`src/lib/storage.ts`, Zod-validated) until accounts and payments exist
- Set `VITE_SITE_URL` to the live origin to switch on canonical URLs and absolute social-image links
- `docs/cv-kernel-spec.md` — spec for the on-device CV analysis kernel

## Rules

- TypeScript strict, no `any`, named exports, no `console.log`.
- Zod-validate payloads before they enter app state.
- Dark-only theme; semantic oklch tokens only, never hardcoded colors.
- Touch targets ≥50×50 px; `aria-live="polite"` for analysis progress/results; never rely on color alone.
- Children's data (COPPA/GDPR-K): keep data local or parent-owned; no third-party analytics or uploads of photos.
- Lovable sync: never force-push, rebase, or amend pushed commits. Keep the branch buildable.
- Proprietary code: do not add dependencies with copyleft licenses (GPL/AGPL) without asking.
- Extend tests in `src/test/` whenever logic rules change.

## Agent skills

### Issue tracker

GitHub Issues on `debsie/glow-trace`; external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.
