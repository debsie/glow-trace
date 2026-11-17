import type { Planes } from "./image";
import { gradientEnergy, mean, outlierFraction, score } from "./image";
import type { BiomarkerMetric } from "./types";

// Calibration: healthy pale nail b* ≈ 10-14; yellowed ≈ 20-26.
const YELLOW_B_LOW = 10;
const YELLOW_B_SPAN = 16;
// Calibration v1.1: without segmentation, skin and background around the nail also count
// as outliers. A clean close-up ≈ 20-35% outlier pixels; spotted ≈ 60%+.
const SPOT_DELTA_E = 28;
const SPOT_WEIGHT = 150;
// Calibration v1.1: smooth plate ≈ 4-8 gradient energy at 256 px; ridged ≈ 14-16.
const RIDGE_SPAN = 16;

export const yellowness = (planes: Planes): BiomarkerMetric => ({
  key: "yellowness",
  label: "Yellowness",
  value: score(((mean(planes.labB) - YELLOW_B_LOW) / YELLOW_B_SPAN) * 100),
  higherMeans: "more",
  description: "How much yellow staining shows.",
});

export const spots = (planes: Planes): BiomarkerMetric => ({
  key: "spots",
  label: "Spots / Blemishes",
  value: score(outlierFraction(planes, SPOT_DELTA_E) * SPOT_WEIGHT),
  higherMeans: "more",
  description: "How many marks stand out from the nail colour.",
});

export const ridgeTexture = (planes: Planes): BiomarkerMetric => ({
  key: "ridges",
  label: "Ridge Texture",
  value: score((gradientEnergy(planes) / RIDGE_SPAN) * 100),
  higherMeans: "more",
  description: "How ridged the surface looks.",
});

export const analyzeNails = (planes: Planes): BiomarkerMetric[] => [
  yellowness(planes),
  spots(planes),
  ridgeTexture(planes),
];
