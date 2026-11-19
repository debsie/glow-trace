import { createAreaModel } from "./area-model";
import weightsJson from "./nails-weights.json";
import type { PixelBuffer } from "./types";

/**
 * Nail yellowing (kernel v2.4): trained on 2,141 real nail photos with a known yellow-brown stain
 * added (Beer-Lambert), balanced across four skin-tone bands. Held out: r = 0.75, between 0.75 and
 * 0.78 in every tone band, leak 0.21. Spots, ridges and cuticle have not passed the shipping rule.
 * Nail tiles are small crops, so they are enlarged to the model's 256 px.
 */
const nails = createAreaModel(weightsJson, "/models/nails.onnx", "yellowing", true);

export const nailYellowingSignal = (image: PixelBuffer) => nails.signal(image);
export const nailYellowingSignalFast = (image: PixelBuffer) => nails.signalFast(image);
export const nailsModelParity = () => nails.parity();
export const nailsHeadMeans = (canvas: Float32Array) => nails.headMeans(canvas);
export const nailsModelSize = () => nails.size();
