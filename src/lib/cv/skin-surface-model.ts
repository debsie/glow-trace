import { createAreaModel } from "./area-model";
import weightsJson from "./skin-surface-v11-weights.json";
import type { PixelBuffer } from "./types";

/**
 * Skin texture (kernel v2.14): the v11 skin-surface model, one model in place of v7 and v8
 * averaged. Trained on 17,679 real skin photos across four skin-tone bands (adults only), with
 * measured texture labels, a fine-detail input channel and both of the labeller's "which is
 * smoother" rounds (426 answers). Texture head only: r 0.92 (0.91-0.94 by tone band), blur 94% of
 * the ideal, agrees with the labeller on 68% of 82 held-out pairs (her own repeat consistency is
 * 63%). On real selfies through the app: brightness 0.04, same person 1.07, the steadiest yet
 * (v7 + v8: 0.07 and 1.32). Shine and breakouts have not passed the shipping rule.
 */
const surface = createAreaModel(weightsJson, "/models/skin-surface-v11.onnx", "texture");

const PATCH = 128;
/** Face skin scaled to about this width, as in training's patch scale and the real-photo gate. */
const SKIN_WIDTH = 360;
const MIN_SKIN_SHARE = 0.6;
const MAX_PATCHES = 12;
/** Fewer patches than this is too little skin to trust; the caller uses the older formula. */
export const MIN_PATCHES = 2;
/** The photo size texture is read at: big enough that an upright selfie's face gives patches. */
export const TEXTURE_PHOTO_DIM = 1280;

/**
 * Skin patches the model reads: the photo scaled so the skin is about SKIN_WIDTH wide (never
 * enlarged, which would soften texture), cut into 128 px tiles that are at least 60% skin.
 * Area-averaged when shrinking, like the training resize.
 */
export const skinPatches = (
  image: PixelBuffer,
  mask: Uint8Array,
): { patch: PixelBuffer; mask: Uint8Array }[] => {
  const { width, height, data } = image;
  let x0 = width;
  let x1 = -1;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i]) continue;
    const x = i % width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
  }
  if (x1 < x0) return [];
  const scale = Math.min(1, SKIN_WIDTH / Math.max(1, x1 - x0 + 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out: { patch: PixelBuffer; mask: Uint8Array }[] = [];
  for (let py = 0; py + PATCH <= h && out.length < MAX_PATCHES; py += PATCH) {
    for (let px = 0; px + PATCH <= w && out.length < MAX_PATCHES; px += PATCH) {
      const pdata = new Uint8ClampedArray(PATCH * PATCH * 4);
      const pmask = new Uint8Array(PATCH * PATCH);
      let skin = 0;
      for (let y = 0; y < PATCH; y += 1) {
        const sy0 = Math.floor((py + y) / scale);
        const sy1 = Math.min(height, Math.max(sy0 + 1, Math.floor((py + y + 1) / scale)));
        for (let x = 0; x < PATCH; x += 1) {
          const sx0 = Math.floor((px + x) / scale);
          const sx1 = Math.min(width, Math.max(sx0 + 1, Math.floor((px + x + 1) / scale)));
          let r = 0;
          let g = 0;
          let b = 0;
          let n = 0;
          let m = 0;
          for (let sy = sy0; sy < sy1; sy += 1) {
            for (let sx = sx0; sx < sx1; sx += 1) {
              const i = sy * width + sx;
              r += data[i * 4] ?? 0;
              g += data[i * 4 + 1] ?? 0;
              b += data[i * 4 + 2] ?? 0;
              m += mask[i] ? 1 : 0;
              n += 1;
            }
          }
          const o = y * PATCH + x;
          pdata[o * 4] = r / n;
          pdata[o * 4 + 1] = g / n;
          pdata[o * 4 + 2] = b / n;
          pdata[o * 4 + 3] = 255;
          if (m * 2 >= n) {
            pmask[o] = 1;
            skin += 1;
          }
        }
      }
      if (skin >= MIN_SKIN_SHARE * PATCH * PATCH) {
        out.push({ patch: { data: pdata, width: PATCH, height: PATCH }, mask: pmask });
      }
    }
  }
  return out;
};

const average = (values: number[]) =>
  values.length >= MIN_PATCHES ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** Mean texture over the face's skin patches, in training units. Null without enough skin. */
export const skinTextureSignal = (image: PixelBuffer, mask: Uint8Array): number | null =>
  average(
    skinPatches(image, mask).flatMap(({ patch, mask: m }) => {
      const v = surface.signal(patch, m);
      return v === null ? [] : [v];
    }),
  );

/** The same through ONNX Runtime Web, falling back to the TypeScript forward pass per patch. */
export const skinTextureSignalFast = async (
  image: PixelBuffer,
  mask: Uint8Array,
): Promise<number | null> => {
  const values: number[] = [];
  for (const { patch, mask: m } of skinPatches(image, mask)) {
    const v = await surface.signalFast(patch, m);
    if (v !== null) values.push(v);
  }
  return average(values);
};

export const skinSurfaceParity = () => surface.parity();
export const skinSurfaceHeadMeans = (canvas: Float32Array) => surface.headMeans(canvas);
