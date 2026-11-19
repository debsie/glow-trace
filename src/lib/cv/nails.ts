import type { Planes } from "./image";
import { gradientEnergy, maskedMean, outlierFraction, score } from "./image";
import type { BiomarkerMetric } from "./types";

// Kernel v2.4: the trained yellowing model's stain amount (training units) mapped to 0-100. Clean
// nail tiles read about -1.11 to -0.98 (score 15-37); adding the most stain training used (0.5)
// lifts a tile by 0.25-0.3 (score 52-86). Provisional span; trends compare same-kernel scans only.
const YELLOWING_ZERO = -1.2;
const YELLOWING_SPAN = 0.6;

// Calibration: healthy pale nail b* ≈ 10-14; yellowed ≈ 20-26.
const YELLOW_B_LOW = 10;
const YELLOW_B_SPAN = 16;
// Calibration v1.1: without segmentation, skin and background around the nail also count
// as outliers. A clean close-up ≈ 20-35% outlier pixels; spotted ≈ 60%+.
const SPOT_DELTA_E = 28;
const SPOT_WEIGHT = 150;
// Calibration v1.1: smooth plate ≈ 4-8 gradient energy at 256 px; ridged ≈ 14-16.
const RIDGE_SPAN = 16;

export const yellowness = (planes: Planes, trained?: number | null): BiomarkerMetric => ({
  key: "yellowness",
  label: "Yellowness",
  value:
    trained === undefined || trained === null
      ? score(((maskedMean(planes, planes.labB) - YELLOW_B_LOW) / YELLOW_B_SPAN) * 100)
      : score(((trained - YELLOWING_ZERO) / YELLOWING_SPAN) * 100),
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

export const analyzeNails = (planes: Planes, trained?: number | null): BiomarkerMetric[] => [
  yellowness(planes, trained),
  spots(planes),
  ridgeTexture(planes),
];
