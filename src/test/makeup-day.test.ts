import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE, foundationFor, makeupDay, removalSteps } from "@/lib/makeup-day";
import type { ScanReport } from "@/lib/types";

const report = (values: Record<string, number>): ScanReport => ({
  kernelVersion: "test",
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 50, usable: true },
  metrics: Object.entries(values).map(([key, value]) => ({
    key,
    label: key,
    value,
    higherMeans: key === "hydration" ? "better" : "more",
    description: "",
  })),
  tone: { ita: 30, hueAngle: 55 },
});

const calm = { erythema: 20, hydration: 70, texture: 20, discoloration: 10 };

describe("Foundation", () => {
  it("matches the base to the skin", () => {
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, feel: "oily" }).base).toBe(
      "Oil-free, water-based",
    );
    expect(foundationFor(report({ ...calm, hydration: 40 }), DEFAULT_PROFILE).base).toMatch(
      /Hydrating/,
    );
    expect(foundationFor(report({ ...calm, texture: 70 }), DEFAULT_PROFILE).base).toBe(
      "Silicone-based",
    );
    expect(foundationFor(report({ ...calm, erythema: 80 }), DEFAULT_PROFILE).base).toBe(
      "Mineral powder",
    );
    expect(foundationFor(report(calm), DEFAULT_PROFILE).base).toBe("Water-based");
  });

  it("picks the finish from oiliness, dryness and climate", () => {
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, feel: "oily" }).finish).toBe("Matte");
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, feel: "dry" }).finish).toBe("Dewy");
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, climate: "humid" }).finish).toBe(
      "Soft matte",
    );
    expect(foundationFor(report(calm), DEFAULT_PROFILE).finish).toBe("Satin");
  });

  it("raises coverage only as far as uneven tone needs, or the person wants", () => {
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, coverage: "sheer" }).coverage).toBe(
      "Sheer",
    );
    expect(
      foundationFor(report({ ...calm, discoloration: 60 }), {
        ...DEFAULT_PROFILE,
        coverage: "sheer",
      }).coverage,
    ).toBe("Medium");
    expect(foundationFor(report(calm), { ...DEFAULT_PROFILE, coverage: "full" }).coverage).toBe(
      "Full",
    );
  });
});

describe("Removal and recovery", () => {
  it("double cleanses with oil for waterproof or long wear", () => {
    expect(removalSteps(report(calm), { ...DEFAULT_PROFILE, waterproof: true })[0]).toMatch(
      /oil or balm/,
    );
    expect(removalSteps(report({ ...calm, erythema: 70 }), DEFAULT_PROFILE)[0]).toMatch(
      /fragrance-free micellar/,
    );
  });

  it("holds back actives after makeup on red skin", () => {
    const day = makeupDay(report({ ...calm, erythema: 70 }), DEFAULT_PROFILE);
    expect(day.recovery.join(" ")).toMatch(/Skip retinoids and acids/);
    expect(day.before.prep?.correctors[0]).toMatch(/Green/);
  });

  it("works from answers alone before any scan", () => {
    const day = makeupDay(null, { ...DEFAULT_PROFILE, feel: "dry" });
    expect(day.before.prep).toBeNull();
    expect(day.before.foundation.base).toMatch(/Hydrating/);
    expect(day.before.setting).toMatch(/setting spray instead of powder/);
  });
});
