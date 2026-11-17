import type { Planes } from "./image";
import { gradientEnergy, highlightContrast, localMeanLumaStdDev, score } from "./image";
import type { BiomarkerMetric } from "./types";

// Calibration v1.1: strands are fine detail by nature. Sleek hair reads ≈ 15-25 gradient
// energy at 256 px; frizzy or porous hair ≈ 35-40.
const POROSITY_SPAN = 40;
// Calibration v1.1: highlight lift (0-1). Matte hair ≈ 0.1-0.2; a glossy band ≈ 0.6+.
const SHINE_WEIGHT = 140;
// Calibration v1.1: block-mean luma std dev includes the photo's framing; even coverage
// ≈ 10-20, visibly patchy ≈ 40+.
const DENSITY_WEIGHT = 2;

export const porosity = (planes: Planes): BiomarkerMetric => ({
  key: "porosity",
  label: "Porosity / Texture",
  value: score((gradientEnergy(planes) / POROSITY_SPAN) * 100),
  higherMeans: "more",
  description: "How rough and open the strands look.",
});

export const shine = (planes: Planes): BiomarkerMetric => ({
  key: "shine",
  label: "Shine",
  value: score(highlightContrast(planes) * SHINE_WEIGHT),
  higherMeans: "better",
  description: "How much light the strands reflect.",
});

export const densityVariance = (planes: Planes): BiomarkerMetric => ({
  key: "density",
  label: "Density Variance",
  value: score(localMeanLumaStdDev(planes) * DENSITY_WEIGHT),
  higherMeans: "more",
  description: "How patchy the coverage looks.",
});

export const analyzeHair = (planes: Planes): BiomarkerMetric[] => [
  porosity(planes),
  shine(planes),
  densityVariance(planes),
];
