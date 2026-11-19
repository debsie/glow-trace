/**
 * Glow-lapse framing: crop every photo to the same square around the face, so the face stays put
 * while the days change. Pure, so it is tested.
 */
export type Box = { x: number; y: number; w: number; h: number };

/**
 * A square crop (pixels) centred on the face, `margin` times the face's larger side, kept inside
 * the photo. Without a face, the largest centred square.
 */
export const lapseCrop = (face: Box | null, width: number, height: number, margin = 1.7): Box => {
  if (!face) {
    const side = Math.min(width, height);
    return { x: (width - side) / 2, y: (height - side) / 2, w: side, h: side };
  }
  const cx = (face.x + face.w / 2) * width;
  // A little above the face's centre, so the forehead and hairline fit.
  const cy = (face.y + face.h * 0.45) * height;
  const side = Math.min(width, height, Math.max(face.w * width, face.h * height) * margin);
  const x = Math.min(Math.max(cx - side / 2, 0), width - side);
  const y = Math.min(Math.max(cy - side / 2, 0), height - side);
  return { x, y, w: side, h: side };
};

/** Bounding box (0-1) of a set of points. */
export const boundsOf = (points: readonly { x: number; y: number }[]): Box | null => {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
