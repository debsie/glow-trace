import type { LengthBand } from "../hair-length";
import type { ScanCategory } from "../types";

/** Bumped whenever a formula or calibration constant changes, so stored reports stay traceable. */
export const KERNEL_VERSION = "mojocv-v2.5.0-ts";

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
  /** True when the face guide limited the skin indicators to face skin. */
  faceGuide?: boolean | undefined;
  /** Skin detail divided by detail at eyes, brows and lips (face guide only). Low means smoothed. */
  skinDetail?: number | undefined;
  /** True when the photo looks smoothed by a beauty filter; kept out of trends. */
  filtered?: boolean | undefined;
  /** True when the hair guide limited the hair indicators to hair pixels. */
  hairGuide?: boolean | undefined;
};

export type BiomarkerReport = {
  kernelVersion: string;
  category: ScanCategory;
  quality: ImageQuality;
  metrics: BiomarkerMetric[];
  /** Skin colour readouts for makeup matching (skin scans only). */
  tone?: SkinTone | undefined;
  /** Redness by face zone, 0-100 (face guide only). */
  zones?: FaceZones | undefined;
  /** Nose redness, dark circles and skin type (face guide only). */
  face?: FaceDetails | undefined;
  /** Hair length photo: band, position in torso units and stretched or natural. */
  hairLength?: HairLengthReading | undefined;
};

export type HairLengthReading = {
  band: LengthBand;
  position: number;
  state: "stretched" | "natural";
};

export type FaceDetails = {
  noseRedness: number;
  darkCircles: number;
  skinType: "oily" | "combination" | "balanced";
};

export type FaceZones = { forehead: number; leftCheek: number; rightCheek: number; chin: number };

/**
 * ITA° (individual typology angle, atan((L* - 50) / b*)) measures depth: higher is lighter.
 * Hue angle (atan2(b*, a*)) measures undertone: higher is more golden, lower more pink.
 */
export type SkinTone = { ita: number; hueAngle: number };

/** Minimal pixel buffer: the shape of the DOM's ImageData, so tests can build one without a DOM. */
export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray };
