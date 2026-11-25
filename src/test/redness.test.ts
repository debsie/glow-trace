import { describe, expect, it } from "vitest";

import { medianRedness, rednessScore } from "@/lib/cv/redness";
import type { PixelBuffer } from "@/lib/cv/types";

const flat = (r: number, g: number, b: number): PixelBuffer => {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, 255], i);
  return { width: 32, height: 32, data };
};

describe("redness (kernel v2.12)", () => {
  it("reads redder skin higher", () => {
    expect(medianRedness(flat(200, 140, 125))).toBeGreaterThan(medianRedness(flat(190, 150, 130)));
  });

  it("reads only the masked pixels", () => {
    const image = flat(190, 150, 130);
    const mask = new Uint8Array(32 * 32);
    for (let i = 0; i < 100; i += 1) {
      image.data.set([230, 120, 120, 255], i * 4);
      mask[i] = 1;
    }
    expect(medianRedness(image, mask)).toBeGreaterThan(medianRedness(image));
  });

  it("gives a neutral grey no redness and an empty mask zero", () => {
    expect(Math.abs(medianRedness(flat(128, 128, 128)))).toBeLessThan(0.5);
    expect(medianRedness(flat(200, 140, 125), new Uint8Array(32 * 32))).toBe(0);
  });

  it("puts typical skin inside the score range", () => {
    const value = rednessScore(flat(190, 140, 120));
    expect(value).toBeGreaterThan(10);
    expect(value).toBeLessThan(90);
  });
});
