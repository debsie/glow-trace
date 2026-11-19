import type { Planes } from "./image";
import { gradientEnergy, highlightContrast, localMeanLumaStdDev, score } from "./image";
import { hairTextureSignal } from "./hair-model";
import type { BiomarkerMetric, PixelBuffer } from "./types";

// Calibration v1.1: strands are fine detail by nature. Sleek hair reads ≈ 15-25 gradient
// energy at 256 px; frizzy or porous hair ≈ 35-40.
const POROSITY_SPAN = 40;
// Calibration v1.1: highlight lift (0-1). Matte hair ≈ 0.1-0.2; a glossy band ≈ 0.6+.
const SHINE_WEIGHT = 140;
// Calibration v1.1: block-mean luma std dev includes the photo's framing; even coverage
// ≈ 10-20, visibly patchy ≈ 40+.
const DENSITY_WEIGHT = 2;

// Kernel v2.3: the trained texture model's roughness (training units) mapped to 0-100. A sleek
// reference photo reads ≈ -0.09 (score ≈ 11); the most roughness training added (+0.15) reads
// ≈ +0.02 (score ≈ 57). Provisional span; trends compare same-kernel scans only.
const TEXTURE_ZERO = -0.12;
const TEXTURE_SPAN = 0.24;

const textureScore = (
  planes: Planes,
  image: PixelBuffer | null,
  mask: Uint8Array | null,
  precomputed?: number | null,
) => {
  const signal =
    precomputed !== undefined ? precomputed : image ? hairTextureSignal(image, mask) : null;
  if (signal === null) return score((gradientEnergy(planes) / POROSITY_SPAN) * 100);
  return score(((signal - TEXTURE_ZERO) / TEXTURE_SPAN) * 100);
};

export const porosity = (
  planes: Planes,
  image: PixelBuffer | null = null,
  mask: Uint8Array | null = null,
  precomputed?: number | null,
): BiomarkerMetric => ({
  key: "porosity",
  label: "Porosity / Texture",
  value: textureScore(planes, image, mask, precomputed),
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

export const analyzeHair = (
  planes: Planes,
  image: PixelBuffer | null = null,
  mask: Uint8Array | null = null,
  precomputed?: number | null,
): BiomarkerMetric[] => [
  porosity(planes, image, mask, precomputed),
  shine(planes),
  densityVariance(planes),
];
