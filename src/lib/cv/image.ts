import type { PixelBuffer } from "./types";

/**
 * Pure colour-space and statistics helpers, plus the one browser-only function that decodes
 * a photo into pixels. Everything except loadImageData is plain maths and runs in tests.
 */

export const clamp100 = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

export const round1 = (value: number): number => Math.round(value * 10) / 10;

/** clamp to 0-100, then round to one decimal: the shape of every metric value. */
export const score = (value: number): number => round1(clamp100(value));

/* ---------- Colour ---------- */

const srgbToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// D65 reference white.
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

const labF = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);

/** sRGB (0-255) → CIELab: L* 0-100, a* green(-)/red(+), b* blue(-)/yellow(+). */
export const rgbToLab = (r: number, g: number, b: number): [number, number, number] => {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  const fx = labF(x / XN);
  const fy = labF(y / YN);
  const fz = labF(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
};

/** Rec. 709 luma on 0-255 sRGB values. */
export const luma = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/* ---------- Per-image planes ---------- */

/** Pre-computed planes so each metric reads arrays instead of re-deriving colour per pixel. */
export type Planes = {
  width: number;
  height: number;
  count: number;
  /** 0-255 */
  luma: Float32Array;
  labL: Float32Array;
  labA: Float32Array;
  labB: Float32Array;
  /** True where the pixel has visible colour: max(r,g,b) − min(r,g,b) > 24. */
  chromatic: Uint8Array;
  /** Hue angle in radians, valid where chromatic is set. */
  hue: Float32Array;
};

const hueOf = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  return (h / 6) * Math.PI * 2;
};

export const toPlanes = (image: PixelBuffer): Planes => {
  const { width, height, data } = image;
  const count = width * height;
  const planes: Planes = {
    width,
    height,
    count,
    luma: new Float32Array(count),
    labL: new Float32Array(count),
    labA: new Float32Array(count),
    labB: new Float32Array(count),
    chromatic: new Uint8Array(count),
    hue: new Float32Array(count),
  };
  for (let index = 0; index < count; index += 1) {
    const offset = index * 4;
    const r = data[offset] ?? 0;
    const g = data[offset + 1] ?? 0;
    const b = data[offset + 2] ?? 0;
    planes.luma[index] = luma(r, g, b);
    const [L, A, B] = rgbToLab(r, g, b);
    planes.labL[index] = L;
    planes.labA[index] = A;
    planes.labB[index] = B;
    if (Math.max(r, g, b) - Math.min(r, g, b) > 24) {
      planes.chromatic[index] = 1;
      planes.hue[index] = hueOf(r, g, b);
    }
  }
  return planes;
};

/* ---------- Statistics ---------- */

export const mean = (values: Float32Array): number => {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
};

export const meanLuma = (planes: Planes): number => mean(planes.luma);

/** Mean of |Δx| + |Δy| of luma between neighbours (0-510). Flat ≈ 0; fine texture is high. */
export const gradientEnergy = (planes: Planes): number => {
  const { width, height, luma: values } = planes;
  if (width < 2 || height < 2) return 0;
  let sum = 0;
  let samples = 0;
  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const index = y * width + x;
      const here = values[index] ?? 0;
      sum +=
        Math.abs(here - (values[index + 1] ?? 0)) + Math.abs(here - (values[index + width] ?? 0));
      samples += 1;
    }
  }
  return samples === 0 ? 0 : sum / samples;
};

/**
 * Share of pixels in the highlight band: brighter than 92% of the 99th-percentile luma.
 * The percentile (rather than the single brightest pixel) keeps one blown-out pixel from
 * hiding every real highlight.
 */
export const specularRatio = (planes: Planes): number => {
  if (planes.count === 0) return 0;
  const sorted = Float32Array.from(planes.luma).sort();
  const reference = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))] ?? 0;
  if (reference === 0) return 0;
  const threshold = reference * 0.92;
  let bright = 0;
  for (const value of planes.luma) if (value > threshold) bright += 1;
  return bright / planes.count;
};

/** Lift of the brightest 1% over the typical pixel, on a 0-1 scale: how strongly highlights stand out. */
export const highlightContrast = (planes: Planes): number => {
  if (planes.count === 0) return 0;
  const sorted = Float32Array.from(planes.luma).sort();
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
  return Math.max(0, at(0.99) - at(0.5)) / 255;
};

/** Circular variance (0 = one hue, 1 = hues spread evenly) over chromatic pixels only. */
export const hueCircularVariance = (planes: Planes): number => {
  let sumCos = 0;
  let sumSin = 0;
  let samples = 0;
  for (let index = 0; index < planes.count; index += 1) {
    if (planes.chromatic[index] !== 1) continue;
    const angle = planes.hue[index] ?? 0;
    sumCos += Math.cos(angle);
    sumSin += Math.sin(angle);
    samples += 1;
  }
  if (samples === 0) return 0;
  return 1 - Math.hypot(sumCos, sumSin) / samples;
};

/** Means of square blocks of luma, sampling every `stride` block origin. */
const blockMeans = (planes: Planes, block: number, stride: number): number[] => {
  const { width, height, luma: values } = planes;
  const result: number[] = [];
  for (let top = 0; top + block <= height; top += stride) {
    for (let left = 0; left + block <= width; left += stride) {
      let sum = 0;
      for (let y = top; y < top + block; y += 1) {
        for (let x = left; x < left + block; x += 1) sum += values[y * width + x] ?? 0;
      }
      result.push(sum / (block * block));
    }
  }
  return result;
};

const stdDev = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

/** Std dev of 16×16 block-mean luma (sampled every 4 px), 0-255 scale: patchiness of density. */
export const localMeanLumaStdDev = (planes: Planes): number => stdDev(blockMeans(planes, 16, 4));

/**
 * Mean local brightness spread on a 0-1 scale: the std dev of luma inside each 8×8 block,
 * averaged over blocks. Flaky, uneven surfaces score higher than smooth ones.
 */
export const brightnessVariance = (planes: Planes): number => {
  const { width, height, luma: values } = planes;
  const block = 8;
  const spreads: number[] = [];
  for (let top = 0; top + block <= height; top += block) {
    for (let left = 0; left + block <= width; left += block) {
      const cell: number[] = [];
      for (let y = top; y < top + block; y += 1) {
        for (let x = left; x < left + block; x += 1) cell.push((values[y * width + x] ?? 0) / 255);
      }
      spreads.push(stdDev(cell));
    }
  }
  return spreads.length === 0 ? 0 : spreads.reduce((sum, value) => sum + value, 0) / spreads.length;
};

const median = (values: Float32Array): number => {
  if (values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
};

/** Share of pixels more than `threshold` ΔE76 away from the median Lab colour. */
export const outlierFraction = (planes: Planes, threshold = 28): number => {
  if (planes.count === 0) return 0;
  const mL = median(planes.labL);
  const mA = median(planes.labA);
  const mB = median(planes.labB);
  let outliers = 0;
  for (let index = 0; index < planes.count; index += 1) {
    const distance = Math.hypot(
      (planes.labL[index] ?? 0) - mL,
      (planes.labA[index] ?? 0) - mA,
      (planes.labB[index] ?? 0) - mB,
    );
    if (distance > threshold) outliers += 1;
  }
  return outliers / planes.count;
};

/* ---------- Decoding (browser only) ---------- */

/** Longest side photos are scaled to before scoring: enough detail, fast on any phone. */
export const MAX_DIM = 256;

const fitWithin = (width: number, height: number, maxDim: number) => {
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const drawToPixels = (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number,
): ImageData => {
  const { width, height } = fitWithin(sourceWidth, sourceHeight, maxDim);
  const canvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement("canvas"), { width, height });
  const context = canvas.getContext("2d", { willReadFrequently: true }) as
    CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
};

const loadWithImgElement = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode the photo"));
    img.src = url;
  });

/**
 * Decode a photo (a File/Blob, or a same-origin URL) and downscale it to at most `maxDim`
 * pixels on the longest side. Nothing leaves the device.
 */
export const loadImageData = async (
  source: Blob | string,
  maxDim = MAX_DIM,
): Promise<ImageData> => {
  const blob =
    typeof source === "string" ? await fetch(source).then((response) => response.blob()) : source;
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      try {
        return drawToPixels(bitmap, bitmap.width, bitmap.height, maxDim);
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the <img> path (older Safari, unusual formats).
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadWithImgElement(url);
    return drawToPixels(img, img.naturalWidth, img.naturalHeight, maxDim);
  } finally {
    URL.revokeObjectURL(url);
  }
};
