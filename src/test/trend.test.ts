import { describe, expect, it } from "vitest";

import { estimateTrend, normalCdf } from "@/lib/trend";

const model = { readingSd: 3, driftPerDay: 0.5 };

describe("Trend filter", () => {
  it("computes the normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.645)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });

  it("is sure of a large change and unsure of a small one", () => {
    const big = estimateTrend(
      [
        { at: "2026-11-01T08:00:00Z", value: 40 },
        { at: "2026-11-15T08:00:00Z", value: 60 },
      ],
      model,
    );
    expect(big?.change).toBeGreaterThan(10);
    expect(big?.certainty).toBeGreaterThan(0.95);
    const small = estimateTrend(
      [
        { at: "2026-11-01T08:00:00Z", value: 40 },
        { at: "2026-11-15T08:00:00Z", value: 43 },
      ],
      model,
    );
    expect(small?.certainty).toBeLessThan(0.95);
  });

  it("trusts a jump less when scans are minutes apart than weeks apart", () => {
    const minutes = estimateTrend(
      [
        { at: "2026-11-15T08:00:00Z", value: 40 },
        { at: "2026-11-15T08:05:00Z", value: 52 },
      ],
      model,
    );
    const weeks = estimateTrend(
      [
        { at: "2026-11-01T08:00:00Z", value: 40 },
        { at: "2026-11-15T08:00:00Z", value: 52 },
      ],
      model,
    );
    expect(Math.abs(minutes?.change ?? 0)).toBeLessThan(Math.abs(weeks?.change ?? 0));
  });

  it("averages out one noisy reading in a steady series", () => {
    const steady = estimateTrend(
      ["01", "05", "09", "13", "17"].map((day, i) => ({
        at: `2026-11-${day}T08:00:00Z`,
        value: i === 4 ? 56 : 50,
      })),
      model,
    );
    expect(steady?.level).toBeLessThan(56);
    expect(steady?.level).toBeGreaterThan(50);
  });

  it("handles one reading and none", () => {
    expect(estimateTrend([], model)).toBeNull();
    expect(estimateTrend([{ at: "2026-11-01T08:00:00Z", value: 40 }], model)?.change).toBe(0);
  });
});
