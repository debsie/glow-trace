import { describe, expect, it } from "vitest";

import { scanScore } from "@/lib/beauty";
import { rgbToLab, toPlanes } from "@/lib/cv/image";
import { analyzeBiomarkers, reportScore, reportToBiomarkers } from "@/lib/cv/kernel";
import { yellowness } from "@/lib/cv/nails";
import { parseBiomarkerReport } from "@/lib/cv/schemas";
import { erythema, skinTexture } from "@/lib/cv/skin";
import type { PixelBuffer } from "@/lib/cv/types";
import { KERNEL_VERSION } from "@/lib/cv/types";

/* Synthetic fixtures: pixels built directly, no photos. */

const solid = (r: number, g: number, b: number, size = 128): PixelBuffer => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let index = 0; index < size * size; index += 1) data.set([r, g, b, 255], index * 4);
  return { width: size, height: size, data };
};

const checkerboard = (size = 128): PixelBuffer => {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const value = (x + y) % 2 === 0 ? 40 : 215;
      data.set([value, value, value, 255], (y * size + x) * 4);
    }
  }
  return { width: size, height: size, data };
};

/** Skin-toned noise from a seeded generator, so it is identical on every run. */
const seededSkin = (size = 160, seed = 42): PixelBuffer => {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const data = new Uint8ClampedArray(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const jitter = (next() - 0.5) * 60;
    data.set([200 + jitter, 150 + jitter, 125 + jitter, 255], index * 4);
  }
  return { width: size, height: size, data };
};

describe("Colour maths", () => {
  it("converts sRGB to CIELab", () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 0);
    expect(a).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
    const [, redA] = rgbToLab(255, 0, 0);
    expect(redA).toBeGreaterThan(70);
  });
});

describe("Metric formulas", () => {
  it("scores a uniform red image high for erythema and a pale one low", () => {
    expect(erythema(toPlanes(solid(220, 40, 40))).value).toBeGreaterThanOrEqual(80);
    expect(erythema(toPlanes(solid(245, 240, 235))).value).toBeLessThanOrEqual(15);
  });

  it("scores a checkerboard high for texture and a flat grey low", () => {
    expect(skinTexture(toPlanes(checkerboard())).value).toBeGreaterThanOrEqual(70);
    expect(skinTexture(toPlanes(solid(128, 128, 128))).value).toBeLessThanOrEqual(10);
  });

  it("scores a yellow-tinted image high for nail yellowness", () => {
    expect(yellowness(toPlanes(solid(240, 230, 120))).value).toBeGreaterThanOrEqual(60);
  });
});

describe("Analysis kernel", () => {
  it("gives identical results for the same pixels", () => {
    const first = analyzeBiomarkers("skin", seededSkin());
    const second = analyzeBiomarkers("skin", seededSkin());
    expect(first).toEqual(second);
    expect(first.kernelVersion).toBe(KERNEL_VERSION);
    expect(first.quality.usable).toBe(true);
    expect(first.metrics.map((metric) => metric.key)).toEqual([
      "erythema",
      "texture",
      "hydration",
      "discoloration",
    ]);
    for (const metric of first.metrics) {
      expect(metric.value).toBeGreaterThanOrEqual(0);
      expect(metric.value).toBeLessThanOrEqual(100);
      expect(Math.round(metric.value * 10) / 10).toBe(metric.value);
    }
  });

  it("returns three metrics each for hair and nails", () => {
    expect(analyzeBiomarkers("hair", seededSkin()).metrics.map((m) => m.key)).toEqual([
      "porosity",
      "shine",
      "density",
    ]);
    expect(analyzeBiomarkers("nails", seededSkin()).metrics.map((m) => m.key)).toEqual([
      "yellowness",
      "spots",
      "ridges",
    ]);
  });

  it("refuses a dark photo with a notice and no metrics", () => {
    const report = analyzeBiomarkers("skin", solid(10, 8, 8));
    expect(report.quality.usable).toBe(false);
    expect(report.quality.notice).toBe("Photo too dark — retake or try better light");
    expect(report.metrics).toEqual([]);
    expect(reportScore(report)).toBeNull();
  });

  it("refuses blurred and tiny photos", () => {
    expect(analyzeBiomarkers("skin", solid(180, 140, 120)).quality.notice).toBe(
      "Photo too blurred — hold still and retake",
    );
    expect(analyzeBiomarkers("skin", seededSkin(64)).quality.notice).toBe(
      "Photo too small — use a closer or higher-resolution photo",
    );
  });
});

describe("Report validation and scoring", () => {
  it("rejects a report with an out-of-range value", () => {
    const report = analyzeBiomarkers("skin", seededSkin());
    const broken = {
      ...report,
      metrics: [{ ...report.metrics[0], value: 150 }],
    };
    expect(() => parseBiomarkerReport(broken)).toThrow(/Invalid biomarker report/);
    expect(parseBiomarkerReport(report)).toEqual(report);
  });

  it("scores higher-is-better metrics directly and higher-means-more ones inverted", () => {
    const report = parseBiomarkerReport({
      kernelVersion: KERNEL_VERSION,
      category: "skin",
      quality: { width: 200, height: 200, sharpness: 50, usable: true },
      metrics: [
        { key: "erythema", label: "E", value: 20, higherMeans: "more", description: "" },
        { key: "hydration", label: "H", value: 80, higherMeans: "better", description: "" },
      ],
    });
    expect(reportScore(report)).toBe(80);
    const biomarkers = reportToBiomarkers(report);
    expect(biomarkers.redness).toBe(20);
    expect(biomarkers.dryness).toBe(20);
    expect(scanScore({ biomarkers, report })).toBe(80);
  });
});
