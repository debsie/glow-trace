import { describe, expect, it } from "vitest";

import { correctLight, densityDifferences, estimateIlluminant } from "@/lib/cv/pigment";
import type { PixelBuffer } from "@/lib/cv/types";

const patch = (r: number, g: number, b: number, size = 8): PixelBuffer => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r + (i % 13);
    data[i + 1] = g + (i % 7);
    data[i + 2] = b + (i % 5);
    data[i + 3] = 255;
  }
  return { width: size, height: size, data };
};

describe("Pigment physics", () => {
  it("ignores shading: a darker copy of the same skin has the same density differences", () => {
    const bright = densityDifferences(200, 140, 120);
    const shaded = densityDifferences(100, 70, 60);
    expect(shaded.dG).toBeCloseTo(bright.dG, 1);
    expect(shaded.dB).toBeCloseTo(bright.dB, 1);
  });

  it("reads more green absorption for redder skin", () => {
    expect(densityDifferences(200, 120, 120).dG).toBeGreaterThan(
      densityDifferences(200, 150, 120).dG,
    );
  });
});

describe("Light correction", () => {
  it("estimates a warmer light for a warm-tinted photo", () => {
    const neutral = estimateIlluminant(patch(150, 150, 150));
    const warm = estimateIlluminant(patch(180, 150, 120));
    expect(warm.r).toBeGreaterThan(neutral.r);
    expect(warm.b).toBeLessThan(neutral.b);
  });

  it("moves a tinted photo's light estimate to the reference", () => {
    const reference = estimateIlluminant(patch(170, 140, 120));
    const tinted = patch(190, 140, 100);
    const after = estimateIlluminant(correctLight(tinted, reference));
    expect(after.r).toBeCloseTo(reference.r, 2);
    expect(after.b).toBeCloseTo(reference.b, 2);
  });
});
