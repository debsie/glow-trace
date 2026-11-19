import type { FaceAreas } from "./face-mask";
import { rgbToLab, score } from "./image";
import { rednessScore } from "./redness-model";
import type { FaceDetails, FaceZones, PixelBuffer } from "./types";

/** A zone needs this many face-skin pixels to be read on its own. */
const MIN_ZONE_PIXELS = 400;

export const ZONE_LABEL: Record<keyof FaceZones, string> = {
  forehead: "Forehead",
  leftCheek: "Left cheek",
  rightCheek: "Right cheek",
  chin: "Chin and jaw",
};

/**
 * Redness read zone by zone, from the face-skin mask's bounding box: forehead (top 35%), cheeks
 * (middle, split down the centre) and chin and jaw (bottom 30%). Left and right are as seen in the
 * photo. Null without a mask or when a zone has too little skin.
 */
export const faceZones = (image: PixelBuffer, mask: Uint8Array | null): FaceZones | null => {
  if (!mask) return null;
  const { width, height } = image;
  let x0 = width;
  let x1 = -1;
  let y0 = height;
  let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (mask[y * width + x] !== 1) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  if (x1 < 0) return null;
  const h = y1 - y0 + 1;
  const midX = (x0 + x1) / 2;
  const zoneOf = (x: number, y: number): keyof FaceZones => {
    const t = (y - y0) / h;
    if (t < 0.35) return "forehead";
    if (t >= 0.7) return "chin";
    return x < midX ? "leftCheek" : "rightCheek";
  };
  const masks: Record<keyof FaceZones, Uint8Array> = {
    forehead: new Uint8Array(width * height),
    leftCheek: new Uint8Array(width * height),
    rightCheek: new Uint8Array(width * height),
    chin: new Uint8Array(width * height),
  };
  const counts: Record<keyof FaceZones, number> = {
    forehead: 0,
    leftCheek: 0,
    rightCheek: 0,
    chin: 0,
  };
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const i = y * width + x;
      if (mask[i] !== 1) continue;
      const zone = zoneOf(x, y);
      masks[zone][i] = 1;
      counts[zone] += 1;
    }
  }
  const keys = Object.keys(masks) as (keyof FaceZones)[];
  if (keys.some((key) => counts[key] < MIN_ZONE_PIXELS)) return null;
  const result = {} as FaceZones;
  for (const key of keys) result[key] = score(rednessScore(image, masks[key]));
  return result;
};

/** L* (CIE lightness) mean and specular share of the masked pixels. */
const lightness = (image: PixelBuffer, mask: Uint8Array) => {
  let sum = 0;
  let n = 0;
  const values: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== 1) continue;
    const [L] = rgbToLab(
      image.data[i * 4] ?? 0,
      image.data[i * 4 + 1] ?? 0,
      image.data[i * 4 + 2] ?? 0,
    );
    sum += L;
    n += 1;
    values.push(L);
  }
  return { mean: n ? sum / n : 0, n, values };
};

// Dark circles: how much darker the skin just under the lid is than the cheekbone just below it,
// in L* units. Measured on the reference selfie: L* climbs from about 60 at the lid to about 82 on
// the lit cheekbone, so ordinary shading already gives about 15. Span 30 puts that near 50.
// Provisional until calibrated on real dark-circle photos: the change over time is what counts.
const DARK_CIRCLE_SPAN = 30;
// Shine: share of pixels at least this many L* above the zone's own median (highlights).
const SHINE_LIFT = 12;
// Skin type thresholds on shine share (provisional, from the reference selfie).
const OILY_SHARE = 0.12;
const T_ZONE_RATIO = 2;

const shineShare = (zone: { values: number[] }) => {
  if (zone.values.length === 0) return 0;
  const sorted = [...zone.values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return zone.values.filter((value) => value > median + SHINE_LIFT).length / zone.values.length;
};

const merge = (a: Uint8Array, b: Uint8Array) => a.map((value, i) => (value || b[i] ? 1 : 0));

/**
 * Readings from the small face areas (face guide only): nose redness, dark circles against the
 * person's own cheek (fair across tones: no absolute colour is used) and a skin-type estimate from
 * shine on the nose against the cheeks. Null when an area has too few pixels.
 */
export const faceDetails = (image: PixelBuffer, areas: FaceAreas | null): FaceDetails | null => {
  if (!areas) return null;
  const under = lightness(image, merge(areas.underEyeLeft, areas.underEyeRight));
  const cheek = lightness(image, merge(areas.cheekLeft, areas.cheekRight));
  const nose = lightness(image, areas.nose);
  if (under.n < 60 || cheek.n < 60 || nose.n < 60) return null;
  const darker = Math.max(0, cheek.mean - under.mean);
  const tZone = shineShare(nose);
  const cheeks = shineShare(cheek);
  const skinType: FaceDetails["skinType"] =
    tZone >= OILY_SHARE && cheeks >= OILY_SHARE
      ? "oily"
      : tZone >= OILY_SHARE && tZone >= cheeks * T_ZONE_RATIO
        ? "combination"
        : "balanced";
  return {
    noseRedness: score(rednessScore(image, areas.nose)),
    darkCircles: score((darker / DARK_CIRCLE_SPAN) * 100),
    skinType,
  };
};
