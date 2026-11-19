import { describe, expect, it } from "vitest";

import { dailyStreak, forecastWeek, loadTicks, routineDone, toggleTick } from "@/lib/daily";
import type { ScanRecord } from "@/lib/types";

const scan = (local: string): ScanRecord => ({
  id: local,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: new Date(`${local}T10:00:00`).toISOString(),
});

describe("Routine tick-offs", () => {
  it("toggles steps and knows when a routine is done", () => {
    let ticks = toggleTick({}, "2026-11-19", "am", 0);
    ticks = toggleTick(ticks, "2026-11-19", "am", 1);
    expect(routineDone(ticks, "2026-11-19", "am", 2)).toBe(true);
    ticks = toggleTick(ticks, "2026-11-19", "am", 1);
    expect(routineDone(ticks, "2026-11-19", "am", 2)).toBe(false);
  });

  it("ignores stored ticks that don't validate", () => {
    expect(loadTicks('{"yesterday":{"am":[0]}}')).toEqual({});
  });
});

describe("Daily streak", () => {
  const now = new Date("2026-11-19T08:00:00");
  it("counts scans and finished routines, and doesn't break before today's", () => {
    expect(dailyStreak([scan("2026-11-17")], ["2026-11-18"], now)).toBe(2);
    expect(dailyStreak([scan("2026-11-19")], ["2026-11-18", "2026-11-17"], now)).toBe(3);
    expect(dailyStreak([scan("2026-11-16")], [], now)).toBe(0);
  });
});

describe("Forecast", () => {
  const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n)).toISOString();
  it("needs enough readings over enough days", () => {
    expect(
      forecastWeek(
        [
          { at: day(0), value: 50 },
          { at: day(1), value: 52 },
        ],
        2,
      ),
    ).toBeNull();
  });

  it("projects a clear rise and calls flat data steady", () => {
    const rising = [0, 4, 8, 12, 16, 20].map((n) => ({ at: day(n), value: 40 + n }));
    const up = forecastWeek(rising, 2);
    expect(up?.direction).toBe("up");
    expect(up?.inAWeek).toBeCloseTo(67, 0);
    const flat = [0, 4, 8, 12, 16].map((n, i) => ({ at: day(n), value: 60 + (i % 2) * 2 }));
    expect(forecastWeek(flat, 4)?.direction).toBe("steady");
  });
});
