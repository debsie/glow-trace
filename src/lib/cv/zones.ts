import { score } from "./image";
import { rednessScore } from "./redness-model";
import type { FaceZones, PixelBuffer } from "./types";

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
