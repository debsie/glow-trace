import type { Planes } from "./image";
import {
  brightnessVariance,
  gradientEnergy,
  hueCircularVariance,
  mean,
  score,
  specularRatio,
} from "./image";
import { rednessScore } from "./redness-model";
import type { BiomarkerMetric, PixelBuffer } from "./types";

// Calibration v1.1: on 256 px whole-area photos, smooth skin reads ≈ 8-11 gradient energy
// (edges and pores included) and coarse or blemished skin ≈ 16-20.
const TEXTURE_SPAN = 20;
// Calibration: weights for the hydration formula; flaky skin has high local spread, few highlights.
const HYDRATION_SPREAD_WEIGHT = 140;
const HYDRATION_SPECULAR_WEIGHT = 120;
const HYDRATION_SPECULAR_TARGET = 0.25;
// Calibration: circular hue variance of even skin ≈ 0-0.05; patchy ≥ 0.25.
const DISCOLORATION_WEIGHT = 400;

/**
 * Kernel v2: physics-supervised redness model (see redness-model.ts). Reads the photo itself,
 * not the shared planes, because it needs raw camera values for optical density.
 */
export const erythema = (image: PixelBuffer, mask: Uint8Array | null = null): BiomarkerMetric => ({
  key: "erythema",
  label: "Redness",
  value: score(rednessScore(image, mask)),
  higherMeans: "more",
  description: "How much blood colour the skin shows, separated from skin tone and light.",
});

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

export const analyzeSkin = (planes: Planes, image: PixelBuffer): BiomarkerMetric[] => [
  erythema(image, planes.mask),
  skinTexture(planes),
  hydration(planes),
  discoloration(planes),
];
