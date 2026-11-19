import { createAreaModel } from "./area-model";
import weightsJson from "./hair-weights.json";
import type { PixelBuffer } from "./types";

/**
 * Hair texture (kernel v2.3): trained on 2,867 real hair photos with known strand roughness added.
 * Only the texture head ships (r = 0.93); shine and flakes have not passed the shipping rule.
 */
const hair = createAreaModel(weightsJson, "/models/hair.onnx", "texture");

/** Mean predicted roughness over the hair, in training units. Null when the mask holds no hair. */
export const hairTextureSignal = (image: PixelBuffer, mask: Uint8Array | null = null) =>
  hair.signal(image, mask);
export const hairTextureSignalFast = (image: PixelBuffer, mask: Uint8Array | null = null) =>
  hair.signalFast(image, mask);
export const hairModelParity = () => hair.parity();
export const hairHeadMeans = (canvas: Float32Array) => hair.headMeans(canvas);
