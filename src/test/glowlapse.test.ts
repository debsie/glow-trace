import { describe, expect, it } from "vitest";

import { boundsOf, lapseCrop } from "@/lib/glowlapse";

describe("Glow-lapse framing", () => {
  it("centres a square on the face, inside the photo", () => {
    const crop = lapseCrop({ x: 0.4, y: 0.3, w: 0.2, h: 0.3 }, 1000, 1000);
    expect(crop.w).toBeCloseTo(510);
    expect(crop.x + crop.w / 2).toBeCloseTo(500);
    expect(crop.x).toBeGreaterThanOrEqual(0);
  });

  it("stays inside the photo at the edges", () => {
    const crop = lapseCrop({ x: 0.9, y: 0.9, w: 0.1, h: 0.1 }, 800, 600);
    expect(crop.x + crop.w).toBeLessThanOrEqual(800);
    expect(crop.y + crop.h).toBeLessThanOrEqual(600);
  });

  it("falls back to the centre without a face", () => {
    expect(lapseCrop(null, 800, 600)).toEqual({ x: 100, y: 0, w: 600, h: 600 });
    expect(boundsOf([])).toBeNull();
  });
});
