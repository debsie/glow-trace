import { describe, expect, it } from "vitest";

import { faceSkinMask, fillPolygon, loopFromConnections, scalePolygon } from "@/lib/cv/face-mask";
import { analyzeBiomarkers } from "@/lib/cv/kernel";
import type { PixelBuffer } from "@/lib/cv/types";

const ring = (ids: number[]) =>
  ids.map((start, i) => ({ start, end: ids[(i + 1) % ids.length] ?? 0 }));

describe("Face mask geometry", () => {
  it("orders a shuffled loop of connections into a polygon", () => {
    const connections = [
      { start: 2, end: 3 },
      { start: 0, end: 1 },
      { start: 3, end: 0 },
      { start: 1, end: 2 },
    ];
    expect(loopFromConnections(connections).sort()).toEqual([0, 1, 2, 3]);
    expect(loopFromConnections([])).toEqual([]);
  });

  it("fills a square and scales about the centre", () => {
    const mask = new Uint8Array(100);
    const square = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.8, y: 0.8 },
      { x: 0.2, y: 0.8 },
    ];
    fillPolygon(mask, 10, 10, square, 1);
    expect(mask.reduce((sum, value) => sum + value, 0)).toBe(36);
    expect(scalePolygon(square, 0.5)[0]).toEqual({ x: 0.35, y: 0.35 });
  });

  it("keeps the face and cuts out an eye, and refuses a tiny face", () => {
    const landmarks = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
      { x: 0.3, y: 0.3 },
      { x: 0.45, y: 0.3 },
      { x: 0.45, y: 0.4 },
      { x: 0.3, y: 0.4 },
    ];
    const regions = { oval: ring([0, 1, 2, 3]), exclude: [ring([4, 5, 6, 7])] };
    const mask = faceSkinMask(landmarks, regions, 20, 20);
    expect(mask).not.toBeNull();
    expect(mask?.[10 * 20 + 10]).toBe(1); // cheek
    expect(mask?.[7 * 20 + 7]).toBe(0); // eye
    const tiny = landmarks.map((point) => ({ x: point.x * 0.2, y: point.y * 0.2 }));
    expect(faceSkinMask(tiny, regions, 20, 20)).toBeNull();
  });
});

describe("Masked analysis", () => {
  it("ignores everything outside the face mask", () => {
    // At least 96 px wide, or the quality gate refuses it.
    const width = 128;
    const height = 128;
    const data = new Uint8ClampedArray(width * height * 4);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const skin = x < 64;
        const grain = ((x * 7 + y * 13) % 9) - 4;
        // Left half skin; right half a busy green-and-purple background.
        const background = (x + y) % 2 === 0 ? [40, 160, 60] : [140, 40, 160];
        const [r, g, b] = skin ? [200 + grain, 150 + grain, 130 + grain] : background;
        data[offset] = r ?? 0;
        data[offset + 1] = g ?? 0;
        data[offset + 2] = b ?? 0;
        data[offset + 3] = 255;
        if (skin) mask[y * width + x] = 1;
      }
    }
    const image: PixelBuffer = { width, height, data };
    const value = (key: string, m: Uint8Array | null) =>
      analyzeBiomarkers("skin", image, m).metrics.find((metric) => metric.key === key)?.value ?? 0;
    // The background is extremely patchy and textured; with the mask, neither should count.
    expect(value("discoloration", mask)).toBeLessThan(value("discoloration", null));
    expect(value("texture", mask)).toBeLessThan(value("texture", null));
  });
});
