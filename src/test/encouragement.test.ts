import { describe, expect, it } from "vitest";

import { cheerFor, weeksCheckedIn } from "@/lib/encouragement";
import type { ScanRecord, ScanReport } from "@/lib/types";

type Metric = ScanReport["metrics"][number];
const metric = (key: string, value: number, higherMeans: "more" | "better" = "more"): Metric => ({
  key,
  label: key,
  value,
  higherMeans,
  description: "",
});

const skin = (id: string, date: string, erythema: number, texture = 10): ScanRecord => ({
  id,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: date,
  report: {
    kernelVersion: "test",
    category: "skin",
    quality: { width: 256, height: 256, sharpness: 50, usable: true },
    metrics: [
      metric("erythema", erythema),
      metric("texture", texture),
      metric("hydration", 85, "better"),
      metric("discoloration", 10),
    ],
  },
});

const NOW = new Date("2026-11-20T12:00:00Z");

describe("Encouragement", () => {
  it("says nothing before the first scan", () => {
    expect(cheerFor([], "skin", NOW)).toEqual({ headline: null, lines: [] });
  });

  it("celebrates an area that reads well everywhere", () => {
    const cheer = cheerFor([skin("a", "2026-11-19T08:00:00Z", 10)], "skin", NOW);
    expect(cheer.headline).toMatch(/really good place/);
    expect(cheer.lines.some((line) => /strength/.test(line))).toBe(true);
  });

  it("names a real improvement and when it started", () => {
    const scans = [
      skin("a", "2026-10-01T08:00:00Z", 85),
      skin("b", "2026-10-15T08:00:00Z", 85),
      skin("c", "2026-11-01T08:00:00Z", 20),
      skin("d", "2026-11-19T08:00:00Z", 20),
    ];
    const cheer = cheerFor(scans, "skin", NOW);
    expect(cheer.lines[0]).toMatch(/improved by .* points since/);
    expect(cheer.lines[0]).toMatch(/not a lucky photo/);
  });

  it("never shouts", () => {
    const scans = [skin("a", "2026-11-01T08:00:00Z", 10), skin("b", "2026-11-12T08:00:00Z", 10)];
    const cheer = cheerFor(scans, "skin", NOW);
    for (const text of [cheer.headline ?? "", ...cheer.lines]) expect(text).not.toMatch(/!/);
  });

  it("counts distinct weeks of check-ins", () => {
    const scans = [
      skin("a", "2026-11-19T08:00:00Z", 10),
      skin("b", "2026-11-18T08:00:00Z", 10),
      skin("c", "2026-11-10T08:00:00Z", 10),
      skin("d", "2026-11-02T08:00:00Z", 10),
    ];
    expect(weeksCheckedIn(scans, "skin", NOW)).toBe(3);
    expect(cheerFor(scans, "skin", NOW).lines.at(-1)).toMatch(/3 weeks running/);
  });
});
