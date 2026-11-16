# Glowtrace AI — Mojo CV Analysis Engine Spec

Implementation spec for the on-device biomarker analysis kernel ("MojoCV v1, TypeScript fallback"). Build this in the Glowtrace AI draft. Keep the existing shell, routes, and mock state; only `/scan` gains real analysis.

## Hard rules (apply to all new code)

- TypeScript strict, no `any`, use `unknown` and narrow. Named exports everywhere.
- Zod-validate every payload before it enters app state.
- No `console.log`. Semantic oklch design tokens only — never hardcode colors. Dark-only theme.
- Touch targets ≥50×50 CSS px. `aria-live="polite"` on analysis progress/results. Never rely on color alone.
- No backend calls: the kernel runs entirely in the browser on the uploaded photo.

## New module layout

```text
src/lib/cv/
  kernel.ts    -> analyzeBiomarkers(category, imageData) -> BiomarkerReport
  image.ts     -> decode/downscale + color-space helpers (pure)
  skin.ts      -> erythema, texture coarseness, hydration, discoloration
  hair.ts      -> texture/porosity, shine, density variance
  nails.ts     -> yellowness, spot detection, ridge texture
  schemas.ts   -> Zod schemas for metrics + report
```

## Types & contracts

```ts
export const KERNEL_VERSION = "mojocv-v1.0.0-ts-fallback";
export type ScanCategory = "skin" | "hair" | "nails";

export interface BiomarkerMetric {
  key: string; // e.g. "erythema"
  label: string; // e.g. "Erythema / Redness"
  value: number; // 0-100, rounded to 1 decimal
  higherMeans: "more" | "better"; // drives gauge copy
  description: string; // one plain-language sentence
}

export interface ImageQuality {
  width: number;
  height: number;
  sharpness: number; // 0-100 normalized gradient energy
  usable: boolean; // false when too dark/blurred/small
  notice?: string; // shown to the user when not usable
}

export interface BiomarkerReport {
  kernelVersion: string;
  category: ScanCategory;
  quality: ImageQuality;
  metrics: BiomarkerMetric[];
}
```

`analyzeBiomarkers(category, imageData)` is a **pure function of the pixels**: same `ImageData` in, identical scores out. Timestamps and ids are added by the caller, not the kernel.

## Image pipeline (`image.ts`)

- `loadImageData(file: File, maxDim = 256): Promise<ImageData>` — `createImageBitmap` → draw on a canvas capped at 256px longest side → `getImageData`. Fall back to an `<img>` + regular canvas when `createImageBitmap`/`OffscreenCanvas` is unavailable.
- `rgbToLab(r, g, b): [L, a, b]` — sRGB → linear RGB → XYZ (D65) → CIELab. Pure math, no DOM.
- Helpers: `meanLuma`, `gradientEnergy` (mean absolute horizontal+vertical difference of luma), `specularRatio` (fraction of pixels with luma > 0.92 × max), `hueCircularVariance` (over chromatic pixels only: max(r,g,b) − min(r,g,b) > 24).

## Metric formulas (all clamp to 0-100, round to 1 decimal)

Constants are calibration values; document each inline with the assumed range.

### Skin

- **erythema** — mean a\* over all pixels; `score = clamp(((meanA − 9) / 18) × 100)`. Pale skin ≈ a\* 9-13, inflamed/red ≈ 20-27.
- **texture coarseness** — `score = clamp(gradientEnergy / 14 × 100)` (flat surface ≈ 0-4, coarse/blemished ≈ 10-14).
- **hydration** — higher = better hydrated: `score = clamp(100 − (brightnessVariance × 140 + (0.25 − specularRatio) × 120))`, floored at 0. Flaky/dry surfaces have high local brightness variance and few specular highlights.
- **discoloration** — `score = clamp(hueCircularVariance × 400)`.

### Hair

- **porosity/texture** — same gradient-energy mapping as skin texture but with hair calibration `/ 18 × 100`.
- **shine** — `score = clamp(specularRatio × 500)`.
- **density variance** — `score = clamp(localMeanLumaStdDev × 9)` (std dev over 16×16 blocks, sampled stride 4).

### Nails

- **yellowness** — mean b\*: `score = clamp(((meanB − 10) / 16) × 100)` (healthy pale nail ≈ b\* 10-14, yellowed ≈ 20-26).
- **spots/blemishes** — fraction of pixels deviating > 28 Lab ΔE from the median Lab color: `score = clamp(fraction × 700)`.
- **ridge texture** — gradient energy `/ 12 × 100`.

### Quality gate (before scoring)

- `usable = width ≥ 96 && sharpness ≥ 8 && meanLuma between 30 and 235`.
- When not usable, still return a report with `quality.notice` ("Photo too dark/blurred — retake or try better light") and empty metrics; the UI shows demo biomarkers with the notice instead of fake precision.

## Zod schemas (`schemas.ts`)

- `biomarkerMetricSchema`, `imageQualitySchema`, `biomarkerReportSchema` matching the interfaces above (value: `z.number().min(0).max(100)`; enums for category/higherMeans).
- `parseBiomarkerReport(input: unknown): BiomarkerReport` — throws a typed error on invalid data. The scan store calls this before writing `biomarkers_json`.

## Integration in `/scan`

1. Keep the current upload flow (drag-and-drop + file-picker fallback) and live preview.
2. Replace the staged mock analysis: after preview, the "analyzing" progress now decodes the image and runs the kernel. Keep the staged progress feel with `aria-live` updates ("Reading photo…", "Scoring biomarkers…", "Analysis complete").
3. Diagnostic gauges render the real `BiomarkerMetric[]` values; keep the existing gauge components, feeding `value` and using `higherMeans` for the plain-language caption. Show the kernel version as a small badge ("MojoCV v1 · on-device").
4. Store the parsed report in the mock scan record's `biomarkers_json` plus `raw_image` preview URL as today.
5. Fallbacks: decode failure or `quality.usable === false` → show demo biomarkers with the quality notice; camera-denied flow already falls back to the file picker.
6. Do not change `/routine`, `/pro/clients`, the lookbook, or the shell nav. "Compare Past Scans" and other actions keep working off the stored reports.

## Tests (extend the existing suite)

Use synthetic pixel fixtures — build `ImageData` directly from `Uint8ClampedArray` patterns, no real photos:

1. Uniform red image → erythema high (≥ 80); uniform pale (245, 240, 235) image → erythema low (≤ 15).
2. High-frequency checkerboard/noise image → texture coarseness high (≥ 70); flat mid-gray image → low (≤ 10).
3. Yellow-tinted image (240, 230, 120) → nail yellowness high (≥ 60).
4. Same fixture analyzed twice → deep-equal metric values (determinism).
5. Dark image (mean luma < 30) → `quality.usable === false` with a notice.
6. `parseBiomarkerReport` rejects a report with value 150.

## Definition of done

- Typecheck clean; all existing + new tests pass.
- In the browser: upload a photo (any image) on `/scan` → real gauges appear from the kernel, report is stored, and an unusable/dark image shows the notice + demo fallback.
