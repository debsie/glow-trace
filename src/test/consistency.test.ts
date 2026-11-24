import { describe, expect, it } from "vitest";

import { centreLook, compareToReference, matchHint } from "@/lib/cv/consistency";
import type { PixelBuffer } from "@/lib/cv/types";

const solid = (r: number, g: number, b: number, size = 40): PixelBuffer => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i += 1) data.set([r, g, b, 255], i * 4);
  return { data, width: size, height: size };
};

const ref = { share: 0.25, luma: 150, warmth: 0.05 };

describe("steadier scans", () => {
  it("reads brightness and light colour from the centre", () => {
    const warm = centreLook(solid(200, 150, 100));
    expect(warm.luma).toBeCloseTo(0.299 * 200 + 0.587 * 150 + 0.114 * 100);
    expect(warm.warmth).toBeGreaterThan(0.15);
    expect(centreLook(solid(100, 150, 200)).warmth).toBeLessThan(0);
  });

  it("matches a photo taken the same way", () => {
    const match = compareToReference({ share: 0.27, luma: 140, warmth: 0.07 }, ref);
    expect(match).toEqual({ distance: "ok", light: "ok", colour: "ok" });
    expect(matchHint(match)).toBeUndefined();
  });

  it("coaches distance first, then light, then colour", () => {
    expect(matchHint(compareToReference({ share: 0.15, luma: 90, warmth: 0.2 }, ref))).toMatch(
      /closer/,
    );
    expect(matchHint(compareToReference({ share: 0.25, luma: 100, warmth: 0.2 }, ref))).toMatch(
      /Darker than last time/,
    );
    expect(matchHint(compareToReference({ share: 0.25, luma: 150, warmth: 0.15 }, ref))).toMatch(
      /warmer than last time/,
    );
    expect(matchHint(compareToReference({ share: 0.4, luma: 150, warmth: 0.05 }, ref))).toMatch(
      /back/,
    );
  });
});
