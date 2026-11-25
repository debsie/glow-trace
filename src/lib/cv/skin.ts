import type { Planes } from "./image";
import {
  brightnessVariance,
  gradientEnergy,
  hueCircularVariance,
  mean,
  score,
  specularRatio,
} from "./image";
import { rednessScore } from "./redness";
import type { BiomarkerMetric, PixelBuffer } from "./types";

// Calibration v1.1: on 256 px whole-area photos, smooth skin reads ≈ 8-11 gradient energy
// (edges and pores included) and coarse or blemished skin ≈ 16-20.
const TEXTURE_SPAN = 20;
// Calibration: weights for the hydration formula; flaky skin has high local spread, few highlights.
const HYDRATION_SPREAD_WEIGHT = 140;
const HYDRATION_SPECULAR_WEIGHT = 120;
const HYDRATION_SPECULAR_TARGET = 0.25;
// Even tone (kernel v2.14): the spread of skin colour as linear red/green and blue/green log
// ratios over small blocks. A brighter or darker photo leaves a ratio unchanged and a warm or cool
// light shifts every block by the same amount, so neither changes the spread; averaging blocks
// first keeps camera noise in darker skin from reading as patchiness. On the 234 labelled skin
// patches (128 px, blocks of 8) the spread runs 0.156 (10th percentile) to 0.662 (90th); those map
// to 10 and 70. Blocks of 3 px at MAX_DIM cover about the same skin as 8 px on a patch.
const TONE_BLOCK = 3;
const TONE_P10 = 0.156;
const TONE_P90 = 0.662;
const MIN_TONE_BLOCKS = 20;

/**
 * Kernel v2.12: median skin a* (see redness.ts), read from the light-corrected photo.
 */
export const erythema = (image: PixelBuffer, mask: Uint8Array | null = null): BiomarkerMetric => ({
  key: "erythema",
  label: "Redness",
  value: score(rednessScore(image, mask)),
  higherMeans: "more",
  description: "How much blood colour the skin shows, separated from skin tone and light.",
});

// Kernel v2.7: the trained skin-surface model's texture (training units, about 0.03-0.06 on real
// selfies) maps to 0-100 as signal / 0.1, which keeps scores in the range the v1.1 formula gave.
const MODEL_TEXTURE_SPAN = 0.1;

/**
 * Texture from the trained skin-surface model when the face guide found enough skin (`signal`
 * from skin-surface-model.ts), otherwise the v1.1 gradient formula on the whole area.
 */
export const skinTexture = (planes: Planes, signal: number | null = null): BiomarkerMetric => ({
  key: "texture",
  label: "Texture Coarseness",
  value:
    signal === null
      ? score((gradientEnergy(planes) / TEXTURE_SPAN) * 100)
      : score((signal / MODEL_TEXTURE_SPAN) * 100),
  higherMeans: "more",
  description: "How uneven the surface looks.",
});

export const hydration = (planes: Planes): BiomarkerMetric => ({
  key: "hydration",
  label: "Hydration",
  value: score(
    100 -
      (brightnessVariance(planes) * HYDRATION_SPREAD_WEIGHT +
        (HYDRATION_SPECULAR_TARGET - specularRatio(planes)) * HYDRATION_SPECULAR_WEIGHT),
  ),
  higherMeans: "better",
  description: "Smooth, lightly glowing surfaces score higher.",
});

const linear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const iqr = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.floor((sorted.length - 1) * q)] ?? 0;
  return at(0.75) - at(0.25);
};

/**
 * Colour spread of the skin (see TONE_BLOCK): the hypotenuse of the interquartile ranges of
 * log(R/G) and log(B/G) over blocks wholly inside the mask with no clipped or near-black pixel.
 * Null when fewer than MIN_TONE_BLOCKS blocks qualify.
 */
export const toneSpread = (image: PixelBuffer, mask: Uint8Array | null = null): number | null => {
  const { width, height, data } = image;
  const red: number[] = [];
  const blue: number[] = [];
  for (let by = 0; by + TONE_BLOCK <= height; by += TONE_BLOCK) {
    for (let bx = 0; bx + TONE_BLOCK <= width; bx += TONE_BLOCK) {
      let r = 0;
      let g = 0;
      let b = 0;
      let ok = true;
      for (let y = by; y < by + TONE_BLOCK && ok; y += 1) {
        for (let x = bx; x < bx + TONE_BLOCK; x += 1) {
          const i = y * width + x;
          const R = data[i * 4] ?? 0;
          const G = data[i * 4 + 1] ?? 0;
          const B = data[i * 4 + 2] ?? 0;
          if ((mask && mask[i] !== 1) || Math.min(R, G, B) < 12 || Math.max(R, G, B) >= 250) {
            ok = false;
            break;
          }
          r += linear(R);
          g += linear(G);
          b += linear(B);
        }
      }
      if (!ok) continue;
      red.push(Math.log(r / g));
      blue.push(Math.log(b / g));
    }
  }
  if (red.length < MIN_TONE_BLOCKS) return null;
  return Math.hypot(iqr(red), iqr(blue));
};

export const discoloration = (planes: Planes, image: PixelBuffer): BiomarkerMetric => {
  const spread = toneSpread(image, planes.mask);
  return {
    key: "discoloration",
    label: "Discoloration",
    // Fallback for very small skin areas: the v1 hue spread.
    value: score(
      spread === null
        ? hueCircularVariance(planes) * 400
        : 10 + ((spread - TONE_P10) / (TONE_P90 - TONE_P10)) * 60,
    ),
    higherMeans: "more",
    description: "How patchy the colour is.",
  };
};

/** Median ITA° and hue angle of skin-coloured pixels (inside the mask). Null when too few. */
export const skinTone = (planes: Planes): { ita: number; hueAngle: number } | null => {
  const ita: number[] = [];
  const hue: number[] = [];
  for (let index = 0; index < planes.count; index += 1) {
    if (planes.mask && planes.mask[index] !== 1) continue;
    const L = planes.labL[index] ?? 0;
    const a = planes.labA[index] ?? 0;
    const b = planes.labB[index] ?? 0;
    const angle = (Math.atan2(b, a) * 180) / Math.PI;
    if (!(L > 20 && L < 95 && a > 2 && angle > 10 && angle < 80)) continue;
    ita.push((Math.atan((L - 50) / b) * 180) / Math.PI);
    hue.push(angle);
  }
  if (ita.length < planes.count * 0.05 || ita.length < 50) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const round1 = (value: number) => Math.round(value * 10) / 10;
  return { ita: round1(median(ita)), hueAngle: round1(median(hue)) };
};

export const analyzeSkin = (
  planes: Planes,
  image: PixelBuffer,
  textureSignal: number | null = null,
): BiomarkerMetric[] => [
  erythema(image, planes.mask),
  skinTexture(planes, textureSignal),
  hydration(planes),
  discoloration(planes, image),
];
