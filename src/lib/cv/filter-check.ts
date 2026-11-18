import type { BiomarkerReport, PixelBuffer } from "./types";

/**
 * Beauty-filter check (pure). Filters smooth skin but keep eyes, brows and lips sharp, so the
 * ratio of fine detail in face skin to fine detail at those features falls. Fine detail is the mean
 * |luma - its 3x3 neighbourhood mean|, measured on a 640 px copy (at 256 px the skin texture a
 * filter removes is already gone). Measured on a real selfie: unfiltered 0.63-0.67 (also when soft
 * or low resolution), skin-only smoothing 30% 0.47, 60% 0.29, 90% 0.11. Provisional threshold.
 */
export const FILTER_RATIO = 0.45;

export const fineDetail = (image: PixelBuffer, mask: Uint8Array): number => {
  const { width: W, height: H, data } = image;
  const luma = new Float32Array(W * H);
  for (let i = 0; i < W * H; i += 1) {
    luma[i] =
      0.2126 * (data[i * 4] ?? 0) +
      0.7152 * (data[i * 4 + 1] ?? 0) +
      0.0722 * (data[i * 4 + 2] ?? 0);
  }
  let sum = 0;
  let n = 0;
  for (let y = 1; y < H - 1; y += 1) {
    for (let x = 1; x < W - 1; x += 1) {
      const i = y * W + x;
      if (mask[i] !== 1) continue;
      let around = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) around += luma[i + dy * W + dx] ?? 0;
      }
      sum += Math.abs((luma[i] ?? 0) - around / 9);
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
};

export type FilterCheck = { ratio: number; filtered: boolean };

/** Null when the features are too small or flat to compare. */
export const filterCheck = (
  image: PixelBuffer,
  skinMask: Uint8Array,
  featureMask: Uint8Array,
): FilterCheck | null => {
  const features = fineDetail(image, featureMask);
  if (features < 0.5) return null;
  const ratio = Math.round((fineDetail(image, skinMask) / features) * 1000) / 1000;
  return { ratio, filtered: ratio < FILTER_RATIO };
};

export const FILTER_WARNING =
  "This photo looks smoothed, as a beauty filter or portrait mode does. Retake it with the Glowtrace camera and no filters, or it won't count towards your progress";

/** Records the check on a report; a filtered photo gets a warning and is kept out of trends. */
export const withFilterCheck = (
  report: BiomarkerReport,
  check: FilterCheck | null,
): BiomarkerReport => {
  if (!check || !report.quality.usable) return report;
  return {
    ...report,
    quality: {
      ...report.quality,
      skinDetail: check.ratio,
      ...(check.filtered ? { filtered: true, warning: FILTER_WARNING } : {}),
    },
  };
};
