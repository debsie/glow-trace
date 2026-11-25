import { describe, expect, it } from "vitest";

import { reportScore } from "@/lib/cv/kernel";
import { isPreview } from "@/lib/cv/preview";
import type { BiomarkerReport } from "@/lib/cv/types";
import { KERNEL_VERSION } from "@/lib/cv/types";

const report = (values: Record<string, number>): BiomarkerReport => ({
  kernelVersion: KERNEL_VERSION,
  category: "skin",
  quality: { width: 256, height: 256, sharpness: 50, usable: true },
  metrics: Object.entries(values).map(([key, value]) => ({
    key,
    label: key,
    value,
    higherMeans: key === "hydration" ? "better" : "more",
    description: "",
  })),
});

describe("preview readings", () => {
  it("marks even tone, hydration and texture on skin, and nothing on hair or nails", () => {
    expect(isPreview("skin", "discoloration")).toBe(true);
    expect(isPreview("skin", "hydration")).toBe(true);
    expect(isPreview("skin", "texture")).toBe(true);
    expect(isPreview("skin", "erythema")).toBe(false);
    expect(isPreview("hair", "texture")).toBe(false);
    expect(isPreview("nails", "spots")).toBe(false);
  });

  it("leaves preview readings out of the score", () => {
    const base = reportScore(report({ erythema: 20 }));
    expect(base).toBe(80);
    expect(
      reportScore(report({ erythema: 20, discoloration: 90, texture: 90, hydration: 5 })),
    ).toBe(base);
  });

  it("still scores a report whose readings are all previews", () => {
    expect(reportScore(report({ texture: 40 }))).toBe(60);
  });
});
