import type { Biomarkers } from "../types";
import { analyzeHair } from "./hair";
import { clamp100, gradientEnergy, highlightCast, meanLuma, round1, toPlanes } from "./image";
import { analyzeNails } from "./nails";
import { analyzeSkin, skinTone } from "./skin";
import type { BiomarkerReport, ImageQuality, PixelBuffer, ScanCategory } from "./types";
import { KERNEL_VERSION } from "./types";

/**
 * The on-device analysis kernel. A pure function of the pixels: the same image always gives
 * identical scores. Ids and timestamps are added by the caller.
 */

// Quality gate. Sharpness is gradient energy scaled so that 14 (very textured) = 100.
const MIN_WIDTH = 96;
const MIN_SHARPNESS = 8;
const MIN_LUMA = 30;
const MAX_LUMA = 235;
// Colour-cast warning: highlight chroma (Lab) above this reads as coloured light.
// Skin highlights under daylight sit around 8-14; tungsten and LED casts land above 22.
const MAX_HIGHLIGHT_CHROMA = 22;

/** A warning, not a block: the photo is still scored, but readings may shift. */
export const castWarning = (cast: { a: number; b: number }): string | undefined => {
  if (Math.hypot(cast.a, cast.b) <= MAX_HIGHLIGHT_CHROMA) return undefined;
  const tone = cast.a < -8 ? "green" : cast.b > 0 ? "warm" : "cool";
  return `The light looks ${tone}, which can shift colour readings. Daylight from a window gives steadier results`;
};

const qualityNotice = (
  width: number,
  sharpness: number,
  brightness: number,
): string | undefined => {
  if (width < MIN_WIDTH) return "Photo too small — use a closer or higher-resolution photo";
  if (brightness < MIN_LUMA) return "Photo too dark — retake or try better light";
  if (brightness > MAX_LUMA) return "Photo too bright — move out of direct light and retake";
  if (sharpness < MIN_SHARPNESS) return "Photo too blurred — hold still and retake";
  return undefined;
};

/**
 * `areaMask`: 1 for the pixels to read. Skin: face skin from the face guide (no eyes, brows, lips,
 * hair or background). Hair: hair from the hair guide. Quality is always judged on the whole
 * photo; indicators only on the mask.
 */
export const analyzeBiomarkers = (
  category: ScanCategory,
  image: PixelBuffer,
  areaMask: Uint8Array | null = null,
): BiomarkerReport => {
  const planes = toPlanes(image);
  const sharpness = round1(clamp100((gradientEnergy(planes) / 14) * 100));
  const notice = qualityNotice(image.width, sharpness, meanLuma(planes));
  const quality: ImageQuality = {
    width: image.width,
    height: image.height,
    sharpness,
    usable: notice === undefined,
    ...(notice ? { notice } : {}),
  };
  const warning = notice ? undefined : castWarning(highlightCast(planes));
  if (warning) quality.warning = warning;
  if (areaMask && category === "skin") quality.faceGuide = true;
  if (areaMask && category === "hair") quality.hairGuide = true;
  if (!quality.usable) {
    return { kernelVersion: KERNEL_VERSION, category, quality, metrics: [] };
  }
  const area = areaMask ? toPlanes(image, areaMask) : planes;
  const metrics =
    category === "skin"
      ? analyzeSkin(area, image)
      : category === "hair"
        ? analyzeHair(area, image, areaMask)
        : analyzeNails(area);
  const tone = category === "skin" ? skinTone(area) : null;
  return { kernelVersion: KERNEL_VERSION, category, quality, metrics, ...(tone ? { tone } : {}) };
};

/** Overall 0-100 score for a report: higher is healthier. Null when nothing was scored. */
export const reportScore = (report: BiomarkerReport): number | null => {
  if (report.metrics.length === 0) return null;
  const health = report.metrics.map((metric) =>
    metric.higherMeans === "better" ? metric.value : 100 - metric.value,
  );
  return Math.round(health.reduce((sum, value) => sum + value, 0) / health.length);
};

const metricValue = (report: BiomarkerReport, key: string): number =>
  report.metrics.find((metric) => metric.key === key)?.value ?? 0;

/**
 * Map a report onto the five care dimensions the routine builder uses
 * (higher = more need for care in every dimension).
 */
export const reportToBiomarkers = (report: BiomarkerReport): Biomarkers => {
  const v = (key: string) => metricValue(report, key);
  if (report.category === "skin") {
    return {
      redness: v("erythema"),
      dryness: 100 - v("hydration"),
      texture: v("texture"),
      porosity: 0,
      discoloration: v("discoloration"),
    };
  }
  if (report.category === "hair") {
    return {
      redness: 0,
      dryness: 100 - v("shine"),
      texture: v("density"),
      porosity: v("porosity"),
      discoloration: 0,
    };
  }
  return {
    redness: 0,
    // Ridged nails are the clearest sign of a dry nail plate.
    dryness: v("ridges"),
    texture: v("spots"),
    porosity: 0,
    discoloration: v("yellowness"),
  };
};

/**
 * For the live camera: the same quality gate as a scan, on a small preview frame, so the
 * shutter only enables when the photo would be scored. Undefined means good to go.
 */
export const frameHint = (image: PixelBuffer): string | undefined => {
  const planes = toPlanes(image);
  const sharpness = round1(clamp100((gradientEnergy(planes) / 14) * 100));
  return qualityNotice(image.width, sharpness, meanLuma(planes));
};
