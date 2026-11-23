import { describe, expect, it } from "vitest";

import {
  beforeAfter,
  currentWeek,
  loadEnrolments,
  PROGRAMMES,
  programmeById,
  toggleProgrammeTick,
  weeklyCheckIns,
} from "@/lib/programmes";
import type { ScanRecord } from "@/lib/types";

const scan = (local: string, erythema: number): ScanRecord => ({
  id: local,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: new Date(`${local}T10:00:00`).toISOString(),
  report: {
    kernelVersion: "t",
    category: "skin",
    quality: { width: 1, height: 1, sharpness: 50, usable: true },
    metrics: [
      { key: "erythema", label: "Redness", value: erythema, higherMeans: "more", description: "" },
    ],
  },
});

const redness = programmeById("calm-redness");
const enrolment = { id: "calm-redness", startDay: "2026-11-02", ticks: [] };

describe("Programmes", () => {
  it("has four weeks of three steps each", () => {
    for (const programme of PROGRAMMES) {
      expect(programme.weeks).toHaveLength(4);
      for (const week of programme.weeks) expect(week.steps).toHaveLength(3);
    }
  });

  it("tracks the week, check-ins and the before and after", () => {
    if (!redness) throw new Error("missing");
    expect(currentWeek(enrolment, "2026-11-02")).toBe(0);
    expect(currentWeek(enrolment, "2026-11-17")).toBe(2);
    expect(currentWeek(enrolment, "2026-12-30")).toBe(4);
    const scans = [scan("2026-11-03", 60), scan("2026-11-12", 50), scan("2026-11-28", 41)];
    expect(weeklyCheckIns(redness, enrolment, scans)).toEqual([true, true, false, true]);
    expect(beforeAfter(redness, enrolment, scans)).toEqual({ before: 60, after: 41, better: true });
  });

  it("toggles step ticks and drops unknown programmes on load", () => {
    const ticked = toggleProgrammeTick(enrolment, 1, 2);
    expect(ticked.ticks).toEqual(["1-2"]);
    expect(toggleProgrammeTick(ticked, 1, 2).ticks).toEqual([]);
    expect(loadEnrolments('[{"id":"nope","startDay":"2026-11-02"}]')).toEqual([]);
  });
});
