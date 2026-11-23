import { describe, expect, it } from "vitest";

import { monthReport, reportMonths } from "@/lib/report-card";
import type { ScanRecord, ScanReport } from "@/lib/types";

const report = (erythema: number, hydration: number): ScanReport => ({
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
});

const scan = (id: string, date: string, r: ScanReport, demo = false): ScanRecord => ({
  id,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: date,
  report: r,
  demo,
});

describe("report card", () => {
  const scans = [
    scan("a", "2026-10-20T08:00:00Z", report(60, 40)),
    scan("b", "2026-11-03T08:00:00Z", report(50, 50)),
    scan("c", "2026-11-03T19:00:00Z", report(45, 55)),
    scan("d", "2026-11-20T08:00:00Z", report(30, 70)),
    scan("demo", "2026-12-01T08:00:00Z", report(0, 100), true),
  ];

  it("lists months with real scans, newest first", () => {
    expect(reportMonths(scans)).toEqual(["2026-11", "2026-10"]);
  });

  it("compares the month's last scan with the one going into it", () => {
    const month = monthReport(scans, "2026-11");
    expect(month.totalScans).toBe(3);
    expect(month.activeDays).toBe(2);
    const skin = month.areas[0];
    expect(skin?.change).toBeGreaterThan(0);
    expect(skin?.best?.key).toBe("erythema");
    expect(skin?.watch).toBeNull();
    expect(month.grade).toBe("rising");
  });

  it("a single first scan is getting started, not a trend", () => {
    const month = monthReport(scans, "2026-10");
    expect(month.areas[0]?.change).toBeNull();
    expect(month.grade).toBe("getting started");
  });
});
