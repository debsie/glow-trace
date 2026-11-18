import { describe, expect, it } from "vitest";

import { depthFor, makeupPrep, undertoneFor } from "@/lib/makeup";
import type { ScanReport } from "@/lib/types";

const report = (values: Record<string, number>, tone = { ita: 30, hueAngle: 55 }): ScanReport => ({
  kernelVersion: "test",
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 50, usable: true },
  metrics: Object.entries(values).map(([key, value]) => ({
    key,
    label: key,
    value,
    higherMeans: key === "hydration" ? "better" : "more",
    description: "",
  })),
  tone,
});

describe("Makeup prep", () => {
  it("bands depth by ITA and undertone by hue angle", () => {
    expect(depthFor(60)).toBe("Very light");
    expect(depthFor(30)).toBe("Light-medium");
    expect(depthFor(0)).toBe("Deep");
    expect(depthFor(-45)).toBe("Rich deep");
    expect(undertoneFor(40)).toBe("Cool (pink)");
    expect(undertoneFor(55)).toBe("Neutral");
    expect(undertoneFor(66)).toBe("Warm (golden)");
  });

  it("builds prep from the readings, not fixed text", () => {
    const red = makeupPrep(report({ erythema: 70, hydration: 45, texture: 60, discoloration: 10 }));
    expect(red?.correctors[0]).toMatch(/Green/);
    expect(red?.finish).toMatch(/Dewy/);
    expect(red?.primer).toMatch(/Smoothing/);
    const calm = makeupPrep(
      report({ erythema: 20, hydration: 80, texture: 20, discoloration: 10 }),
    );
    expect(calm?.correctors).toEqual([]);
    expect(calm?.prep).toEqual(["Your usual moisturiser and sunscreen, then base"]);
  });

  it("picks a corrector colour for the skin depth", () => {
    const deep = makeupPrep(
      report(
        { erythema: 20, hydration: 70, texture: 20, discoloration: 50 },
        { ita: -20, hueAngle: 58 },
      ),
    );
    expect(deep?.correctors[0]).toMatch(/Orange/);
    const light = makeupPrep(
      report({ erythema: 20, hydration: 70, texture: 20, discoloration: 50 }),
    );
    expect(light?.correctors[0]).toMatch(/Peach/);
  });

  it("marks the undertone unsure under coloured light, and needs a tone readout", () => {
    const warned = report({ erythema: 20, hydration: 70, texture: 20, discoloration: 10 });
    warned.quality.warning = "The light looks warm";
    expect(makeupPrep(warned)?.undertoneSure).toBe(false);
    expect(makeupPrep({ ...warned, tone: undefined })).toBeNull();
  });
});
