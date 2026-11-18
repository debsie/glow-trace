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
export const erythema = (image: PixelBuffer): BiomarkerMetric => ({
  key: "erythema",
  label: "Redness",
  value: score(rednessScore(image)),
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

export const analyzeSkin = (planes: Planes, image: PixelBuffer): BiomarkerMetric[] => [
  erythema(image),
  skinTexture(planes),
  hydration(planes),
  discoloration(planes),
];
