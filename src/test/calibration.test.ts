import { describe, expect, it } from "vitest";

import {
  agreementByMetric,
  buildSample,
  coverage,
  MIN_SAMPLES,
  questionFor,
  repeatability,
  spearman,
} from "@/lib/calibration";
import type { CalibrationRow } from "@/lib/calibration";
import type { BiomarkerReport } from "@/lib/cv/types";

const report = (overrides: Partial<BiomarkerReport> = {}): BiomarkerReport => ({
  kernelVersion: "mojocv-v1.3.0-ts-fallback",
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 40, usable: true },
  metrics: [
    {
      key: "erythema",
      label: "Redness",
      value: 32.9,
      higherMeans: "more",
      description: "",
    },
    {
      key: "hydration",
      label: "Hydration",
      value: 69.9,
      higherMeans: "better",
      description: "",
    },
  ],
  ...overrides,
});

describe("Building a contribution", () => {
  it("builds a numbers-only payload from a scored report", () => {
    const result = buildSample({
      report: report(),
      selfReport: { erythema: 2, hydration: 4 },
      lighting: "daylight_window",
      fitzpatrick: 4,
      repeatOf: null,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sample.metrics).toEqual({ erythema: 32.9, hydration: 69.9 });
    expect(result.sample.self_report).toEqual({ erythema: 2, hydration: 4 });
    expect(Object.keys(result.sample)).not.toContain("image");
    expect(JSON.stringify(result.sample)).not.toMatch(/blob:|data:image/);
  });

  it("refuses unscored photos and missing ratings", () => {
    const base = { selfReport: {}, lighting: "flash" as const, fitzpatrick: null, repeatOf: null };
    expect(
      buildSample({
        ...base,
        report: report({
          quality: { width: 1, height: 1, sharpness: 0, usable: false },
          metrics: [],
        }),
      }).ok,
    ).toBe(false);
    const missing = buildSample({ ...base, report: report(), selfReport: { erythema: 3 } });
    expect(missing).toEqual({ ok: false, reason: "Rate hydration first." });
  });

  it("rejects ratings outside 1 to 5", () => {
    const result = buildSample({
      report: report(),
      selfReport: { erythema: 9, hydration: 4 },
      lighting: "flash",
      fitzpatrick: null,
      repeatOf: null,
    });
    expect(result.ok).toBe(false);
  });

  it("words questions so 5 always means more of what is named", () => {
    const [redness, hydration] = report().metrics;
    expect(questionFor(redness!)).toMatch(/How much redness.*5 a lot/);
    expect(questionFor(hydration!)).toMatch(/How good is the hydration.*5 excellent/);
  });
});

describe("Statistics", () => {
  it("computes Spearman correlation, with ties", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBe(1);
    expect(spearman([1, 2, 3, 4], [40, 30, 20, 10])).toBe(-1);
    expect(spearman([1, 2, 2, 3], [1, 2, 2, 3])).toBe(1);
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([5, 5, 5], [1, 2, 3])).toBeNull();
  });

  const row = (
    id: string,
    score: number,
    rating: number,
    extra: Partial<CalibrationRow> = {},
  ): CalibrationRow => ({
    id,
    category: "skin",
    metrics: { erythema: score },
    self_report: { erythema: rating },
    lighting: "daylight_window",
    fitzpatrick: null,
    repeat_of: null,
    created_at: "2026-11-19T08:00:00Z",
    ...extra,
  });

  it("reports agreement per indicator and says when there is too little data", () => {
    const rows = Array.from({ length: 5 }, (_, i) => row(`r${i}`, i * 20, i + 1));
    const [agreement] = agreementByMetric(rows, "skin");
    expect(agreement).toMatchObject({ key: "erythema", n: 5, rho: 1, enough: false });
    const many = Array.from({ length: MIN_SAMPLES }, (_, i) => row(`m${i}`, i, (i % 5) + 1));
    expect(agreementByMetric(many, "skin")[0]?.enough).toBe(true);
    expect(agreementByMetric(rows, "hair")).toEqual([]);
  });

  it("measures how far a repeat photo moves from the first", () => {
    const rows = [
      row("a", 30, 2),
      row("b", 36, 2, { repeat_of: "a" }),
      row("c", 50, 3),
      row("d", 44, 3, { repeat_of: "c" }),
      row("e", 10, 1, { repeat_of: "missing" }),
    ];
    expect(repeatability(rows)).toEqual([{ key: "erythema", pairs: 2, meanDifference: 6, p90: 6 }]);
  });

  it("counts coverage across lighting and skin types", () => {
    const rows = [
      row("a", 1, 1, { fitzpatrick: 5 }),
      row("b", 2, 2, { lighting: "flash" }),
      row("c", 3, 3, { repeat_of: "a" }),
    ];
    expect(coverage(rows)).toEqual({
      total: 3,
      byCategory: { skin: 3 },
      byLighting: { daylight_window: 2, flash: 1 },
      byFitzpatrick: { "Type 5": 1, "Not given": 2 },
      pairs: 1,
    });
  });
});
