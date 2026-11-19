import { describe, expect, it } from "vitest";

import {
  addDays,
  dueToday,
  loadEvents,
  milestones,
  pairFor,
  weekOf,
  weeklyStreak,
} from "@/lib/engagement";
import type { CheckinEvent } from "@/lib/engagement";
import { streakBonusScans } from "@/lib/referrals";
import type { ScanRecord } from "@/lib/types";

const scan = (
  id: string,
  local: string,
  category: ScanRecord["category"] = "skin",
): ScanRecord => ({
  id,
  user_id: "u",
  category,
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  // Local time, so the tests mean the same in every time zone.
  created_at: new Date(`${local}T10:00:00`).toISOString(),
});

const makeup: CheckinEvent = { id: "e1", kind: "makeup", day: "2026-11-20", note: "" };

describe("Before-and-after check-ins", () => {
  it("asks for the day before and the day after", () => {
    expect(dueToday([makeup], [], "2026-11-19").map((step) => step.moment)).toEqual(["before"]);
    expect(dueToday([makeup], [], "2026-11-21").map((step) => step.moment)).toEqual(["after"]);
    expect(dueToday([makeup], [], "2026-11-20")).toEqual([]);
  });

  it("stops asking once the scan is taken, in the right area", () => {
    expect(dueToday([makeup], [scan("a", "2026-11-19", "hair")], "2026-11-19")).toHaveLength(1);
    expect(dueToday([makeup], [scan("a", "2026-11-19")], "2026-11-19")).toHaveLength(0);
  });

  it("pairs the before and after scans for the comparison", () => {
    const scans = [scan("b", "2026-11-19"), scan("c", "2026-11-21")];
    expect(pairFor(makeup, scans)).toMatchObject({ before: { id: "b" }, after: { id: "c" } });
    expect(pairFor(makeup, scans.slice(0, 1))).toBeNull();
  });

  it("ignores stored events that don't validate", () => {
    expect(loadEvents('[{"id":"x","kind":"party","day":"2026-11-20"}]')).toEqual([]);
    expect(loadEvents("not json")).toEqual([]);
  });

  it("crosses month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });
});

describe("Weekly streak and rewards", () => {
  const now = new Date("2026-11-19T12:00:00"); // a Thursday

  it("counts consecutive weeks and does not break before this week's scan", () => {
    const scans = ["2026-10-27", "2026-11-03", "2026-11-12"].map((d, i) => scan(`s${i}`, d));
    expect(weekOf(now)).toBe("2026-11-16");
    expect(weeklyStreak(scans, now)).toBe(3);
    expect(weeklyStreak([...scans, scan("t", "2026-11-18")], now)).toBe(4);
  });

  it("breaks after a missed week", () => {
    expect(weeklyStreak([scan("a", "2026-10-27"), scan("b", "2026-11-12")], now)).toBe(1);
  });

  it("rewards a four-week streak with bonus check-ins", () => {
    expect(streakBonusScans(3)).toBe(0);
    expect(streakBonusScans(4)).toBe(2);
  });

  it("marks milestones", () => {
    const scans = [
      scan("a", "2026-11-12"),
      scan("b", "2026-11-12", "hair"),
      scan("c", "2026-11-12", "nails"),
    ];
    const reached = milestones(scans, [], now)
      .filter((m) => m.reached)
      .map((m) => m.id);
    expect(reached).toEqual(["first", "all-three"]);
  });
});
