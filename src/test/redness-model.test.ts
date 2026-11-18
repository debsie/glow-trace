import { describe, expect, it } from "vitest";

import { rednessFeatures, rednessSignal } from "@/lib/cv/redness-model";
import type { PixelBuffer } from "@/lib/cv/types";

/** The same formula image as the parity check in research/redness (24 x 32). */
const formulaImage = (): PixelBuffer => {
  const width = 32;
  const height = 24;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = (150 + 3 * x + y * 2) % 256;
      data[offset + 1] = (100 + x + 5 * y) % 256;
      data[offset + 2] = (80 + 2 * x + 3 * y) % 256;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
};

// Computed by research/redness/model.py features() and its ensemble on the same image. If the
// weights are retrained, regenerate these numbers with the snippet in research/redness/README.md.
const PYTHON_FEATURES = [
  0.175159108, 0.330143102, 0.509315049, 0.374875649, 0.46754964, 0.554725803, 7.234737933,
  19.074845439, 34.285632687, 15.445835678, 19.045416793, 22.312977055, 55.75812826, 68.249526352,
  81.096459574, 0.37870899, 0.281816754, 0.608072917,
];
const PYTHON_SIGNAL = 3.182720829;

describe("Redness model parity with training code", () => {
  it("computes the same 18 features as the Python trainer", () => {
    const features = rednessFeatures(formulaImage());
    expect(features).toHaveLength(18);
    features.forEach((value, index) => expect(value).toBeCloseTo(PYTHON_FEATURES[index] ?? NaN, 6));
  });

  it("gives the same ensemble output", () => {
    expect(rednessSignal(formulaImage())).toBeCloseTo(PYTHON_SIGNAL, 5);
  });
});
