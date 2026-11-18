import type { ScanCategory } from "../types";

/** Bumped whenever a formula or calibration constant changes, so stored reports stay traceable. */
export const KERNEL_VERSION = "mojocv-v1.3.0-ts-fallback";

export type { ScanCategory };

export type BiomarkerMetric = {
  /** Stable id, e.g. "erythema". */
  key: string;
  /** Display name, e.g. "Redness". */
  label: string;
  /** 0-100, rounded to one decimal. */
  value: number;
  /** "more" = a higher value means more of something to care for; "better" = higher is healthier. */
  higherMeans: "more" | "better";
  /** One plain-language sentence. */
  description: string;
};

export type ImageQuality = {
  width: number;
  height: number;
  /** 0-100 normalised gradient energy. */
  sharpness: number;
  /** False when the photo is too dark, too bright, too blurred or too small to score. */
  usable: boolean;
  /** Shown to the user when the photo is not usable. */
  notice?: string | undefined;
  /** Shown alongside a usable result when the light may skew colour readings. */
  warning?: string | undefined;
};

export type BiomarkerReport = {
  kernelVersion: string;
  category: ScanCategory;
  quality: ImageQuality;
  metrics: BiomarkerMetric[];
};

/** Minimal pixel buffer: the shape of the DOM's ImageData, so tests can build one without a DOM. */
export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray };
