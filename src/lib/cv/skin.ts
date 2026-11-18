import type { Planes } from "./image";
import {
  brightnessVariance,
  gradientEnergy,
  hueCircularVariance,
  mean,
  score,
  specularRatio,
} from "./image";
import type { BiomarkerMetric } from "./types";

// Calibration v1.3 (SCIN sample, 159 close-up photos, Monk 1-10): skin redness a* rises with
// skin yellowness b* across skin tones, a* ≈ 3.21 + 0.539·b*. Redness is how far the skin's
// median a* sits above that line, so the same score means the same thing on every skin tone.
// Residual p10 ≈ -6, median ≈ -0.5, p90 ≈ +6. Mapped so a typical photo reads about 30.
const REDNESS_BASE_A = 3.21;
const REDNESS_A_PER_B = 0.539;
const REDNESS_RESIDUAL_LOW = -4.6;
const REDNESS_RESIDUAL_SPAN = 14;
// Skin pixels: plausible lightness, some red, hue between red and yellow. Below this share of
// the photo, fall back to every pixel rather than score a handful.
const MIN_SKIN_SHARE = 0.1;
// Calibration v1.1: on 256 px whole-area photos, smooth skin reads ≈ 8-11 gradient energy
// (edges and pores included) and coarse or blemished skin ≈ 16-20.
const TEXTURE_SPAN = 20;
// Calibration: weights for the hydration formula; flaky skin has high local spread, few highlights.
const HYDRATION_SPREAD_WEIGHT = 140;
const HYDRATION_SPECULAR_WEIGHT = 120;
const HYDRATION_SPECULAR_TARGET = 0.25;
// Calibration: circular hue variance of even skin ≈ 0-0.05; patchy ≥ 0.25.
const DISCOLORATION_WEIGHT = 400;

const medianOf = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/** Median a* and b* of skin-coloured pixels, or of every pixel when too few look like skin. */
export const skinColour = (planes: Planes): { a: number; b: number; share: number } => {
  const skinA: number[] = [];
  const skinB: number[] = [];
  for (let index = 0; index < planes.count; index += 1) {
    const L = planes.labL[index] ?? 0;
    const a = planes.labA[index] ?? 0;
    const b = planes.labB[index] ?? 0;
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    if (L > 20 && L < 95 && a > 2 && hue > 10 && hue < 80) {
      skinA.push(a);
      skinB.push(b);
    }
  }
  const share = planes.count === 0 ? 0 : skinA.length / planes.count;
  if (share < MIN_SKIN_SHARE) {
    return { a: mean(planes.labA), b: mean(planes.labB), share };
  }
  return { a: medianOf(skinA), b: medianOf(skinB), share };
};

export const erythema = (planes: Planes): BiomarkerMetric => {
  const { a, b } = skinColour(planes);
  const residual = a - (REDNESS_BASE_A + REDNESS_A_PER_B * b);
  return {
    key: "erythema",
    label: "Redness",
    value: score(((residual - REDNESS_RESIDUAL_LOW) / REDNESS_RESIDUAL_SPAN) * 100),
    higherMeans: "more",
    description: "How red the skin reads compared with what is typical for its tone.",
  };
};

export const skinTexture = (planes: Planes): BiomarkerMetric => ({
  key: "texture",
  label: "Texture Coarseness",
  value: score((gradientEnergy(planes) / TEXTURE_SPAN) * 100),
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

export const discoloration = (planes: Planes): BiomarkerMetric => ({
  key: "discoloration",
  label: "Discoloration",
  value: score(hueCircularVariance(planes) * DISCOLORATION_WEIGHT),
  higherMeans: "more",
  description: "How patchy the colour is.",
});

export const analyzeSkin = (planes: Planes): BiomarkerMetric[] => [
  erythema(planes),
  skinTexture(planes),
  hydration(planes),
  discoloration(planes),
];
