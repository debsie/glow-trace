import { z } from "zod";

import type { PixelBuffer } from "./types";

/**
 * Steadier scans: the same distance, brightness and light colour as last time, so a change in a
 * reading is the skin, not the photo. A reference is saved per shot when a photo is taken and the
 * live camera coaches towards it. Three numbers per shot, kept on this device only.
 */

export const referenceSchema = z.object({
  /** Face (or subject) share of the frame. */
  share: z.number().min(0).max(1),
  /** Mean brightness of the centre of the frame, 0-255. */
  luma: z.number().min(0).max(255),
  /** (R - B) / (R + G + B) in the centre: above 0 warm light, below 0 cool. */
  warmth: z.number().min(-1).max(1),
  at: z.string(),
});
export type ScanReference = z.infer<typeof referenceSchema>;
export type FrameLook = Omit<ScanReference, "at">;

export const REFERENCE_KEY = "glowtrace:scan-reference:v1";

/** Brightness and light colour of the centre 40% of a frame, where the face sits. */
export const centreLook = (frame: PixelBuffer): { luma: number; warmth: number } => {
  const { width, height, data } = frame;
  const x0 = Math.floor(width * 0.3);
  const x1 = Math.ceil(width * 0.7);
  const y0 = Math.floor(height * 0.3);
  const y1 = Math.ceil(height * 0.7);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      r += data[i] ?? 0;
      g += data[i + 1] ?? 0;
      b += data[i + 2] ?? 0;
      n += 1;
    }
  }
  if (n === 0) return { luma: 0, warmth: 0 };
  const sum = r + g + b;
  return {
    luma: (0.299 * r + 0.587 * g + 0.114 * b) / n,
    warmth: sum > 0 ? (r - b) / sum : 0,
  };
};

// How far from last time still counts as the same: size ±20% (about ±10% distance), brightness
// ±15%, light colour ±0.05 (roughly daylight versus a warm bulb).
const SHARE_TOLERANCE = 0.2;
const LUMA_TOLERANCE = 0.15;
const WARMTH_TOLERANCE = 0.05;

export type Match = {
  distance: "ok" | "closer" | "further";
  light: "ok" | "brighter" | "darker";
  colour: "ok" | "warmer" | "cooler";
};

/** How this frame compares with last time's. "closer" means move closer, and so on. */
export const compareToReference = (now: FrameLook, ref: FrameLook): Match => {
  const size = now.share / Math.max(ref.share, 1e-6);
  const light = now.luma / Math.max(ref.luma, 1e-6);
  const colour = now.warmth - ref.warmth;
  return {
    distance: size < 1 - SHARE_TOLERANCE ? "closer" : size > 1 + SHARE_TOLERANCE ? "further" : "ok",
    light: light < 1 - LUMA_TOLERANCE ? "brighter" : light > 1 + LUMA_TOLERANCE ? "darker" : "ok",
    // Warmer now than then: the light needs to be cooler (and the other way round).
    colour: colour > WARMTH_TOLERANCE ? "cooler" : colour < -WARMTH_TOLERANCE ? "warmer" : "ok",
  };
};

/** One plain hint towards last time's photo; undefined when it matches. */
export const matchHint = (match: Match): string | undefined => {
  if (match.distance === "closer") return "Move a little closer, to match last time";
  if (match.distance === "further") return "Move back a little, to match last time";
  if (match.light === "brighter")
    return "Darker than last time. Face the same window or light you used before";
  if (match.light === "darker") return "Brighter than last time. Step out of direct light";
  if (match.colour === "cooler")
    return "The light is warmer than last time. Use daylight, as before, rather than a lamp";
  if (match.colour === "warmer")
    return "The light is cooler than last time. Use the same light as before";
  return undefined;
};

export const loadReferences = (): Record<string, ScanReference> => {
  try {
    const parsed = z
      .record(z.string(), referenceSchema)
      .safeParse(JSON.parse(window.localStorage.getItem(REFERENCE_KEY) ?? "{}"));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

export const saveReference = (shotId: string, look: FrameLook): void => {
  try {
    const all = loadReferences();
    all[shotId] = { ...look, at: new Date().toISOString() };
    window.localStorage.setItem(REFERENCE_KEY, JSON.stringify(all));
  } catch {
    // Not saved; the next scan simply has nothing to match.
  }
};
