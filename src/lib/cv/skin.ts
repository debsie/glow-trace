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

// Calibration: pale skin reads a* ≈ 9-13, inflamed/red skin ≈ 20-27.
const ERYTHEMA_A_LOW = 9;
const ERYTHEMA_A_SPAN = 18;
// Calibration v1.1: on 256 px whole-area photos, smooth skin reads ≈ 8-11 gradient energy
// (edges and pores included) and coarse or blemished skin ≈ 16-20.
const TEXTURE_SPAN = 20;
// Calibration: weights for the hydration formula; flaky skin has high local spread, few highlights.
const HYDRATION_SPREAD_WEIGHT = 140;
const HYDRATION_SPECULAR_WEIGHT = 120;
const HYDRATION_SPECULAR_TARGET = 0.25;
// Calibration: circular hue variance of even skin ≈ 0-0.05; patchy ≥ 0.25.
const DISCOLORATION_WEIGHT = 400;

export const erythema = (planes: Planes): BiomarkerMetric => ({
  key: "erythema",
  label: "Erythema / Redness",
  value: score(((mean(planes.labA) - ERYTHEMA_A_LOW) / ERYTHEMA_A_SPAN) * 100),
  higherMeans: "more",
  description: "How red the skin tone reads.",
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

export const analyzeSkin = (planes: Planes): BiomarkerMetric[] => [
  erythema(planes),
  skinTexture(planes),
  hydration(planes),
  discoloration(planes),
];
