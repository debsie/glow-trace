import { describe, expect, it } from "vitest";

import { frameHint } from "@/lib/cv/kernel";
import type { PixelBuffer } from "@/lib/cv/types";

/** A textured mid-grey frame, sharp and well lit, at the given size. */
const frame = (width: number, height: number): PixelBuffer => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const v = (x + y) % 2 === 0 ? 90 : 170;
      const i = (y * width + x) * 4;
      data.set([v, v, v, 255], i);
    }
  return { data, width, height };
};

describe("live camera frame check", () => {
  it("never calls a portrait phone camera too small because its preview is narrow", () => {
    // 160 px tall preview of a 1080 x 1920 portrait camera is 90 px wide.
    expect(frameHint(frame(90, 160), 1080)).toBeUndefined();
  });

  it("still flags a camera that really is low resolution", () => {
    expect(frameHint(frame(90, 160), 80)).toMatch(/too small/);
  });
});
