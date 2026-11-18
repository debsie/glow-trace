import { describe, expect, it } from "vitest";

import { cropTile, nailBoxes } from "@/lib/cv/nail-tiles";
import type { BiomarkerReport } from "@/lib/cv/types";
import { combineShots, SESSIONS } from "@/lib/scan-session";

/** A flat hand, fingers up: joints at y 0.5, tips at y 0.4, spaced across. */
const hand = () => {
  const points = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.8 }));
  const set = (index: number, x: number, y: number) => (points[index] = { x, y });
  [
    [3, 4, 0.15],
    [7, 8, 0.35],
    [11, 12, 0.5],
    [15, 16, 0.65],
    [19, 20, 0.8],
  ].forEach(([joint, tip, x]) => {
    set(joint ?? 0, x ?? 0, 0.5);
    set(tip ?? 0, x ?? 0, 0.4);
  });
  return points;
};

describe("Nail tiles", () => {
  it("finds a box per finger, behind the tip, inside the photo", () => {
    const boxes = nailBoxes(hand(), 640, 480);
    expect(boxes.map((box) => box.finger)).toEqual(["thumb", "index", "middle", "ring", "little"]);
    const middle = boxes.find((box) => box.finger === "middle");
    expect(middle?.size).toBe(55); // bone 48 px x 1.15
    // Centre 30% back from the tip (y 192) towards the joint (y 240).
    expect((middle?.y ?? 0) + (middle?.size ?? 0) / 2).toBeCloseTo(206.4, 0);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.size).toBeLessThanOrEqual(640);
    }
  });

  it("skips nails too small to read", () => {
    expect(nailBoxes(hand(), 160, 120)).toEqual([]);
  });

  it("crops and resamples a tile", () => {
    const data = new Uint8ClampedArray(64 * 64 * 4);
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % 64;
      data[i] = x < 32 ? 255 : 0;
      data[i + 3] = 255;
    }
    const tile = cropTile(
      { width: 64, height: 64, data },
      { finger: "index", x: 16, y: 16, size: 32 },
      8,
    );
    expect(tile.width).toBe(8);
    expect(tile.data[0]).toBe(255); // left half red
    expect(tile.data[(0 * 8 + 7) * 4]).toBe(0); // right half not
  });
});

const report = (
  category: BiomarkerReport["category"],
  values: Record<string, number>,
  usable = true,
): BiomarkerReport => ({
  kernelVersion: "k",
  category,
  quality: { width: 100, height: 100, sharpness: 40, usable },
  metrics: Object.entries(values).map(([key, value]) => ({
    key,
    label: key,
    value,
    higherMeans: "more",
    description: "",
  })),
});

describe("Scan sessions", () => {
  it("plans one shot for skin, two for nails, three for hair", () => {
    expect(SESSIONS.skin.map((shot) => shot.id)).toEqual(["face"]);
    expect(SESSIONS.nails.map((shot) => shot.id)).toEqual(["hand", "thumb"]);
    expect(SESSIONS.hair.map((shot) => shot.id)).toEqual(["lengths", "crown", "ends"]);
  });

  it("averages every nail tile and ignores unusable ones", () => {
    const combined = combineShots("nails", SESSIONS.nails, [
      {
        shotId: "hand",
        reports: [
          report("nails", { yellowness: 10, spots: 20, ridges: 30 }),
          report("nails", { yellowness: 30, spots: 40, ridges: 50 }),
        ],
      },
      {
        shotId: "thumb",
        reports: [
          report("nails", { yellowness: 50, spots: 0, ridges: 10 }),
          report("nails", { yellowness: 99 }, false),
        ],
      },
    ]);
    expect(combined?.metrics.find((m) => m.key === "yellowness")?.value).toBe(30);
    expect(combined?.metrics.find((m) => m.key === "ridges")?.value).toBe(30);
  });

  it("takes each hair indicator only from the shot that shows it", () => {
    const combined = combineShots("hair", SESSIONS.hair, [
      { shotId: "lengths", reports: [report("hair", { shine: 60, porosity: 40, density: 99 })] },
      { shotId: "crown", reports: [report("hair", { shine: 5, porosity: 99, density: 30 })] },
      { shotId: "ends", reports: [report("hair", { shine: 5, porosity: 60, density: 99 })] },
    ]);
    const value = (key: string) => combined?.metrics.find((m) => m.key === key)?.value;
    expect(value("shine")).toBe(60);
    expect(value("density")).toBe(30);
    expect(value("porosity")).toBe(50); // lengths and ends
  });

  it("returns null when nothing scored", () => {
    expect(
      combineShots("skin", SESSIONS.skin, [
        { shotId: "face", reports: [report("skin", {}, false)] },
      ]),
    ).toBeNull();
  });
});
