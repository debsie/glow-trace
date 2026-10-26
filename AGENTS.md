<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- The Glowtrace AI beauty app lives in a project draft ("Glowtrace AI beauty app", drft_01m5vypj01f09rpwzhtryf5gj3); the main project stays the kids' focus board until the draft is accepted. The draft's CV analysis kernel spec is at `docs/cv-kernel-spec.md` (on-device, deterministic, Zod-validated).
- Glow Trace state (focus tasks, parent PIN) persists in localStorage via `src/hooks/use-focus-tasks.ts` and `src/hooks/use-parent-pin.ts`; when accounts are added, move this data to Lovable Cloud tables owned by the parent account (hackathon COPPA/GDPR-K rule).
- The theme is dark-only; all colors are semantic oklch tokens in `src/styles.css` (amber accent is `--glow`). Never hardcode colors in components.
- Pure app logic (tasks, PIN, progress) lives in `src/lib/focus.ts` and is covered by `src/test/glow-trace-core.test.ts` — extend those tests when the rules change.
