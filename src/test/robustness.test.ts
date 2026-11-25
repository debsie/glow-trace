import { describe, expect, it } from "vitest";

import { analyzeBiomarkers, castWarning } from "@/lib/cv/kernel";
import type { PixelBuffer } from "@/lib/cv/types";

/**
 * Robustness: the same skin under small, everyday changes in light should read nearly the same.
 * The tolerances below are what a reading can honestly claim. Two scans closer than this are
 * the same result; the app should not call that progress.
 */

const SIZE = 160;

/** Deterministic pseudo-random noise so the test never flakes. */
const noise = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648 - 0.5;
  };
};

/** A skin-like patch: warm base tone, fine texture, a few redder areas, near-neutral highlights. */
const skinPatch = (base: [number, number, number]): PixelBuffer => {
  const random = noise(7);
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      const grain = random() * 18;
      const flush = Math.hypot(x - 50, y - 60) < 22 ? 14 : 0;
      const shine = Math.hypot(x - 110, y - 40) < 8 ? 45 : 0;
      data[offset] = base[0] + grain + flush + shine;
      data[offset + 1] = base[1] + grain - flush / 2 + shine;
      data[offset + 2] = base[2] + grain - flush / 2 + shine;
      data[offset + 3] = 255;
    }
  }
  return { width: SIZE, height: SIZE, data };
};

type Transform = (r: number, g: number, b: number) => [number, number, number];

const apply = (image: PixelBuffer, transform: Transform): PixelBuffer => {
  const data = new Uint8ClampedArray(image.data.length);
  for (let offset = 0; offset < data.length; offset += 4) {
    const [r, g, b] = transform(
      image.data[offset] ?? 0,
      image.data[offset + 1] ?? 0,
      image.data[offset + 2] ?? 0,
    );
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = 255;
  }
  return { ...image, data };
};

const blur = (image: PixelBuffer): PixelBuffer => {
  const { width, height } = image;
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const xx = Math.min(width - 1, Math.max(0, x + dx));
            const yy = Math.min(height - 1, Math.max(0, y + dy));
            sum += image.data[(yy * width + xx) * 4 + channel] ?? 0;
            n += 1;
          }
        }
        data[(y * width + x) * 4 + channel] = sum / n;
      }
      data[(y * width + x) * 4 + 3] = 255;
    }
  }
  return { ...image, data };
};

const TRANSFORMS: Record<string, (image: PixelBuffer) => PixelBuffer> = {
  "10% brighter": (image) => apply(image, (r, g, b) => [r * 1.1, g * 1.1, b * 1.1]),
  "10% darker": (image) => apply(image, (r, g, b) => [r * 0.9, g * 0.9, b * 0.9]),
  "slightly warm light": (image) => apply(image, (r, g, b) => [r * 1.04, g, b * 0.96]),
  "slightly cool light": (image) => apply(image, (r, g, b) => [r * 0.96, g, b * 1.04]),
  "soft focus": blur,
};

/** Largest honest movement, in indicator points (0-100), under each everyday change. */
const TOLERANCE: Record<string, number> = {
  // Kernel v2 (trained model): a 4% warm or cool shift moves these synthetic patches up to 7.4
  // points (v1.3: 5). On real held-out photos the model's light noise is about half of v1.3's
  // (docs/cv-kernel-spec.md). src/lib/agent/agent.ts uses the same 8 as its noise floor.
  erythema: 8,
  hydration: 12,
  discoloration: 8,
  texture: 25,
};

const readings = (image: PixelBuffer) =>
  new Map(analyzeBiomarkers("skin", image).metrics.map((metric) => [metric.key, metric.value]));

// Light, medium and deep skin base tones.
const TONES: Record<string, [number, number, number]> = {
  light: [215, 170, 150],
  medium: [170, 120, 95],
  deep: [105, 70, 55],
};

describe("Robustness under everyday light changes", () => {
  for (const [tone, base] of Object.entries(TONES)) {
    const original = skinPatch(base);
    const before = readings(original);

    it(`scores ${tone} skin`, () => {
      expect(before.size).toBeGreaterThan(0);
    });

    for (const [name, transform] of Object.entries(TRANSFORMS)) {
      it(`${tone} skin, ${name}: indicators stay within tolerance`, () => {
        const after = readings(transform(original));
        for (const [key, tolerance] of Object.entries(TOLERANCE)) {
          // Texture is read from fine detail, so focus changes it by design. See the next test.
          if (key === "texture" && name === "soft focus") continue;
          const a = before.get(key);
          const b = after.get(key);
          if (a === undefined || b === undefined) continue;
          expect(Math.abs(a - b), `${key} moved ${a} → ${b}`).toBeLessThanOrEqual(tolerance);
        }
      });
    }
  }
});

/**
 * Adds haemoglobin by the Beer-Lambert law: the same amount of blood on every skin tone, which
 * is not the same RGB change (an RGB offset is far more blood on dark skin than on light).
 */
const HAEMOGLOBIN: [number, number, number] = [0.04, 1, 0.85];
const withBlood = (image: PixelBuffer, amount: number): PixelBuffer =>
  apply(
    image,
    (r, g, b) =>
      [r, g, b].map((value, channel) => {
        const density = -Math.log((value + 0.5) / 255.5) + amount * (HAEMOGLOBIN[channel] ?? 0);
        return 255.5 * Math.exp(-density) - 0.5;
      }) as [number, number, number],
  );

// Kernel v2 (trained model) measured 7.8 points between the lightest and deepest patch for the same
// blood; v2.12 (tone-evened a*) measures about 1.5.
const RISE_SPREAD = 10;

describe("Skin-tone fairness", () => {
  it("responds to the same added blood by a similar amount on every skin tone", () => {
    const rises = Object.values(TONES).map((base) => {
      const patch = skinPatch(base);
      return (
        (readings(withBlood(patch, 0.15)).get("erythema") ?? 0) -
        (readings(patch).get("erythema") ?? 0)
      );
    });
    for (const rise of rises) expect(rise).toBeGreaterThan(5);
    expect(Math.max(...rises) - Math.min(...rises)).toBeLessThanOrEqual(RISE_SPREAD);
  });
});

describe("Focus dependence", () => {
  it("reads softer photos as smoother skin, so compare scans taken in focus", () => {
    const sharp = skinPatch([170, 120, 95]);
    const soft = blur(sharp);
    expect(readings(soft).get("texture") ?? 100).toBeLessThan(readings(sharp).get("texture") ?? 0);
  });
});

describe("Colour-cast warning", () => {
  it("stays quiet for near-neutral highlights", () => {
    expect(castWarning({ a: 4, b: 9 })).toBeUndefined();
  });

  it("names warm, cool and green light", () => {
    expect(castWarning({ a: 2, b: 30 })).toMatch(/warm/);
    expect(castWarning({ a: 0, b: -30 })).toMatch(/cool/);
    expect(castWarning({ a: -20, b: 15 })).toMatch(/green/);
  });

  it("flags a strongly tinted photo end to end", () => {
    const tinted = apply(skinPatch([170, 120, 95]), (r, g, b) => [r * 1.25, g, b * 0.6]);
    expect(analyzeBiomarkers("skin", tinted).quality.warning).toMatch(/warm/);
  });
});
