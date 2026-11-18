import { describe, expect, it } from "vitest";

import { FILTER_RATIO, filterCheck, withFilterCheck } from "@/lib/cv/filter-check";
import type { BiomarkerReport, PixelBuffer } from "@/lib/cv/types";

const SIZE = 80;

/** Skin on the left with fine texture of `skinGrain`; "features" on the right with grain 30. */
const photo = (
  skinGrain: number,
): { image: PixelBuffer; skin: Uint8Array; features: Uint8Array } => {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  const skin = new Uint8Array(SIZE * SIZE);
  const features = new Uint8Array(SIZE * SIZE);
  let seed = 3;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648 - 0.5;
  };
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const i = y * SIZE + x;
      const isSkin = x < SIZE / 2;
      const grain = random() * (isSkin ? skinGrain : 30);
      data[i * 4] = 190 + grain;
      data[i * 4 + 1] = 140 + grain;
      data[i * 4 + 2] = 120 + grain;
      data[i * 4 + 3] = 255;
      if (isSkin) skin[i] = 1;
      else features[i] = 1;
    }
  }
  return { image: { width: SIZE, height: SIZE, data }, skin, features };
};

describe("Beauty-filter check", () => {
  it("passes skin with natural texture", () => {
    const { image, skin, features } = photo(20);
    const check = filterCheck(image, skin, features);
    expect(check?.ratio).toBeGreaterThan(FILTER_RATIO);
    expect(check?.filtered).toBe(false);
  });

  it("flags skin smoothed while features stay sharp", () => {
    const { image, skin, features } = photo(4);
    expect(filterCheck(image, skin, features)?.filtered).toBe(true);
  });

  it("marks a filtered report and leaves an unfiltered one alone", () => {
    const report: BiomarkerReport = {
      kernelVersion: "k",
      category: "skin",
      quality: { width: 1, height: 1, sharpness: 50, usable: true },
      metrics: [],
    };
    const flagged = withFilterCheck(report, { ratio: 0.2, filtered: true });
    expect(flagged.quality.filtered).toBe(true);
    expect(flagged.quality.warning).toMatch(/beauty filter/);
    expect(
      withFilterCheck(report, { ratio: 0.6, filtered: false }).quality.filtered,
    ).toBeUndefined();
    expect(withFilterCheck(report, null)).toBe(report);
  });
});
