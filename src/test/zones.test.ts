import { describe, expect, it } from "vitest";

import { faceDetails, faceZones } from "@/lib/cv/zones";
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

describe("Face details", () => {
  const box = (x0: number, y0: number, x1: number, y1: number) => {
    const m = new Uint8Array(W * H);
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) m[y * W + x] = 1;
    return m;
  };
  const areas = {
    nose: box(50, 50, 70, 90),
    underEyeRight: box(20, 40, 45, 50),
    underEyeLeft: box(75, 40, 100, 50),
    cheekRight: box(20, 70, 45, 85),
    cheekLeft: box(75, 70, 100, 85),
  };
  const shaded = (under: number, shinyNose: boolean): PixelBuffer => {
    const image = face(false);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const o = (y * W + x) * 4;
        const i = y * W + x;
        if (areas.underEyeLeft[i] || areas.underEyeRight[i]) {
          for (let c = 0; c < 3; c += 1) image.data[o + c] = (image.data[o + c] ?? 0) * under;
        }
        if (shinyNose && areas.nose[i] && (x + y) % 4 === 0) {
          for (let c = 0; c < 3; c += 1) image.data[o + c] = 250;
        }
      }
    }
    return image;
  };

  it("reads darker under-eyes, against the person's own cheek, as dark circles", () => {
    const even = faceDetails(shaded(1, false), areas)?.darkCircles ?? NaN;
    const dark = faceDetails(shaded(0.8, false), areas)?.darkCircles ?? NaN;
    expect(even).toBeLessThan(10);
    expect(dark).toBeGreaterThan(even + 30);
  });

  it("reads dark circles the same in a brighter or darker photo (v2.13)", () => {
    const scale = (image: PixelBuffer, gain: number): PixelBuffer => {
      const data = new Uint8ClampedArray(image.data);
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c += 1) data[i + c] = (data[i + c] ?? 0) * gain;
      }
      return { ...image, data };
    };
    const photo = shaded(0.8, false);
    const plain = faceDetails(photo, areas)?.darkCircles ?? NaN;
    for (const gain of [0.8, 1.15]) {
      const moved = faceDetails(scale(photo, gain), areas)?.darkCircles ?? NaN;
      expect(Math.abs(moved - plain)).toBeLessThan(2);
    }
  });

  it("calls a shiny nose with matte cheeks combination skin", () => {
    expect(faceDetails(shaded(1, true), areas)?.skinType).toBe("combination");
    expect(faceDetails(shaded(1, false), areas)?.skinType).toBe("balanced");
  });

  it("needs the face areas", () => {
    expect(faceDetails(shaded(1, false), null)).toBeNull();
  });
});
