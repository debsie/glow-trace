import { describe, expect, it } from "vitest";

import { compareScans, longDate, scoreChange, seriesFor, shortDate } from "@/lib/progress";
import type { ScanRecord, ScanReport } from "@/lib/types";

const report = (erythema: number, hydration: number): ScanReport => ({
  kernelVersion: "mojocv-v1.1.0-ts-fallback",
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 60, usable: true },
  metrics: [
    {
      key: "erythema",
      label: "Redness",
      value: erythema,
      higherMeans: "more",
      description: "",
    },
    {
      key: "hydration",
      label: "Hydration",
      value: hydration,
      higherMeans: "better",
      description: "",
    },
  ],
});

const scan = (
  id: string,
  date: string,
  r: ScanReport,
  extra: Partial<ScanRecord> = {},
): ScanRecord => ({
  id,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: date,
  report: r,
  ...extra,
});

describe("Progress", () => {
  it("formats dates the same way everywhere, in UTC", () => {
    expect(shortDate("2026-10-25T23:30:00Z")).toBe("25 Oct");
    expect(longDate("2026-01-03T00:00:00Z")).toBe("3 January 2026");
  });

  const early = scan("a", "2026-11-01T10:00:00Z", report(40, 50));
  const late = scan("b", "2026-11-15T10:00:00Z", report(30, 51));
  const demo = scan("c", "2026-11-10T10:00:00Z", report(10, 90), { demo: true });
  const hair = scan("d", "2026-11-12T10:00:00Z", report(10, 90), { category: "hair" });

  it("builds an oldest-first series for one area, without unscored scans", () => {
    const series = seriesFor([late, demo, hair, early], "skin");
    expect(series.map((point) => point.id)).toEqual(["a", "b"]);
    // Hydration is a preview reading (cv/preview.ts), so only redness counts in the score.
    expect(series.map((point) => point.score)).toEqual([60, 70]);
    expect(scoreChange(series)).toBe(10);
    expect(scoreChange(series.slice(0, 1))).toBeNull();
  });

  it("calls lower redness better and leaves preview readings out of change", () => {
    const changes = compareScans(early, late);
    expect(changes).toEqual([
      {
        key: "erythema",
        label: "Redness",
        before: 40,
        after: 30,
        delta: -10,
        verdict: "better",
      },
    ]);
    expect(compareScans(late, early)[0]?.verdict).toBe("worse");
    // An older scan without a report still lines up with a new one, indicator by indicator.
    const legacy = scan("old", "2026-10-01T10:00:00Z", report(0, 0), {
      report: undefined,
      biomarkers: { redness: 50, dryness: 60, texture: 30, porosity: 0, discoloration: 0 },
    });
    expect(compareScans(legacy, late).map((change) => [change.key, change.before])).toEqual([
      ["erythema", 50],
    ]);
  });
});
