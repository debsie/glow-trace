import type { PixelBuffer } from "./types";

/**
 * Nail tiles from hand landmarks (pure). MediaPipe's 21 hand landmarks number each finger's
 * joints from the palm out; the last two of each finger (distal joint and tip) give the nail's
 * position and size: the nail sits just behind the tip, along the last bone.
 */

export type Point = { x: number; y: number };
export type Finger = "thumb" | "index" | "middle" | "ring" | "little";
export type TileBox = { finger: Finger; x: number; y: number; size: number };

/** [distal joint, tip] landmark indices per finger. */
const FINGERS: [Finger, number, number][] = [
  ["thumb", 3, 4],
  ["index", 7, 8],
  ["middle", 11, 12],
  ["ring", 15, 16],
  ["little", 19, 20],
];

/** Below this side length in pixels a nail is too small to read. */
export const MIN_TILE_PX = 24;

/** Square boxes in pixels around each visible nail, inside the image. */
export const nailBoxes = (landmarks: readonly Point[], width: number, height: number): TileBox[] =>
  FINGERS.flatMap(([finger, joint, tip]) => {
    const a = landmarks[joint];
    const b = landmarks[tip];
    if (!a || !b) return [];
    const ax = a.x * width;
    const ay = a.y * height;
    const bx = b.x * width;
    const by = b.y * height;
    const bone = Math.hypot(bx - ax, by - ay);
    // Nail centre: 30% of the way back from the tip to the distal joint.
    const cx = bx + (ax - bx) * 0.3;
    const cy = by + (ay - by) * 0.3;
    const size = Math.round(bone * 1.15);
    if (size < MIN_TILE_PX) return [];
    const x = Math.round(Math.min(Math.max(cx - size / 2, 0), width - size));
    const y = Math.round(Math.min(Math.max(cy - size / 2, 0), height - size));
    if (x < 0 || y < 0) return [];
    return [{ finger, x, y, size }];
  });

/** Crops a box and resamples it to `out` x `out` (bilinear). */
export const cropTile = (image: PixelBuffer, box: TileBox, out = 128): PixelBuffer => {
  const data = new Uint8ClampedArray(out * out * 4);
  const scale = box.size / out;
  for (let y = 0; y < out; y += 1) {
    for (let x = 0; x < out; x += 1) {
      const sx = Math.min(image.width - 1.001, Math.max(0, box.x + (x + 0.5) * scale - 0.5));
      const sy = Math.min(image.height - 1.001, Math.max(0, box.y + (y + 0.5) * scale - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 4; c += 1) {
        const at = (px: number, py: number) => image.data[(py * image.width + px) * 4 + c] ?? 0;
        const top = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
        const bottom = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
        data[(y * out + x) * 4 + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }
  return { width: out, height: out, data };
};
