import { z } from "zod";

import { rgbToLab } from "./image";
import { estimateIlluminant } from "./pigment";
import type { PixelBuffer } from "./types";
import weightsJson from "./redness-weights.json";

/**
 * Physics-supervised redness (kernel v2). A small ensemble of neural networks over 18 colour
 * statistics of the skin pixels, trained on photos where a known amount of haemoglobin was
 * added with the Beer-Lambert law under random light, exposure, blur and noise, plus a fairness
 * term across skin tones. Training code: research/redness/model.py. Features here must match
 * `features()` there exactly (tested in src/test/redness-model.test.ts).
 */

const PERCENTILES = [0.1, 0.5, 0.9] as const;
const MIN_SKIN_SHARE = 0.1;

const layerSchema = z.object({ w: z.array(z.array(z.number())), b: z.array(z.number()) });
const weightsSchema = z.object({
  version: z.string(),
  features: z.literal(18),
  members: z
    .array(
      z.object({
        mean: z.array(z.number()).length(18),
        std: z.array(z.number()).length(18),
        centre: z.number(),
        scale: z.number(),
        layers: z.array(layerSchema).min(1),
      }),
    )
    .min(1),
  score_p10: z.number(),
  score_p90: z.number(),
});

const WEIGHTS = weightsSchema.parse(weightsJson);

export const REDNESS_MODEL_VERSION = WEIGHTS.version;

const percentile = (values: Float64Array, q: number): number => {
  if (values.length === 0) return 0;
  const sorted = Float64Array.from(values).sort();
  return sorted[Math.floor(q * (sorted.length - 1))] ?? 0;
};

/** The 18 model inputs: percentiles of density differences and Lab, light estimate, skin share. */
export const rednessFeatures = (image: PixelBuffer, mask: Uint8Array | null = null): number[] => {
  const { data } = image;
  const count = image.width * image.height;
  const lab = new Float64Array(count * 3);
  const skin = new Uint8Array(count);
  let skinCount = 0;
  for (let i = 0; i < count; i += 1) {
    const [L, a, b] = rgbToLab(data[i * 4] ?? 0, data[i * 4 + 1] ?? 0, data[i * 4 + 2] ?? 0);
    lab[i * 3] = L;
    lab[i * 3 + 1] = a;
    lab[i * 3 + 2] = b;
    const hue = (Math.atan2(b, a) * 180) / Math.PI;
    if ((mask === null || mask[i] === 1) && L > 20 && L < 95 && a > 2 && hue > 10 && hue < 80) {
      skin[i] = 1;
      skinCount += 1;
    }
  }
  const share = count === 0 ? 0 : skinCount / count;
  // Too little skin-coloured area: read the whole mask, or the whole photo without one.
  const useAll = share < MIN_SKIN_SHARE;
  const inArea = (i: number) => mask === null || mask[i] === 1;
  let areaCount = 0;
  if (useAll) for (let i = 0; i < count; i += 1) if (inArea(i)) areaCount += 1;
  const n = useAll ? areaCount : skinCount;
  const columns = Array.from({ length: 5 }, () => new Float64Array(n));
  let k = 0;
  for (let i = 0; i < count; i += 1) {
    if (useAll ? !inArea(i) : !skin[i]) continue;
    const odR = -Math.log(((data[i * 4] ?? 0) + 0.5) / 255.5);
    const odG = -Math.log(((data[i * 4 + 1] ?? 0) + 0.5) / 255.5);
    const odB = -Math.log(((data[i * 4 + 2] ?? 0) + 0.5) / 255.5);
    columns[0]![k] = odG - odR;
    columns[1]![k] = odB - odR;
    columns[2]![k] = lab[i * 3 + 1] ?? 0;
    columns[3]![k] = lab[i * 3 + 2] ?? 0;
    columns[4]![k] = lab[i * 3] ?? 0;
    k += 1;
  }
  const result: number[] = [];
  for (const column of columns) for (const q of PERCENTILES) result.push(percentile(column, q));
  const light = estimateIlluminant(image);
  result.push(light.r, light.b, share);
  return result;
};

const memberOutput = (member: (typeof WEIGHTS.members)[number], features: number[]): number => {
  let h = features.map((value, i) => (value - (member.mean[i] ?? 0)) / (member.std[i] ?? 1));
  member.layers.forEach((layer, index) => {
    const out = layer.b.map((bias, j) =>
      h.reduce((sum, value, i) => sum + value * (layer.w[i]?.[j] ?? 0), bias),
    );
    h = index < member.layers.length - 1 ? out.map(Math.tanh) : out;
  });
  return ((h[0] ?? 0) - member.centre) / member.scale;
};

/** Raw ensemble output: higher means more haemoglobin in the skin. */
export const rednessSignal = (image: PixelBuffer, mask: Uint8Array | null = null): number => {
  const features = rednessFeatures(image, mask);
  const outputs = WEIGHTS.members.map((member) => memberOutput(member, features));
  return outputs.reduce((sum, value) => sum + value, 0) / outputs.length;
};

/** 0-100: the training sample's 10th percentile reads 10 and its 90th reads 70. */
export const rednessScore = (image: PixelBuffer, mask: Uint8Array | null = null): number => {
  const span = WEIGHTS.score_p90 - WEIGHTS.score_p10 || 1;
  return 10 + ((rednessSignal(image, mask) - WEIGHTS.score_p10) / span) * 60;
};
