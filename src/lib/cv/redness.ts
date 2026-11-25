import type { PixelBuffer } from "./types";
import { median, toPlanes } from "./image";

/**
 * Kernel v2.12 redness: the median CIELAB a* (green to red) of the skin pixels read, evened out
 * across skin tones (see medianRedness), mapped so the 10th to 90th percentile of the labelled
 * skin patches spans 10 to 70, the same scale the v2 model used. Chosen over the trained model
 * because it agreed with a trained eye on 118 of 152 clear pairs (78%; the model: 61%). Read
 * after the light-colour correction (v2.11).
 */
export const REDNESS_A_P10 = 0.9;
export const REDNESS_A_P90 = 27.2;

// Melanin mutes blood's colour: the same added blood moved a* about half as much on deep skin as
// on light skin. Scaling by reference lightness / skin lightness (L*) evens that out.
export const REDNESS_REF_L = 60;
// Power 0.75 (measured in robustness.test.ts): equal blood rises within 1.5 points across tones.
export const REDNESS_TONE_POWER = 0.75;
const MIN_L = 15;

/**
 * Median a* over the masked pixels (all pixels without a mask), scaled by REDNESS_REF_L over the
 * median L*, so equal blood reads equally on every skin tone; 0 when there are no pixels.
 */
export const medianRedness = (image: PixelBuffer, mask: Uint8Array | null = null): number => {
  const planes = toPlanes(image, mask);
  const a: number[] = [];
  const l: number[] = [];
  for (let i = 0; i < planes.count; i += 1) {
    if (mask && mask[i] !== 1) continue;
    a.push(planes.labA[i] ?? 0);
    l.push(planes.labL[i] ?? 0);
  }
  if (a.length === 0) return 0;
  const lightness = Math.max(MIN_L, median(Float32Array.from(l)));
  return median(Float32Array.from(a)) * (REDNESS_REF_L / lightness) ** REDNESS_TONE_POWER;
};

/** 0-100 before clamping: 10 at the 10th percentile of skin, 70 at the 90th. */
export const rednessScore = (image: PixelBuffer, mask: Uint8Array | null = null): number =>
  10 + ((medianRedness(image, mask) - REDNESS_A_P10) / (REDNESS_A_P90 - REDNESS_A_P10)) * 60;
