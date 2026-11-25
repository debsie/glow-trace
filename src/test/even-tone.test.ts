import { describe, expect, it } from "vitest";

import { toneSpread } from "@/lib/cv/skin";
import type { PixelBuffer } from "@/lib/cv/types";

const SIZE = 96;

/** Skin of one base colour, with optional darker brown patches and per-pixel camera noise. */
const skin = (base: [number, number, number], patches: boolean, noise = 6): PixelBuffer => {
  let state = 3;
  const random = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648 - 0.5;
  };
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const o = (y * SIZE + x) * 4;
      const spot = patches && (Math.floor(x / 16) + Math.floor(y / 16)) % 2 === 0;
      const tint: [number, number, number] = spot ? [0.85, 0.78, 0.7] : [1, 1, 1];
      for (let c = 0; c < 3; c += 1) {
        data[o + c] = (base[c] ?? 0) * (tint[c] ?? 1) + random() * noise;
      }
      data[o + 3] = 255;
    }
  }
  return { width: SIZE, height: SIZE, data };
};

const transform = (image: PixelBuffer, r: number, g: number, b: number): PixelBuffer => {
  const data = new Uint8ClampedArray(image.data);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = (data[i] ?? 0) * r;
    data[i + 1] = (data[i + 1] ?? 0) * g;
    data[i + 2] = (data[i + 2] ?? 0) * b;
  }
  return { ...image, data };
};

describe("even tone (kernel v2.14)", () => {
  it("reads patchy skin as less even than uniform skin", () => {
    expect(toneSpread(skin([180, 130, 105], true)) ?? 0).toBeGreaterThan(
      (toneSpread(skin([180, 130, 105], false)) ?? 1) * 2,
    );
  });

  it("ignores a brighter, darker, warmer or cooler photo", () => {
    const photo = skin([170, 120, 95], true);
    const plain = toneSpread(photo) ?? 0;
    for (const [r, g, b] of [
      [1.2, 1.2, 1.2],
      [0.8, 0.8, 0.8],
      [1.08, 1, 0.92],
      [0.92, 1, 1.08],
    ] as const) {
      expect(Math.abs((toneSpread(transform(photo, r, g, b)) ?? 0) - plain)).toBeLessThan(
        plain * 0.1,
      );
    }
  });

  it("does not read camera noise in deep skin as patchiness", () => {
    const light = toneSpread(skin([215, 170, 150], false)) ?? 0;
    const deep = toneSpread(skin([95, 62, 48], false)) ?? 1;
    const deepPatchy = toneSpread(skin([95, 62, 48], true)) ?? 0;
    expect(deep).toBeLessThan(deepPatchy / 2);
    expect(deep - light).toBeLessThan(0.1);
  });

  it("needs enough skin to read", () => {
    expect(toneSpread(skin([180, 130, 105], true), new Uint8Array(SIZE * SIZE))).toBeNull();
  });
});
