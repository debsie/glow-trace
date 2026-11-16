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
- `bun run lint` / `bun run format` — ESLint + Prettier (the repo has pre-existing formatting errors; don't mass-reformat unrelated files)

## Layout

- `src/routes/` — file-based routes; `src/routeTree.gen.ts` is generated, never edit by hand
- `src/components/` — UI; `src/components/ui/` is shadcn, regenerate rather than hand-edit
- `src/lib/` — pure logic (`beauty.ts`, `mock-data.ts`, `types.ts`); keep it framework-free and tested in `src/test/`
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
