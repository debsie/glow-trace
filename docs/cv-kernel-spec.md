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

## Beauty-filter check (`src/lib/cv/filter-check.ts`, with the face guide)

Beauty filters, beauty mode and portrait mode smooth skin but keep eyes, brows and lips sharp. On
a 640 px copy, fine detail (mean |luma − 3×3 mean|) inside face skin is divided by fine detail
inside the eyes, brows and lips (`faceFeatureMask`, polygons enlarged to 130%). Measured on one
real selfie: unfiltered 0.663, half resolution 0.631, soft focus 0.666; skin-only smoothing at
30% 0.469, 60% 0.287, 90% 0.111. Below `FILTER_RATIO` = 0.45 the report gets `quality.filtered`,
a warning asking for a retake without filters, and is kept out of trends. Provisional: re-check
the threshold on more faces and phones before relying on it.

## v2.3 (`mojocv-v2.3.0-ts`): trained hair texture

Hair "Porosity / Texture" now comes from a physics-supervised U-Net (`hair-model.ts`, weights
`hair-weights.json`, packed by `research/vision/export_web.py`). It was trained on 2,867 real hair
photos with known strand roughness added under random light, exposure, blur and noise. Held-out:
correlation with the true amount 0.932, noise when absent 0.0057, leak from other effects 0.098.
The photo is fitted into 128 x 128 (area average), the texture map is averaged over the hair mask
(or the whole photo), and mapped to 0-100 with `TEXTURE_ZERO = -0.12`, `TEXTURE_SPAN = 0.24`
(provisional, set from one reference photo). Falls back to the v1.1 formula when the mask holds
fewer than 16 canvas pixels. Exposure changes of ±15% move the signal by < 0.02. The forward pass
matches the Python network to 4 decimals (`src/test/hair-model.test.ts`).

Not shipped from the same run: hair shine (r = 0.19, leak 0.25), nail spots (r = 0.15) and nail
ridges (r = 0.01). Nail yellowing passed (r = 0.79, even across all four tone bands, leak -0.02)
but its weights file has not arrived yet.

Also in v2.3:

- **Face zones** (`zones.ts`): with the face guide, redness is read separately for the forehead
  (top 35% of the face-skin box), left and right cheek (middle, split at the centre) and chin and
  jaw (bottom 30%), each with the same redness model. Saved as `report.zones`; a zone needs 400
  face-skin pixels or the zones are left out.
- **Light coach** (`lightTip` in `kernel.ts`): on the live camera, once the frame passes the
  quality gate, one tip: side light (one half > 1.5x brighter), overhead light (top > 1.6x the
  bottom) or a colour cast. A tip, never a block.
- **Training v3** (`research/vision/multitask.py`): new simulated effects, giving skin breakouts and
  dark circles, nail cuticles, and hair breakage and flakes. Pass `--size 256` for nails and hair so
  fine detail is visible. The app reads the size from the weights file. Each new head ships only
  after it passes the same rule.
- **Live subject check** (`subject-check.ts`, `measureSubject` in `guides.ts`): about once a second
  the camera runs the area's guide on a 320 px preview frame. The face must cover 12-60% of the
  frame, centred within 18%. A flat-hand shot needs four fingertips in frame, a thumb shot the
  thumb. Hair must fill 25% of the frame. The shutter waits for this as it does for light and focus
  ("Take photo anyway" after 5 s). If a guide cannot load, the camera works without it. Checked in
  a browser: each guide accepted its own sample photo and rejected the other two.
- **Fast runtime** (`onnx-runtime.ts`): ONNX Runtime Web (MIT) runs `public/models/hair.onnx` on
  WebGPU where available, otherwise WebAssembly, and `hairTextureSignalFast` falls back to the
  TypeScript forward pass if it cannot load. Measured in Chromium: same reading to six decimals,
  0.10 s against 1.04 s. Its runtime (about 5 MB compressed) loads only on a hair scan.

## v2.4 (`mojocv-v2.4.0-ts`): trained nail yellowing

Nail "Yellowness" now comes from the nails U-Net (`nails-model.ts`, `nails-weights.json`,
`public/models/nails.onnx`), trained at 256 px on 2,141 real nail photos with a known Beer-Lambert
stain added, balanced across four skin-tone bands. Held out: r = 0.754 (0.748-0.775 by tone band),
noise when absent 0.129, leak 0.209. Each 128 px nail tile is enlarged to 256 px and the yellowing
map is averaged, then mapped with `YELLOWING_ZERO = -1.2`, `YELLOWING_SPAN = 0.6` (provisional,
from tiles of one reference photo: clean 15-37, most training stain 52-86). In Chromium, ONNX
Runtime Web matches the TypeScript pass to six decimals, at 0.09 s against 3.7 s per nail. The
shared network code is `area-model.ts`.

Not shipped from training v3.2 (rule: r ≥ 0.7, leak ≤ 0.3, even across tone bands):

- nails: ridges r 0.79 but leak 0.56; spots 0.55; cuticle 0.24
- hair: shine 0.58; flakes 0.59 with leak 0.70 (texture 0.93 again; the shipped 128 px model stays)
- skin: six heads in one network diluted every one, so redness fell to 0.18 and texture to 0.77
  with leak 0.42. The v2 redness ensemble and the v1 formulas stay.

## v2.6 (`mojocv-v2.6.0-ts`): checked on real photos of two adult volunteers

16 photos (selfies, hands, nails, lengths, crowns; consented) run through every guide and indicator:

- Hair texture recalibrated: masked real hair reads -0.17 to -0.13 in training units, below
  v2.3's zero (-0.12), so every real photo scored 0. Now `TEXTURE_ZERO = -0.22`,
  `TEXTURE_SPAN = 0.3`: real hair 16-33, the sample photo about 57.
- Hair length: only when the hips and the hair's end are both inside the photo (selfies cut at the
  chest had guessed hips and read the frame edge as the end: mid-back, waist and bra strap for one
  person). Back views still fail (the pose model needs a face).
- Live check: crown and ends shots no longer wait for the hair finder (it misses close-ups of
  grey and blonde hair); face centring is looser vertically (selfies hold the face high).
- Seen, not yet fixed: one hand photo (hand flat, pointing down) found no hand; ITA read -18 on a
  fair face in shade, so shade matching should ask for daylight.

## v2.7 (`mojocv-v2.7.0-ts`): trained skin texture

Skin texture now comes from the v7 skin-surface model (`src/lib/cv/skin-surface-model.ts`,
`skin-surface-weights.json`, `public/models/skin-surface.onnx`) whenever the face guide finds enough
skin; otherwise the v1.1 gradient formula is used as before.

- **Model.** The `multitask.py` U-Net with a fifth input channel: luma optical density minus its 7x7
  reflect-padded box mean, times 30 (`area-model.ts` builds it when the weights file says `detail`).
  Trained (`train_glowtrace_v7_kaggle.ipynb`) on 16,878 real skin photos in all four ITA bands, as
  close-up 128 px patches with measured texture labels (change in fine-scale contrast), camera
  processing shared between both views, a blurred-copy anchor, and 169 "which is smoother" answers
  from a professional make-up artist. Texture head only: r 0.891 (0.87-0.92 by tone band), leak
  -0.12, blur 84% of the ideal, labeller agreement 81% (her own consistency 79%). Shine (r 0.46) and
  breakouts (leak 0.23) are not used.
- **Reading.** The photo is loaded at 1280 px, the face-guide skin mask is taken at that size, the
  photo is scaled (never enlarged, area-averaged) so the skin is about 360 px wide, and the 128 px
  tiles that are at least 60% skin (up to 12) are read; their mean is the signal. Fewer than two
  tiles falls back to the formula. Fast path: ONNX Runtime Web per tile, about 0.5-1.2 s a photo.
- **Score.** `texture = clamp(signal / 0.1 * 100)`; real selfies of three adults read 37-56,
  the same range the v1.1 formula gave.
- **Real-photo gate** (`research/vision/real_photo_gate.cjs`, consented photos on the developer's
  machine): blur 72% of the measured-detail effect (pass >= 70%), brightness +/-20% moves it 0.07
  of the between-person spread (pass <= 0.2), repeat photos of one person vary 0.87 against the
  photos' own measured detail 1.23 (pass <= 1.3x). Every photo gave 4-7 tiles through the app path.
- **Parity.** `src/test/skin-surface-model.test.ts` checks the TypeScript forward pass against
  PyTorch's reference means to 1e-4, and that rougher skin reads higher.

## v2.8 (`mojocv-v2.8.0-ts`): nail polish check

Each nail tile is checked for polish (`src/lib/cv/polish.ts`) before its readings are kept. The nail
centre (an ellipse 25% x 22% of the tile) and the skin ring (the outer 6%) are compared in CIELAB:

- chroma above 35 (bare nails never exceed 29): bright polish;
- chroma above 10 with a hue outside 0-85 or 350-360 degrees (skin and nail hues): blue, green,
  purple polish;
- lightness below 45 and at least 10 below the surrounding skin: dark polish (the skin comparison
  keeps dim photos and deep skin from being flagged);
- lightness above 90 with chroma below 6: white polish.

Calibrated on 750 bare nail tiles from the CC0 figshare set and the same tiles painted: 1 bare
nail flagged in normal light (14 at 55% brightness); red, coral, pink, purple, black and navy
caught every time; white 76%; nude polish not caught (it looks like a bare nail), which the result
note says. A painted nail keeps its tile and outline but its report is marked unusable with the
notice "Polish on this nail, so its readings are paused", so no polish reading enters a trend.

## v2.9 (`mojocv-v2.9.0-ts`): hair length on real photos, confirmed by the person

Checked on 300 real portraits (Unsplash Lite) with the result drawn on each photo. Before: 46 of
150 photos gave a length, many impossible (above the ears, twice the torso past the hips),
because the hair-end search started at the top of the photo and counted trees, sky and dark
backgrounds as hair. Changes:

- The search starts at the ears and the hair must begin within 5% of the photo below them.
- Shoulders and hips must be clearly visible (pose visibility >= 0.5), the torso at least 20% of
  the photo, shoulders level (tilt < 25% of the torso) and hips under them (drift < 50%).
- Hair counts only where the segmenter is more than 60% confident (not its category mask).
- A centre strip under the chin that is solid "hair" almost to the end means a dark top: no reading.
- Lengths above the ears or beyond 1.8 torso lengths are refused.

Result on uncontrolled photos: 24 of 300 read, about six in ten right by eye (misses: dark clothes
or backgrounds, several people, hair tied up). So every length is shown with "Is this where your
hair ends?": the person confirms or picks the band (a corrected band takes its middle position,
`bandMidpoint`), and only confirmed lengths count towards growth. The guided length shot (front,
hair forward, full torso) is far easier than these photos.

## v2.10 (`mojocv-v2.10.0-ts`): skin texture from v7 and v8 averaged

Each skin patch is read by both skin-surface models (v7, `skin-surface-weights.json`; v8, trained
also on the labeller's 257 round-2 answers, `skin-surface-v8-weights.json`) and the two readings
are averaged; the score mapping is unchanged. v8 alone failed the same-person check (1.92 against
1.6). The average passes every real-photo check (blur 105% of the ideal, exposure 0.07, same person
1.32) and agrees with the labeller on 69% of held-out clear pairs (75% on face skin), against 63%
for v7 and 66% for v8. Still short of the 70% release bar (`docs/release-readiness.md`). Parity is
tested for both models. Reading time roughly doubles (two forward passes per patch).

## v2.11 (`mojocv-v2.11.0-ts`): skin colour readings corrected for the colour of the light

The real-photo gate (`research/vision/indicator_gate.cjs`) showed redness moving 16 points, twice
its noise floor, under an 8% warm or cool light. Skin scans are now read from a copy of the photo
balanced to daylight (`balanceLight` in `image.ts`); the quality gate and the cast warning still
judge the photo as taken, and hair and nails are unchanged.

- Highlights: pixels at or above the 98th percentile of green, excluding green >= 250. Chosen by
  green alone because a warm or cool light scales red and blue but not green, so the same pixels
  are picked under any light even when red or blue clips.
- Target: highlight red:green:blue of 1 : 1 : 0.95, the median of daylight selfies measured.
- Gains: red and blue only (brightness unchanged), each `daylight / highlight` with the log gain
  capped at +/-0.12 (`MAX_BALANCE`, about 12%). An everyday warm or cool room is cancelled fully. A
  strong lamp is only partly corrected and the cast warning speaks. Skin-coloured highlights (soft
  light with no shine) get a small fixed nudge. A fade back to "no correction" was tried and
  rejected because it amplifies light changes inside the fade.
- Applies to redness (trained model), even tone, skin tone (ITA), zones, nose redness and dark
  circles. Texture (skin-surface models) reads the photo separately and is unchanged.
- Tests: `src/test/light-balance.test.ts` (an 8% warm or cool light moves redness and even tone
  by less than 2 points on a photo with shine); `robustness.test.ts` is unchanged and passes.
