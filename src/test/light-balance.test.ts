import { describe, expect, it } from "vitest";

import { MAX_BALANCE, balanceGains, balanceLight } from "@/lib/cv/image";
import { analyzeBiomarkers } from "@/lib/cv/kernel";
import type { PixelBuffer } from "@/lib/cv/types";

const SIZE = 120;

/** Skin with a redder patch and a highlight, lit by a light with the given red and blue gains. */
const photo = (red = 1, blue = 1): PixelBuffer => {
  let state = 11;
  const random = () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648 - 0.5;
  };
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const o = (y * SIZE + x) * 4;
      const grain = random() * 14;
      const flush = Math.hypot(x - 40, y - 50) < 18 ? 16 : 0;
      // Shine reflects the light itself: near daylight white before the light's tint.
      const shine = Math.hypot(x - 90, y - 30) < 12;
      data[o] = (shine ? 226 + grain : 165 + grain + flush) * red;
      data[o + 1] = shine ? 226 + grain : 120 + grain - flush / 2;
      data[o + 2] = (shine ? 215 + grain : 100 + grain - flush / 2) * blue;
      data[o + 3] = 255;
    }
  }
  return { width: SIZE, height: SIZE, data };
};

const read = (image: PixelBuffer) =>
  Object.fromEntries(analyzeBiomarkers("skin", image).metrics.map((m) => [m.key, m.value]));

describe("light-colour correction (v2.11)", () => {
  it("cancels a warm or cool light on the redness and even-tone readings", () => {
    const plain = read(photo());
    for (const [red, blue] of [
      [1.08, 0.92],
      [0.92, 1.08],
    ] as const) {
      const lit = read(photo(red, blue));
      expect(Math.abs((lit["erythema"] ?? 0) - (plain["erythema"] ?? 0))).toBeLessThan(2);
      expect(Math.abs((lit["discoloration"] ?? 0) - (plain["discoloration"] ?? 0))).toBeLessThan(2);
    }
  });

  it("keeps brightness: green is never scaled", () => {
    const balanced = balanceLight(photo(1.08, 0.92));
    const source = photo(1.08, 0.92);
    for (let i = 1; i < source.data.length; i += 400) expect(balanced.data[i]).toBe(source.data[i]);
  });

  it("only partly corrects a strong lamp, within the cap", () => {
    const gains = balanceGains(photo(1.6, 0.5));
    expect(gains.r).toBeGreaterThanOrEqual(Math.exp(-MAX_BALANCE) - 1e-9);
    expect(gains.r).toBeLessThan(1);
    expect(gains.b).toBeCloseTo(Math.exp(MAX_BALANCE), 6);
  });

  it("leaves a tiny or fully clipped photo alone", () => {
    const white: PixelBuffer = { width: 4, height: 4, data: new Uint8ClampedArray(64).fill(255) };
    expect(balanceGains(white)).toEqual({ r: 1, b: 1 });
  });
});
