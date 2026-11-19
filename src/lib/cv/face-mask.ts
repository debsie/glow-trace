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

/** 1 = eyes, brows and lips: the features a beauty filter leaves sharp while it smooths skin. */
export const faceFeatureMask = (
  landmarks: readonly Point[],
  regions: FaceRegions,
  width: number,
  height: number,
): Uint8Array => {
  const mask = new Uint8Array(width * height);
  for (const part of regions.exclude) {
    const polygon = loopFromConnections(part).flatMap((index) => {
      const point = landmarks[index];
      return point ? [point] : [];
    });
    fillPolygon(mask, width, height, scalePolygon(polygon, 1.3), 1);
  }
  return mask;
};

/**
 * Small face areas from face-mesh points (MediaPipe's 468-point canonical mesh): the nose, the
 * skin just under each eye (0.1-0.35 eye widths below the lid) and the cheekbone just below it
 * (0.55-0.75) as the person's own reference. The lower cheek is not used: it sits in the face's
 * own shadow, so it measured shape, not colour. Mesh
 * points used: 168 between the eyes, 2 under the nose, 98 and 327 the sides of the nose, 33 and
 * 133 the corners of the right eye (as the person sees it), 263 and 362 the left eye, 145 and 374
 * the middle of each lower lid.
 */
export type FaceAreas = {
  nose: Uint8Array;
  underEyeRight: Uint8Array;
  underEyeLeft: Uint8Array;
  cheekRight: Uint8Array;
  cheekLeft: Uint8Array;
};

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

export const faceAreaMasks = (
  landmarks: readonly Point[],
  width: number,
  height: number,
): FaceAreas | null => {
  const p = (index: number): Point | null => {
    const point = landmarks[index];
    return point ? { x: point.x * width, y: point.y * height } : null;
  };
  const [bridge, base, alaR, alaL, outR, inR, outL, inL, lidR, lidL] = [
    168, 2, 98, 327, 33, 133, 263, 362, 145, 374,
  ].map(p);
  if (!bridge || !base || !alaR || !alaL || !outR || !inR || !outL || !inL || !lidR || !lidL) {
    return null;
  }
  // "Down" along the face, so tilted faces still work.
  const length = Math.hypot(base.x - bridge.x, base.y - bridge.y) || 1;
  const down = { x: (base.x - bridge.x) / length, y: (base.y - bridge.y) / length };
  const shift = (point: Point, by: number): Point => ({
    x: point.x + down.x * by,
    y: point.y + down.y * by,
  });
  // Geometry in pixels (so distances are true on any aspect ratio); fillPolygon takes 0-1.
  const fill = (polygon: Point[]) => {
    const mask = new Uint8Array(width * height);
    const normalised = polygon.map((point) => ({ x: point.x / width, y: point.y / height }));
    fillPolygon(mask, width, height, normalised, 1);
    return mask;
  };
  const nose = fill([
    bridge,
    lerp(bridge, inL, 0.35),
    alaL,
    lerp(alaL, base, 0.5),
    base,
    lerp(alaR, base, 0.5),
    alaR,
    lerp(bridge, inR, 0.35),
  ]);
  // A band below an eye, from `from` to `to` eye-widths below the lower lid's middle.
  const band = (outer: Point, inner: Point, lid: Point, from: number, to: number) => {
    const eye = Math.hypot(outer.x - inner.x, outer.y - inner.y);
    const o = shift(lerp(outer, inner, 0.15), lid.y - (outer.y + inner.y) / 2);
    const i = shift(lerp(outer, inner, 0.85), lid.y - (outer.y + inner.y) / 2);
    return fill([
      shift(o, eye * from),
      shift(i, eye * from),
      shift(i, eye * to),
      shift(o, eye * to),
    ]);
  };
  return {
    nose,
    underEyeRight: band(outR, inR, lidR, 0.1, 0.35),
    underEyeLeft: band(outL, inL, lidL, 0.1, 0.35),
    cheekRight: band(outR, inR, lidR, 0.55, 0.75),
    cheekLeft: band(outL, inL, lidL, 0.55, 0.75),
  };
};
