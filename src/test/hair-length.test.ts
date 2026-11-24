import { describe, expect, it } from "vitest";

import {
  ALL_BANDS,
  bandFor,
  bandMidpoint,
  growthPerMonth,
  hairEndRow,
  lengthPosition,
} from "@/lib/hair-length";

const marks = { ear: 0.1, chin: 0.18, shoulders: 0.25, hips: 0.85 };

describe("Hair length", () => {
  it("places the hair end in the bands women use", () => {
    const at = (y: number) => bandFor(lengthPosition(y, marks) ?? NaN, marks);
    expect(at(0.15)).toBe("ear");
    expect(at(0.22)).toBe("chin");
    expect(at(0.27)).toBe("shoulder");
    expect(at(0.4)).toBe("armpit");
    expect(at(0.5)).toBe("bra-strap");
    expect(at(0.75)).toBe("waist");
    expect(at(0.95)).toBe("past-hip");
  });

  it("refuses body marks in the wrong order", () => {
    expect(lengthPosition(0.5, { ear: 0.3, chin: 0.2, shoulders: 0.25, hips: 0.85 })).toBeNull();
  });

  it("finds where the hair ends down the middle of the back", () => {
    const w = 50;
    const h = 100;
    const mask = new Uint8Array(w * h);
    for (let y = 10; y < 62; y += 1) for (let x = 18; x < 32; x += 1) mask[y * w + x] = 1;
    // A stray strand lower down, after a gap, is ignored.
    for (let x = 20; x < 30; x += 1) mask[90 * w + x] = 1;
    expect(hairEndRow(mask, w, h, 0.5)).toBeCloseTo(0.62, 2);
  });

  it("starts at the head, so trees or sky above a person are never read as hair", () => {
    const w = 50;
    const h = 100;
    const mask = new Uint8Array(w * h);
    // Dark leaves at the top of the photo, then the person's hair from the ears (row 30) down.
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < w; x += 1) mask[y * w + x] = 1;
    for (let y = 30; y < 55; y += 1) for (let x = 18; x < 32; x += 1) mask[y * w + x] = 1;
    expect(hairEndRow(mask, w, h, 0.5, 0.2, 0.12, 0.3)).toBeCloseTo(0.55, 2);
    // No hair near the ears at all (a background patch lower down only): no reading.
    const stray = new Uint8Array(w * h);
    for (let y = 70; y < 80; y += 1) for (let x = 18; x < 32; x += 1) stray[y * w + x] = 1;
    expect(hairEndRow(stray, w, h, 0.5, 0.2, 0.12, 0.3)).toBeNull();
  });

  it("gives no reading for a tiny person or an impossible length", () => {
    expect(lengthPosition(0.4, { ear: 0.3, chin: 0.32, shoulders: 0.35, hips: 0.45 })).toBeNull();
    expect(lengthPosition(0.02, marks)).toBeNull();
    expect(lengthPosition(0.25 + 0.6 * 1.9, marks)).toBeNull();
  });

  it("measures growth only between readings of the same state", () => {
    const a = {
      at: "2026-01-01",
      reading: { band: "armpit", position: 0.3, state: "stretched" },
    } as const;
    const b = {
      at: "2026-04-01",
      reading: { band: "bra-strap", position: 0.37, state: "stretched" },
    } as const;
    expect(growthPerMonth(a, b)).toBeCloseTo(1.1, 1);
    expect(growthPerMonth(a, { ...b, reading: { ...b.reading, state: "natural" } })).toBeNull();
  });
});

describe("hair length correction", () => {
  it("places a corrected band in the middle of that band", () => {
    const m = { ear: 0.1, chin: 0.18, shoulders: 0.25, hips: 0.85 };
    for (const band of ALL_BANDS) {
      expect(bandFor(bandMidpoint(band), m)).toBe(band);
    }
  });
});
