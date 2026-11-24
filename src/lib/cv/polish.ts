import { rgbToLab } from "./image";
import type { PixelBuffer } from "./types";

/**
 * Polish check on one nail tile (the nail centred, skin around it, as cropTile cuts it). Polish
 * hides the nail, so its yellowing, spot and ridge readings would describe the polish: those
 * readings pause instead. Calibrated on 750 bare nail tiles (CC0 figshare set) and the same tiles
 * painted: 1 of 750 bare nails flagged (14 in very dim light); red, coral, pink, purple, black and
 * navy all caught; white about 3 in 4; nude polish looks like a bare nail and is not caught.
 */

export type PolishReason = "colour" | "hue" | "dark" | "white";

// Bare nails: chroma never above 29, hue 10-72 degrees (pink to beige), lightness 57-86.
const MAX_BARE_CHROMA = 35;
const MIN_HUE_CHROMA = 10;
const DARK_L = 45;
const DARK_BELOW_SKIN = 10;
const WHITE_L = 90;
const WHITE_CHROMA = 6;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Lightness, chroma and hue of the nail centre, and the lightness of the skin around it. */
export const nailLook = (tile: PixelBuffer) => {
  const { width: w, height: h, data } = tile;
  const centre = { L: [] as number[], a: [] as number[], b: [] as number[] };
  const ring: number[] = [];
  const edge = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const inCentre = ((y - h / 2) / (h * 0.25)) ** 2 + ((x - w / 2) / (w * 0.22)) ** 2 <= 1;
      const inRing = Math.min(x, y, w - 1 - x, h - 1 - y) < edge;
      if (!inCentre && !inRing) continue;
      const [L, A, B] = rgbToLab(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0);
      if (inCentre) {
        centre.L.push(L);
        centre.a.push(A);
        centre.b.push(B);
      } else ring.push(L);
    }
  }
  const a = median(centre.a);
  const b = median(centre.b);
  return {
    lightness: median(centre.L),
    chroma: Math.hypot(a, b),
    hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
    skinLightness: median(ring),
  };
};

/** Why this nail looks painted, or null when it looks bare. */
export const polishReason = (tile: PixelBuffer): PolishReason | null => {
  const look = nailLook(tile);
  if (look.chroma > MAX_BARE_CHROMA) return "colour";
  const skinHue = look.hue <= 85 || look.hue >= 350;
  if (look.chroma > MIN_HUE_CHROMA && !skinHue) return "hue";
  if (look.lightness < DARK_L && look.lightness < look.skinLightness - DARK_BELOW_SKIN)
    return "dark";
  if (look.lightness > WHITE_L && look.chroma < WHITE_CHROMA) return "white";
  return null;
};

export const POLISH_NOTICE = "Polish on this nail, so its readings are paused";
export const POLISH_NOTE =
  "These nails have polish on, so nail readings are paused. Scan bare nails to track them. Nude polish can't be told apart from a bare nail, so take it off first.";
