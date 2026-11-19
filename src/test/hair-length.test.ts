import { describe, expect, it } from "vitest";

import { bandFor, growthPerMonth, hairEndRow, lengthPosition } from "@/lib/hair-length";

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
