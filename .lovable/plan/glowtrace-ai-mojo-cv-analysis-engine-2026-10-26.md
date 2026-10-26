# Glowtrace AI — Mojo CV Analysis Engine

## What was found

- The Glowtrace AI draft (beauty app) is built and verified: `/scan`, `/routine`, `/pro/clients`, and the lookbook portal all run on typed mock data with 7 passing tests. The `/scan` diagnostic card currently shows staged mock biomarkers.
- The brief specifies an "Analysis Engine: Mojo CV kernel with TypeScript fallback for biomarker scoring". Per your decisions, this means building the real biomarker analysis engine (the "kernel"), running fully on-device in the browser — no backend, no AI vision calls.
- Drafts can only receive instructions from their own chat thread, so the build happens in the Glowtrace AI draft thread with this plan as the spec.

## What we propose

Implement the CV kernel: a deterministic, on-device image analysis pipeline that turns an uploaded skin/hair/nail photo into the biomarker scores the diagnostic card already displays — replacing the mock numbers with real pixel-derived ones.

Architecture (mirrors the brief's "kernel + fallback" concept):

```text
src/lib/cv/
  kernel.ts    -> analyzeBiomarkers(category, pixels) -> BiomarkerReport
                  (single entry point, versioned "MojoCV v1 / TS fallback")
  image.ts     -> decode + downscale to <=256px, ImageData helpers
  skin.ts      -> erythema (redness), texture coarseness, hydration proxy,
                  discoloration
  hair.ts      -> texture/porosity proxies, shine, density variance
  nails.ts     -> yellowness index, spot/blemish detection, ridge texture
  schemas.ts   -> Zod schemas; raw metrics validated before app state
```

- All functions are pure (input: `ImageData`, output: typed report) so they run and test without a DOM.
- Scores normalize to 0-100 per biomarker with fixed, documented formulas (RGB→Lab a\*-based redness, local-variance texture energy, specular/brightness-variance hydration proxy, hue-variance discoloration, yellowness b\* index for nails).
- Zod validates every payload before it enters app state; TypeScript strict, no `any`, named exports.

## Integration in the draft

1. `/scan` keeps its current upload flow; after decode, the staged "AI analysis" progress now runs the real kernel and the diagnostic gauges show the real, image-derived values.
2. `biomarkers_json` in the mock scan state stores the real report (including kernel version and, in plain terms, what each metric means).
3. Graceful fallbacks: undecodable/unsuitable image falls back to the demo biomarkers with a visible notice; analysis runs synchronously on the downscaled image so it stays well under a second; aria-live progress text as it already does.
4. No new routes and no changes to `/routine`, `/pro/clients`, or the lookbook; shell nav untouched.

## Tests

Extend the draft's test suite with kernel tests using synthetic pixel fixtures (no real photos needed):

- Uniform red image scores erythema high; pale smooth image scores it low.
- High-frequency noise image scores texture coarseness high; flat image scores it low.
- Yellow-tinted image scores nail yellowness high.
- Same image twice produces identical scores (determinism).

## Increments

1. Kernel modules + Zod schemas (pure logic) + tests passing.
2. Wire `/scan` to the kernel; verify real gauges from an uploaded photo in the browser.
3. Fallbacks + final browser verification of scan → diagnostic card flow.

## Handoff mechanics

After you approve: the plan/spec is saved into the project and synced into the Glowtrace AI draft; you then open the draft in the drafts panel and send a short "build the kernel per the spec" message there — that thread owns the code. Nothing changes in the main project, and the kids' focus board stays untouched until you later accept the draft.

## Uncertainties

- The draft's exact file/route names were reported by its build, not read here; the implementer adapts module paths to the draft's structure without changing this design.
- On-device heuristics are indicators, not medical measurements; copy already says "wellness indicators" and will keep that framing.
