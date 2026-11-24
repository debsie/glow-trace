import { describe, expect, it } from "vitest";

import {
  skinPatches,
  skinSurfaceHeadMeans,
  skinSurfaceParity,
  skinTextureSignal,
} from "@/lib/cv/skin-surface-model";
import type { PixelBuffer } from "@/lib/cv/types";

/** The same formula canvas as research/vision/export_web.py. */
const formulaCanvas = (n = 128): Float32Array => {
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

/** Warm skin tone with seeded fine bumps; `rough` scales them. */
const skinImage = (rough: number, size = 300, seed = 11, height = size): PixelBuffer => {
  const data = new Uint8ClampedArray(size * height * 4);
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296 - 0.5;
  };
  for (let i = 0; i < size * height; i += 1) {
    const f = 1 + rough * rand();
    data.set([196 * f, 150 * f, 122 * f, 255], i * 4);
  }
  return { width: size, height, data };
};

const fullMask = (size = 300) => new Uint8Array(size * size).fill(1);

describe("skin-surface model (kernel v2.7)", () => {
  it("reads exactly what PyTorch read on the reference canvas (5-channel parity)", () => {
    const want = skinSurfaceParity();
    const got = skinSurfaceHeadMeans(formulaCanvas());
    for (const head of Object.keys(want)) {
      expect(Math.abs((got[head] ?? Number.NaN) - (want[head] ?? 0))).toBeLessThan(1e-4);
    }
  });

  it("cuts 128 px patches of mostly skin, never enlarging the photo", () => {
    const patches = skinPatches(skinImage(0.1), fullMask());
    expect(patches).toHaveLength(4);
    expect(patches[0]?.patch.width).toBe(128);
    const sliver = new Uint8Array(300 * 300).map((_, i) => (i % 300 < 60 ? 1 : 0));
    expect(skinPatches(skinImage(0.1), sliver)).toHaveLength(0);
  });

  // Two patches (256 x 128): the fewest the model reads.
  it("reads rougher skin higher, and gives null with too little skin", { timeout: 60_000 }, () => {
    const mask = new Uint8Array(256 * 128).fill(1);
    const smooth = skinTextureSignal(skinImage(0.02, 256, 11, 128), mask) ?? Number.NaN;
    const rough = skinTextureSignal(skinImage(0.3, 256, 11, 128), mask) ?? Number.NaN;
    expect(rough).toBeGreaterThan(smooth);
    expect(skinTextureSignal(skinImage(0.1, 256, 11, 128), new Uint8Array(256 * 128))).toBeNull();
  });
});
