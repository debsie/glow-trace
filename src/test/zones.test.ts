import { describe, expect, it } from "vitest";

import { faceZones } from "@/lib/cv/zones";
import type { PixelBuffer } from "@/lib/cv/types";

const W = 120;
const H = 160;

/** Skin-coloured face; the chin and jaw (bottom rows) get extra blood colour. */
const face = (redChin: boolean): PixelBuffer => {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 4;
      const red = redChin && y > H * 0.75;
      data[o] = 205 + ((x * 7 + y * 3) % 9);
      data[o + 1] = (red ? 120 : 155) + ((x + y) % 7);
      data[o + 2] = (red ? 110 : 130) + ((x * 3) % 5);
      data[o + 3] = 255;
    }
  }
  return { width: W, height: H, data };
};

describe("Face zones", () => {
  const mask = new Uint8Array(W * H).fill(1);

  it("needs a face mask", () => {
    expect(faceZones(face(false), null)).toBeNull();
  });

  it("finds the redder zone", () => {
    const zones = faceZones(face(true), mask);
    expect(zones).not.toBeNull();
    expect(zones?.chin ?? 0).toBeGreaterThan(zones?.forehead ?? 0);
    expect(zones?.chin ?? 0).toBeGreaterThan(zones?.leftCheek ?? 0);
  });
});
