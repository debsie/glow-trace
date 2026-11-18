import type { PixelBuffer } from "./types";

/**
 * Colour physics for skin, on the device.
 *
 * 1. Light correction. A "shades of grey" estimate (Finlayson and Trezzi, 2004) of the light's
 *    colour: the p-norm of each channel, which leans towards bright pixels. Each channel is then
 *    scaled so the estimate matches a reference daylight photo (von Kries adaptation). The
 *    reference is the median estimate over the SCIN calibration sample, not neutral grey,
 *    because skin photos are not grey on average.
 *
 * 2. Pigment separation. In optical density, OD = -ln(reflectance), absorbers add up (Beer-
 *    Lambert), and shading adds the same amount to every channel. Haemoglobin absorbs green far
 *    more than red; melanin absorbs more the shorter the wavelength. So, after removing shading by
 *    taking differences against red:
 *      dG = OD_green - OD_red  ≈ haemoglobin + some melanin
 *      dB = OD_blue  - OD_red  ≈ mostly melanin
 *    The haemoglobin index is dG - β·dB, with β chosen on the SCIN sample so the index does not
 *    move with skin tone. This follows the two-pigment model of Tsumura et al. (2003), with the
 *    melanin direction fitted once instead of per photo.
 */

export const SHADES_OF_GREY_P = 6;

export type Illuminant = { r: number; g: number; b: number };

/** The light's colour, normalised to sum to 1. Ignores clipped and near-black pixels. */
export const estimateIlluminant = (image: PixelBuffer, p = SHADES_OF_GREY_P): Illuminant => {
  const { data } = image;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const R = data[offset] ?? 0;
    const G = data[offset + 1] ?? 0;
    const B = data[offset + 2] ?? 0;
    const max = Math.max(R, G, B);
    if (max >= 250 || max <= 10) continue;
    r += (R / 255) ** p;
    g += (G / 255) ** p;
    b += (B / 255) ** p;
    n += 1;
  }
  if (n === 0) return { r: 1 / 3, g: 1 / 3, b: 1 / 3 };
  const er = (r / n) ** (1 / p);
  const eg = (g / n) ** (1 / p);
  const eb = (b / n) ** (1 / p);
  const sum = er + eg + eb || 1;
  return { r: er / sum, g: eg / sum, b: eb / sum };
};

/**
 * Scale channels so the photo's light estimate matches `reference`. Green keeps its level, so
 * overall brightness barely changes. Gains are capped so one odd photo cannot be pushed far.
 */
export const correctLight = (
  image: PixelBuffer,
  reference: Illuminant,
  maxGain = 1.35,
): PixelBuffer => {
  const estimate = estimateIlluminant(image);
  const clampGain = (value: number) => Math.min(maxGain, Math.max(1 / maxGain, value));
  const gainR = clampGain(reference.r / estimate.r / (reference.g / estimate.g));
  const gainB = clampGain(reference.b / estimate.b / (reference.g / estimate.g));
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = (image.data[offset] ?? 0) * gainR;
    data[offset + 1] = image.data[offset + 1] ?? 0;
    data[offset + 2] = (image.data[offset + 2] ?? 0) * gainB;
    data[offset + 3] = image.data[offset + 3] ?? 255;
  }
  return { ...image, data };
};

const od = (value: number): number => -Math.log((value + 0.5) / 255.5);

/** Shading-free density differences against red, for one pixel. */
export const densityDifferences = (r: number, g: number, b: number): { dG: number; dB: number } => {
  const odR = od(r);
  return { dG: od(g) - odR, dB: od(b) - odR };
};

/** Haemoglobin index for one pixel: green-band absorption with the melanin share removed. */
export const haemoglobinIndex = (r: number, g: number, b: number, beta: number): number => {
  const { dG, dB } = densityDifferences(r, g, b);
  return dG - beta * dB;
};
