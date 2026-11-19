import { describe, expect, it } from "vitest";

import {
  nailsHeadMeans,
  nailsModelParity,
  nailsModelSize,
  nailYellowingSignal,
} from "@/lib/cv/nails-model";
import type { PixelBuffer } from "@/lib/cv/types";

/** The same formula canvas as research/vision/export_web.py, at the model's size. */
const formulaCanvas = (n: number): Float32Array => {
  const canvas = new Float32Array(n * n * 3);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const p = (y * n + x) * 3;
      canvas[p] = (150 + 3 * x + 2 * y) % 256;
      canvas[p + 1] = (100 + x + 5 * y) % 256;
      canvas[p + 2] = (80 + 2 * x + 3 * y) % 256;
    }
  }
  return canvas;
};

/** A pale pink nail tile; `stain` adds yellow-brown optical density (blue absorbed most). */
const nailTile = (stain: number): PixelBuffer => {
  const size = 128;
  const data = new Uint8ClampedArray(size * size * 4);
  const od = [0.05, 0.25, 1.0];
  const base = [226, 186, 178];
  for (let i = 0; i < size * size; i += 1) {
    const ripple = 1 + 0.03 * Math.sin(i / 7);
    for (let c = 0; c < 3; c += 1) {
      const value = (base[c] ?? 0) * ripple;
      const density = -Math.log((value + 0.5) / 255.5) + stain * (od[c] ?? 0);
      data[i * 4 + c] = 255.5 * Math.exp(-density) - 0.5;
    }
    data[i * 4 + 3] = 255;
  }
  return { width: size, height: size, data };
};

describe("Nail yellowing model", () => {
  it("matches the Python network on the parity canvas", () => {
    const means = nailsHeadMeans(formulaCanvas(nailsModelSize()));
    expect(means["yellowing"]).toBeCloseTo(nailsModelParity()["yellowing"] ?? NaN, 4);
  }, 30_000);

  it("reads more stain as more yellowing", () => {
    const clean = nailYellowingSignal(nailTile(0)) ?? NaN;
    const stained = nailYellowingSignal(nailTile(0.4)) ?? NaN;
    expect(stained).toBeGreaterThan(clean + 0.05);
  }, 30_000);
});
