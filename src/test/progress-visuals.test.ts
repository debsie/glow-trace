import { describe, expect, it } from "vitest";

import { indicatorSeries, zoneChanges } from "@/lib/progress";
import type { ScanRecord, ScanReport } from "@/lib/types";

const report = (erythema: number, hydration: number, zones?: ScanReport["zones"]): ScanReport => ({
  kernelVersion: "mojocv-v2.6.0-ts",
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 60, usable: true },
  metrics: [
    { key: "erythema", label: "Redness", value: erythema, higherMeans: "more", description: "" },
    {
      key: "hydration",
      label: "Hydration",
      value: hydration,
      higherMeans: "better",
      description: "",
    },
  ],
  zones,
});

const scan = (id: string, date: string, r: ScanReport): ScanRecord => ({
  id,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: date,
  report: r,
});

describe("progress visuals", () => {
  const scans = [
    scan(
      "b",
      "2026-11-10T08:00:00Z",
      report(40, 60, { forehead: 30, leftCheek: 50, rightCheek: 45, chin: 20 }),
    ),
    scan(
      "a",
      "2026-11-01T08:00:00Z",
      report(50, 50, { forehead: 35, leftCheek: 60, rightCheek: 55, chin: 21 }),
    ),
  ];

  it("gives each indicator its history, oldest first, with a verdict", () => {
    const series = indicatorSeries(scans, "skin");
    const redness = series.find((s) => s.key === "erythema");
    expect(redness?.points.map((p) => p.value)).toEqual([50, 40]);
    expect(redness?.change).toBe(-10);
    expect(redness?.verdict).toBe("better");
    expect(series.find((s) => s.key === "hydration")?.verdict).toBe("better");
  });

  it("maps redness by face zone against the first zoned scan", () => {
    const zones = zoneChanges(scans);
    expect(zones?.find((z) => z.zone === "leftCheek")).toEqual({
      zone: "leftCheek",
      before: 60,
      after: 50,
      delta: -10,
    });
  });

  it("has no face map before any zoned scan", () => {
    expect(zoneChanges([scan("x", "2026-11-01T08:00:00Z", report(1, 1))])).toBeNull();
  });
});
