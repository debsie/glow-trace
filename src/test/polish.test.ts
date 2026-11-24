import { describe, expect, it } from "vitest";

import { polishReason } from "@/lib/cv/polish";
import type { PixelBuffer } from "@/lib/cv/types";

/** A 96 px nail tile: skin all round, an oval nail of `nail` colour in the middle. */
const tile = (
  nail: [number, number, number],
  skin: [number, number, number] = [196, 150, 128],
): PixelBuffer => {
  const size = 96;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const onNail = ((y - 48) / 36) ** 2 + ((x - 48) / 31) ** 2 <= 1;
      data.set([...(onNail ? nail : skin), 255], (y * size + x) * 4);
    }
  }
  return { data, width: size, height: size };
};

describe("polish check", () => {
  it("leaves bare nails alone, on light and deep skin", () => {
    expect(polishReason(tile([232, 196, 190]))).toBeNull();
    expect(polishReason(tile([214, 170, 160], [110, 72, 54]))).toBeNull();
  });

  it("catches bright, unusual, dark and white polish", () => {
    expect(polishReason(tile([170, 20, 40]))).toBe("colour");
    expect(polishReason(tile([120, 126, 152]))).toBe("hue");
    expect(polishReason(tile([28, 24, 28]))).toBe("dark");
    expect(polishReason(tile([244, 242, 240]))).toBe("white");
  });

  it("does not call dark skin around a bare nail polish", () => {
    expect(polishReason(tile([150, 110, 100], [70, 45, 35]))).toBeNull();
  });
});
