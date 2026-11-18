import { describe, expect, it } from "vitest";

import { hairHeadMeans, hairModelParity, hairTextureSignal } from "@/lib/cv/hair-model";
import type { PixelBuffer } from "@/lib/cv/types";

/** The same formula canvas as research/vision/export_web.py (128 x 128). */
const formulaCanvas = (): Float32Array => {
  const canvas = new Float32Array(128 * 128 * 3);
  for (let y = 0; y < 128; y += 1) {
    for (let x = 0; x < 128; x += 1) {
      const p = (y * 128 + x) * 3;
      canvas[p] = (150 + 3 * x + 2 * y) % 256;
      canvas[p + 1] = (100 + x + 5 * y) % 256;
      canvas[p + 2] = (80 + 2 * x + 3 * y) % 256;
    }
  }
  return canvas;
};

/** Brown "hair" with seeded strand-scale noise; `rough` scales the noise. */
const hairImage = (rough: number, seed = 7, gain = 1): PixelBuffer => {
  const width = 192;
  const height = 192;
  const data = new Uint8ClampedArray(width * height * 4);
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
  for (let i = 0; i < width * height; i += 1) {
    const f = 1 + rough * rand() * 3.4;
    const stripe = 1 + 0.08 * Math.sin((i % width) / 3);
    data[i * 4] = 95 * f * stripe * gain;
    data[i * 4 + 1] = 62 * f * stripe * gain;
    data[i * 4 + 2] = 40 * f * stripe * gain;
    data[i * 4 + 3] = 255;
  }
  return { width, height, data };
};

describe("Hair texture model", () => {
  it("matches the Python network on the parity canvas", () => {
    const means = hairHeadMeans(formulaCanvas());
    const parity = hairModelParity();
    expect(means["texture"]).toBeCloseTo(parity["texture"] ?? NaN, 4);
    expect(means["shine"]).toBeCloseTo(parity["shine"] ?? NaN, 4);
  });

  it("reads rougher strands as more texture", () => {
    const smooth = hairTextureSignal(hairImage(0)) ?? NaN;
    const rough = hairTextureSignal(hairImage(0.3)) ?? NaN;
    expect(rough).toBeGreaterThan(smooth);
  });

  it("barely moves with exposure", () => {
    const base = hairTextureSignal(hairImage(0.1)) ?? NaN;
    const brighter = hairTextureSignal(hairImage(0.1, 7, 1.15)) ?? NaN;
    expect(Math.abs(brighter - base)).toBeLessThan(0.02);
  });

  it("returns null when the mask holds no hair", () => {
    expect(hairTextureSignal(hairImage(0), new Uint8Array(192 * 192))).toBeNull();
  });
});
