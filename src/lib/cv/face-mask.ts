/**
 * Face skin mask from face landmarks (pure). Fills the face outline, slightly shrunk to stay off
 * the hairline and jaw edge, and removes the eyes, brows and lips, slightly enlarged. Landmarks
 * are normalised 0-1 image coordinates from the face guide (MediaPipe Face Landmarker).
 */

export type Point = { x: number; y: number };
export type Connection = { start: number; end: number };

/** Orders a closed loop of landmark connections into one polygon of landmark indices. */
export const loopFromConnections = (connections: readonly Connection[]): number[] => {
  const next = new Map<number, number[]>();
  for (const { start, end } of connections) {
    next.set(start, [...(next.get(start) ?? []), end]);
    next.set(end, [...(next.get(end) ?? []), start]);
  }
  const first = connections[0]?.start;
  if (first === undefined) return [];
  const loop = [first];
  let previous = -1;
  let current = first;
  for (let guard = 0; guard < connections.length + 1; guard += 1) {
    const candidates = (next.get(current) ?? []).filter((index) => index !== previous);
    const step = candidates[0];
    if (step === undefined || step === first) break;
    loop.push(step);
    previous = current;
    current = step;
  }
  return loop;
};

/** Scales a polygon about its centroid (factor < 1 shrinks). */
export const scalePolygon = (points: readonly Point[], factor: number): Point[] => {
  if (points.length === 0) return [];
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  return points.map((point) => ({
    x: cx + (point.x - cx) * factor,
    y: cy + (point.y - cy) * factor,
  }));
};

/** Sets `value` for every pixel centre inside the polygon (even-odd scanline fill). */
export const fillPolygon = (
  mask: Uint8Array,
  width: number,
  height: number,
  polygon: readonly Point[],
  value: 0 | 1,
): void => {
  if (polygon.length < 3) return;
  const pixels = polygon.map((point) => ({ x: point.x * width, y: point.y * height }));
  for (let y = 0; y < height; y += 1) {
    const sy = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0; i < pixels.length; i += 1) {
      const a = pixels[i];
      const b = pixels[(i + 1) % pixels.length];
      if (!a || !b) continue;
      if (a.y <= sy === b.y <= sy) continue;
      crossings.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    crossings.sort((p, q) => p - q);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      const from = Math.max(0, Math.ceil((crossings[k] ?? 0) - 0.5));
      const to = Math.min(width - 1, Math.floor((crossings[k + 1] ?? 0) - 0.5));
      for (let x = from; x <= to; x += 1) mask[y * width + x] = value;
    }
  }
};

export type FaceRegions = {
  oval: readonly Connection[];
  exclude: readonly (readonly Connection[])[];
};

/** Below this share of the photo, a found face is too small to read; use the whole photo. */
export const MIN_FACE_SHARE = 0.08;

/** 1 = face skin. Returns null when the face covers too little of the photo. */
export const faceSkinMask = (
  landmarks: readonly Point[],
  regions: FaceRegions,
  width: number,
  height: number,
): Uint8Array | null => {
  const polygon = (connections: readonly Connection[]) =>
    loopFromConnections(connections).flatMap((index) => {
      const point = landmarks[index];
      return point ? [point] : [];
    });
  const mask = new Uint8Array(width * height);
  fillPolygon(mask, width, height, scalePolygon(polygon(regions.oval), 0.92), 1);
  for (const part of regions.exclude) {
    fillPolygon(mask, width, height, scalePolygon(polygon(part), 1.3), 0);
  }
  const share = mask.reduce((sum, value) => sum + value, 0) / mask.length;
  return share >= MIN_FACE_SHARE ? mask : null;
};
