import { z } from "zod";

import weightsJson from "./hair-weights.json";
import type { PixelBuffer } from "./types";

/**
 * Physics-supervised hair texture (kernel v2.3). A small U-Net trained on 2,867 real hair photos
 * where a known amount of fine strand roughness was added under random light, exposure, blur and
 * noise. It reads every pixel and outputs, per pixel, how much roughness it sees. Training code:
 * research/vision/multitask.py; packed for the app by research/vision/export_web.py. The forward
 * pass here must match the Python network exactly (tested in src/test/hair-model.test.ts).
 *
 * Only the texture head ships: it tracks the true amount (r = 0.93), stays quiet without it and
 * barely reacts to other effects. The shine head failed the shipping rule and is not used.
 */

const tensorSchema = z.object({ shape: z.array(z.number().int()), data: z.string() });
const weightsSchema = z.object({
  area: z.literal("hair"),
  heads: z.array(z.string()),
  size: z.literal(128),
  parity: z.record(z.string(), z.number()),
  tensors: z.record(z.string(), tensorSchema),
});

const SIZE = 128;
// Training multiplied the target maps by 10.
const TARGET_SCALE = 10;

type Conv = { out: number; inp: number; k: number; w: Float32Array; b: Float32Array };

const decode = (b64: string): Float32Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Float32Array(bytes.buffer);
};

let cached: {
  heads: string[];
  parity: Record<string, number>;
  convs: Record<"e1" | "e2" | "e3" | "mid" | "d2" | "d1" | "out", Conv>;
} | null = null;

const model = () => {
  if (cached) return cached;
  const parsed = weightsSchema.parse(weightsJson);
  const conv = (name: string): Conv => {
    const w = parsed.tensors[`${name}.weight`];
    const b = parsed.tensors[`${name}.bias`];
    if (!w || !b) throw new Error(`Missing hair model layer ${name}`);
    const [out = 0, inp = 0, k = 0] = w.shape;
    return { out, inp, k, w: decode(w.data), b: decode(b.data) };
  };
  cached = {
    heads: parsed.heads,
    parity: parsed.parity,
    convs: {
      e1: conv("e1.0"),
      e2: conv("e2.0"),
      e3: conv("e3.0"),
      mid: conv("mid.0"),
      d2: conv("d2.0"),
      d1: conv("d1.0"),
      out: conv("out"),
    },
  };
  return cached;
};

type Map = { c: number; h: number; w: number; data: Float32Array };

/** Conv2d with zero padding k/2, then ReLU when `relu`. */
const conv2d = (x: Map, layer: Conv, stride: number, relu: boolean): Map => {
  const { out, inp, k, w, b } = layer;
  const pad = (k - 1) / 2;
  const h = Math.floor((x.h + 2 * pad - k) / stride) + 1;
  const wd = Math.floor((x.w + 2 * pad - k) / stride) + 1;
  const result = new Float32Array(out * h * wd);
  const plane = h * wd;
  for (let o = 0; o < out; o += 1) result.fill(b[o] ?? 0, o * plane, (o + 1) * plane);
  for (let o = 0; o < out; o += 1) {
    const dst = o * plane;
    for (let i = 0; i < inp; i += 1) {
      const src = i * x.h * x.w;
      for (let ky = 0; ky < k; ky += 1) {
        for (let kx = 0; kx < k; kx += 1) {
          const weight = w[((o * inp + i) * k + ky) * k + kx] ?? 0;
          if (weight === 0) continue;
          for (let yy = 0; yy < h; yy += 1) {
            const sy = yy * stride + ky - pad;
            if (sy < 0 || sy >= x.h) continue;
            const row = src + sy * x.w;
            const dRow = dst + yy * wd;
            for (let xx = 0; xx < wd; xx += 1) {
              const sx = xx * stride + kx - pad;
              if (sx < 0 || sx >= x.w) continue;
              result[dRow + xx] = (result[dRow + xx] ?? 0) + weight * (x.data[row + sx] ?? 0);
            }
          }
        }
      }
    }
  }
  if (relu) for (let i = 0; i < result.length; i += 1) if ((result[i] ?? 0) < 0) result[i] = 0;
  return { c: out, h, w: wd, data: result };
};

/** Nearest-neighbour upsample of `x` to `target`'s size, then channel concat with `target`. */
const upCat = (x: Map, target: Map): Map => {
  const { h, w } = target;
  const data = new Float32Array((x.c + target.c) * h * w);
  for (let c = 0; c < x.c; c += 1) {
    for (let yy = 0; yy < h; yy += 1) {
      const sy = Math.floor((yy * x.h) / h);
      for (let xx = 0; xx < w; xx += 1) {
        const sx = Math.floor((xx * x.w) / w);
        data[(c * h + yy) * w + xx] = x.data[(c * x.h + sy) * x.w + sx] ?? 0;
      }
    }
  }
  data.set(target.data, x.c * h * w);
  return { c: x.c + target.c, h, w, data };
};

/** Network input: optical density / 3 for r, g, b plus the valid-pixel channel. */
const toInput = (canvas: Float32Array, valid: Uint8Array): Map => {
  const plane = SIZE * SIZE;
  const data = new Float32Array(4 * plane);
  for (let p = 0; p < plane; p += 1) {
    for (let c = 0; c < 3; c += 1) {
      data[c * plane + p] = -Math.log(((canvas[p * 3 + c] ?? 0) + 0.5) / 255.5) / 3;
    }
    data[3 * plane + p] = valid[p] ?? 0;
  }
  return { c: 4, h: SIZE, w: SIZE, data };
};

const forward = (input: Map): Map => {
  const { convs } = model();
  const s1 = conv2d(input, convs.e1, 1, true);
  const s2 = conv2d(s1, convs.e2, 2, true);
  const s3 = conv2d(conv2d(s2, convs.e3, 2, true), convs.mid, 1, true);
  const u2 = conv2d(upCat(s3, s2), convs.d2, 1, true);
  const u1 = conv2d(upCat(u2, s1), convs.d1, 1, true);
  return conv2d(u1, convs.out, 1, false);
};

/**
 * Fits the photo inside 128 x 128 at the top left (like training's thumbnail), area-averaging
 * when shrinking. Returns the canvas, the valid pixels and the area mask at canvas resolution.
 */
const toCanvas = (image: PixelBuffer, mask: Uint8Array | null) => {
  const scale = Math.min(1, SIZE / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = new Float32Array(SIZE * SIZE * 3);
  const valid = new Uint8Array(SIZE * SIZE);
  const area = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.floor((y * image.height) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * image.height) / h));
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.floor((x * image.width) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * image.width) / w));
      let r = 0;
      let g = 0;
      let b = 0;
      let inside = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = sy * image.width + sx;
          r += image.data[i * 4] ?? 0;
          g += image.data[i * 4 + 1] ?? 0;
          b += image.data[i * 4 + 2] ?? 0;
          inside += mask ? (mask[i] ?? 0) : 1;
          n += 1;
        }
      }
      const p = y * SIZE + x;
      canvas[p * 3] = Math.round(r / n);
      canvas[p * 3 + 1] = Math.round(g / n);
      canvas[p * 3 + 2] = Math.round(b / n);
      valid[p] = 1;
      area[p] = inside / n;
    }
  }
  return { canvas, valid, area };
};

/**
 * Mean predicted roughness over the hair, in training units (0 = as smooth as the base photos
 * trained on, 0.15 = the most roughness training added). Null when the mask holds no hair.
 */
export const hairTextureSignal = (
  image: PixelBuffer,
  mask: Uint8Array | null = null,
): number | null => {
  const { canvas, valid, area } = toCanvas(image, mask);
  const maps = forward(toInput(canvas, valid));
  const head = model().heads.indexOf("texture");
  const plane = SIZE * SIZE;
  let sum = 0;
  let weight = 0;
  for (let p = 0; p < plane; p += 1) {
    const a = area[p] ?? 0;
    if (a <= 0) continue;
    sum += a * (maps.data[head * plane + p] ?? 0);
    weight += a;
  }
  return weight < 16 ? null : sum / weight / TARGET_SCALE;
};

/** Parity reference from export_web.py, for the test. */
export const hairModelParity = (): Record<string, number> => model().parity;

/** The mean of every head over a fully valid 128 x 128 canvas (parity test only). */
export const hairHeadMeans = (canvas: Float32Array): Record<string, number> => {
  const valid = new Uint8Array(SIZE * SIZE).fill(1);
  const maps = forward(toInput(canvas, valid));
  const plane = SIZE * SIZE;
  const result: Record<string, number> = {};
  model().heads.forEach((head, k) => {
    let sum = 0;
    for (let p = 0; p < plane; p += 1) sum += maps.data[k * plane + p] ?? 0;
    result[head] = sum / plane / TARGET_SCALE;
  });
  return result;
};
