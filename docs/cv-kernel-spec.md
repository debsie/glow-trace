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

## Calibration v1.1 (implemented, `mojocv-v1.1.0-ts-fallback`)

The v1 constants above assumed tight close-up crops. Real photos include edges, background and
framing, and with them several indicators sat pinned at 0 or 100 on the bundled sample photos.
The shipped kernel changes these, measured against `src/assets/scan-{skin,hair,nails}.jpg`
downscaled to 256 px:

| Indicator                       | v1                       | v1.1                                                                                 |
| ------------------------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| Specular ratio                  | pixels > 0.92 × max luma | pixels > 0.92 × 99th-percentile luma (one hot pixel no longer hides every highlight) |
| Skin texture                    | gradient / 14            | gradient / 20                                                                        |
| Hair porosity                   | gradient / 18            | gradient / 40                                                                        |
| Hair shine                      | specular ratio × 500     | highlight lift (p99 − p50 luma, 0-1) × 140                                           |
| Hair density                    | block std dev × 9        | block std dev × 2                                                                    |
| Nail spots                      | outlier fraction × 700   | outlier fraction × 150                                                               |
| Nail ridges                     | gradient / 12            | gradient / 16                                                                        |
| Brightness variance (hydration) | not defined              | mean std dev of 0-1 luma inside 8 × 8 blocks                                         |

Sample-photo readings after v1.1: skin erythema 32.9, texture 52.4, hydration 68.1,
discoloration 5.9; hair porosity 57.9, shine 70.4, density 42.7; nails yellowness 0.0,
spots 55.3, ridges 48.9.

**Limits.** Three reference photos are not a calibration dataset. The kernel has no
segmentation, so background pixels affect texture, density and spot scores, and lighting
shifts colour readings. Before marketing any indicator as accurate, calibrate against a
labelled set of photos across skin tones, lighting and devices, and re-check that results
are consistent across skin tones.

## v1.2 (`mojocv-v1.2.0-ts-fallback`): colour-cast warning

- New optional `quality.warning`. No indicator formula or constant moved, so scores match v1.1.
- `highlightCast(planes)`: mean Lab a\*, b\* of the brightest 5% of pixels (white-patch
  assumption: highlights reflect the light source).
- If `hypot(a*, b*) > 22` the report carries a warning naming the cast: green when a\* < -8,
  otherwise warm (b\* > 0) or cool. Not raised when the photo is already unusable.
- The scan screen shows the warning above a scored result; the scan is still saved.
- `src/test/robustness.test.ts` re-scores synthetic skin patches under exposure, white-balance
  and blur changes and fails if an indicator moves more than its stated tolerance. Those
  tolerances are the honest limit of what a reading can claim: a change smaller than the
  tolerance between two scans is noise, not progress.

## v1.3 (`mojocv-v1.3.0-ts-fallback`): tone-adjusted redness

Why: run against 160 close-up photos from Google's SCIN dataset (`scripts/scin-report.ts`),
v1.2 redness read 0 on most real photos. It averaged a\* over the whole frame, so background and
phone colour pulled it below the old floor (a\* 9). Raw skin a\* also rises with skin tone (Monk
1-2 median 9.6, Monk 5-6 median 14.4), so a plain a\* score would call medium skin "red".

Formula:

- Skin pixels: L\* 20-95, a\* > 2, hue angle atan2(b\*, a\*) between 10° and 80°. If under 10% of
  the photo qualifies, use every pixel.
- `residual = median_skin_a − (3.21 + 0.539 × median_skin_b)`. The line is a least-squares fit of
  a\* on b\* across 159 SCIN photos spanning Monk 1-10.
- `redness = clamp((residual + 4.6) / 14 × 100)`. Residual p10 ≈ −6, median ≈ −0.5, p90 ≈ +6, so a
  typical photo reads about 30.

Results on the SCIN sample (median redness): Monk 1-2: 35.1, 3-4: 29.6, 5-6: 27.0, 7-10: 28.3.
Under a 4% warm or cool light shift redness now moves at most 5 points (v1.2: 14); the agent's
redness noise floor is 6. Other indicators are unchanged.

Limits: SCIN has no redness labels, so this fixes fairness and range, not accuracy. Condition
labels ("usually red" conditions) did not separate clearly, which is expected for small affected
areas in varied photos.

## Evaluated and not adopted (2026-11-18)

Tested on the same SCIN sample (`scripts/scin-report.ts`, helpers in `src/lib/cv/pigment.ts`).
Fairness = spread of skin-tone group medians, divided by the overall interquartile range
(lower is fairer).

| Redness candidate                                         | Fairness  | Note                                       |
| --------------------------------------------------------- | --------- | ------------------------------------------ |
| v1.3 Lab residual (shipped)                               | 0.20      |                                            |
| Pigment separation, optical density `dG − β·dB`, β fitted | 0.28-0.78 | Less fair at every β tried                 |
| Light correction (shades of grey, p = 6) before v1.3      | 0.45      | Washes out real skin colour with the light |

The "usually red conditions" signal moved between +0.43 and −0.17 across settings: with 31 such
photos it is noise, so it was not used to choose. Revisit pigment separation when there are
labelled ratings (opt-in contributions) to test against.

## v2.0 (`mojocv-v2.0.0-ts`): physics-supervised redness model

Redness is now a trained model; the other indicators are unchanged. Code:
`src/lib/cv/redness-model.ts`, weights `src/lib/cv/redness-weights.json`, training
`research/redness/`.

**How it is trained, without anyone labelling redness.** In optical density (OD = −ln
reflectance) light absorbers add (Beer-Lambert). Adding a known amount `c` of haemoglobin
(OD direction R:G:B ≈ 0.04 : 1 : 0.85, jittered ±20% per example because it is approximate) to
the skin pixels of a real photo gives a photo whose extra redness is known. Each example is two
views of the same SCIN photo, each under independent random light colour, exposure, blur and
sensor noise, one with `c` added (sometimes everywhere, sometimes as a soft patch). The model `f`
learns `f(B) − f(A) = c`, so it has to respond to blood and ignore light and camera. A fairness
term keeps `f`'s mean on unaltered photos equal across Monk skin-tone groups. Deeper tones,
rarer in SCIN, get twice the examples.

**Model.** Five small networks (18 → 32 → 32 → 1, tanh), averaged. Inputs: 10th, 50th and 90th
percentiles over skin pixels of `OD_green − OD_red`, `OD_blue − OD_red`, a\*, b\* and L\*, plus the
shades-of-grey light estimate (r, b) and the skin share. Output mapped so the training sample's
10th percentile reads 10 and its 90th reads 70. The TypeScript features and output match the
Python trainer to six decimals (`src/test/redness-model.test.ts`).

**Held-out results** (114 SCIN photos never used in training, 912 simulated pairs):

| Measure                                                                | v2 model | v1.3 formula |
| ---------------------------------------------------------------------- | -------- | ------------ |
| Correlation with the true added redness                                | 0.64     | 0.32         |
| Change caused by light alone, in haemoglobin units (lower is steadier) | 0.088    | 0.223        |
| Same, deepest skin (Monk 7-10)                                         | 0.050    | 0.193        |
| Gap between skin-tone group medians ÷ interquartile range              | 0.30     | 0.51         |

**Synthetic checks** (`robustness.test.ts`): a 4% warm or cool shift on the flat test patches moves
redness up to 7.4 points (v1.3: 5), so the tolerance and the agent's redness noise floor are 8.
The same added blood raises every skin tone by more than 5 points, with 7.8 points between the
largest and smallest rise.

**Limits.** The haemoglobin direction is an approximation, and simulated blood is not real
inflammation. This proves the model tracks blood-like colour change fairly and steadily; it does
not prove agreement with what people or clinicians call redness. The opt-in ratings are the test
for that, and the model must keep beating v1.3 there to stay.

## v2.1 (`mojocv-v2.1.0-ts`): optional face guide

Opt-in on skin scans. MediaPipe Face Landmarker (Apache-2.0, served from this site:
`public/mediapipe/face_landmarker.task`, runtime copied from `node_modules` by
`scripts/copy-mediapipe.ts`; about 18 MB, cached by the service worker) finds the face on a
640 px copy of the photo. `src/lib/cv/face-mask.ts` turns the landmarks into a mask at the
analysis size: the face outline shrunk to 92% about its centre, minus the eyes, brows and lips
enlarged to 130%. A face covering under 8% of the photo is ignored.

With a mask, every skin indicator reads only masked pixels: redness features, texture (pixel
pairs fully inside), hydration (8 px blocks at least 75% inside, highlights inside), and colour
evenness. The quality gate still judges the whole photo. Without the guide, or when no face is
found, results are identical to v2.0. Landmarks are never stored. The browser needs
`'wasm-unsafe-eval'` in `script-src`.

Not yet calibrated: texture and hydration constants were set on whole-area photos, so masked
readings sit lower (no hair or background edges). Compare scans taken with the same setting.

### Tone readouts for makeup (added in v2.1, indicators unchanged)

Skin reports carry `tone: { ita, hueAngle }`: medians over skin-coloured pixels (inside the face
mask when the guide is on) of ITA° = atan((L\* − 50) / b\*) and hue angle atan2(b\*, a\*).
`src/lib/makeup.ts` turns them, with the indicators, into shade depth (ITA bands of Chardon et
al. 1991), undertone (hue split around the SCIN median: under 48° cool, over 60° warm), finish,
primer, correctors and prep. The scan page and MUA client briefs show it. Undertone is marked
unsure when the scan warned about coloured light.

## v2.2 (`mojocv-v2.2.0-ts`): guided scans for nails and hair

- **Masks for every area.** `analyzeBiomarkers(category, image, areaMask)` reads hair indicators
  inside a hair mask (MediaPipe hair segmenter, about 0.8 MB) and records `quality.hairGuide`.
  Masked helpers: `highlightContrast`, block means (blocks at least 75% inside),
  `outlierFraction`, and nail yellowness via `maskedMean`. Trends compare only scans with the same
  guide settings.
- **Per-nail tiles.** MediaPipe Hand Landmarker (about 7.8 MB) finds the hand on a 1280 px copy of
  the photo. `nail-tiles.ts` places each nail 30% back from the fingertip towards the last joint,
  1.15 times the last bone long, and crops a 128 px tile; each tile is scored on its own.
- **Sessions** (`scan-session.ts`): skin one shot; nails a flat hand (four fingers) and the thumb;
  hair lengths (shine, porosity), parting or crown (density) and ends (porosity). Each indicator is
  the mean over the shots trusted for it and every tile within them.
- **Live camera check**: `frameHint` runs the same quality gate on a 160 px preview twice a
  second; the shutter waits until a photo would score (or, after five seconds, offers "Take photo
  anyway").
