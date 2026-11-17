import type { Biomarkers } from "../types";
import { analyzeHair } from "./hair";
import { clamp100, gradientEnergy, meanLuma, round1, toPlanes } from "./image";
import { analyzeNails } from "./nails";
import { analyzeSkin } from "./skin";
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

export const analyzeBiomarkers = (category: ScanCategory, image: PixelBuffer): BiomarkerReport => {
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
  if (!quality.usable) {
    return { kernelVersion: KERNEL_VERSION, category, quality, metrics: [] };
  }
  const metrics =
    category === "skin"
      ? analyzeSkin(planes)
      : category === "hair"
        ? analyzeHair(planes)
        : analyzeNails(planes);
  return { kernelVersion: KERNEL_VERSION, category, quality, metrics };
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
