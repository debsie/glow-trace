# Glowtrace — Claude Code guide

@AGENTS.md

Start with `docs/architecture.md`: it maps every feature to its files, so open only what you need.

## Commands

- `bun install` (automatic in cloud sessions) · `bun run dev` (port 8080) · `bun run build`
- Before every commit: `bun run test`, `npx tsc --noEmit`, `bun run lint`, `npx prettier --check .`

Stack: TanStack Start + React 19 on plain Vite (Nitro builds for Vercel), Tailwind v4, Zod 4,
Vitest, Supabase (sign-in and beta only), bun.

## Rules

- TypeScript strict, no `any`, named exports, no `console.log`. Zod-validate anything entering state.
- Pure logic lives in `src/lib/` with tests in `src/test/`; extend tests when rules change.
- Business rules have one home: prices and limits `plans.ts`, rewards `referrals.ts`, beta `beta.ts`,
  agent knowledge `agent/knowledge.ts` (every catalogue product needs a profile there).
- Analysis kernel (`src/lib/cv/`): bump `KERNEL_VERSION` and update `docs/cv-kernel-spec.md` on any
  formula or constant change.
- Dates: `shortDate` / `longDate` from `lib/progress.ts`, never `toLocaleDateString` (hydration).
- Device storage: never store `blob:` URLs; photos live in their own IndexedDB store.
- Supabase: security in row-level security and database functions, never only in the app. New
  migration file per change; run Supabase's security advisor afterwards.
- Security headers (`lib/security-headers.ts`): any new origin must be added there. No third-party
  scripts, fonts, analytics or embeds without updating the CSP, `/cookies` and `docs/legal/privacy.md`.
- Privacy: photos and scans stay on the device; only email, name, access, requests, feedback, the
  audit log, opt-in calibration numbers and photos a beta tester explicitly chooses to share for training (separate opt-in, per photo, 2-year limit, deleted on withdrawal) live in Supabase.
  Adults only (18+).
- Calibration (`docs/calibration-plan.md`): never claim clinical accuracy. Claims are repeatability
  and direction of change. Trends come from a Kalman filter (`lib/trend.ts`): a change counts at 95%
  certainty, with each indicator's noise floor (`NOISE_BY_CONCERN`, redness 8, measured in
  `robustness.test.ts`) taken as two standard deviations of a reading.

## Design system ("clinical atelier")

- Light Porcelain by default, dark Aubergine via OS or `data-theme="dark"`. Semantic oklch tokens in
  `src/styles.css` only; never hardcode colours. Flat surfaces: no gradients, glass, glow or shadows.
- `primary` (garnet) is the only action colour, one primary button per view; fills use
  `text-primary-foreground`. Bricolage Grotesque headings (600), Hanken Grotesk text, IBM Plex Mono
  via `readout` for measured values (one decimal). Fonts are self-hosted.
- Buttons `rounded-lg`, cards `rounded-xl` (`surface`), tabs and rows `rounded-2xl`; only badges,
  avatars and the workspace switcher are `rounded-full`. Touch targets ≥ 50 px.
- Motion is quiet (`Reveal`, `lift`, `page-enter`, animated gauges) and off under reduced motion.
  WebGL (`components/three/`) is decorative, token-coloured and loaded on demand.
- Name is "Glowtrace", never "AI" in names or buttons. Results are "wellness indicators", never a
  diagnosis. No emoji or exclamation marks. `aria-live="polite"` for analysis; never colour alone.
- Build from `Badge`, `Gauge`, `SectionCard`, `PrimaryButton` / `GhostButton` in `components/ui/bits.tsx`.

## Agent skills

Issues: GitHub Issues on `debsie/glow-trace` (`docs/agents/issue-tracker.md`). Triage labels:
`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`
(`docs/agents/triage-labels.md`). Domain docs: single `CONTEXT.md` and `docs/adr/`, created lazily
(`docs/agents/domain.md`).
