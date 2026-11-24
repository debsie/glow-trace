import { describe, expect, it } from "vitest";

import { weatherInsights } from "@/lib/weather-trends";
import type { ScanRecord } from "@/lib/types";

const scan = (i: number, redness: number, temperature: number, humidity = 50): ScanRecord => ({
  id: `s${i}`,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: `2026-11-${String(i + 1).padStart(2, "0")}T08:00:00Z`,
  weather: { temperature, humidity, uvMax: 3 },
  report: {
    kernelVersion: "mojocv-v2.9.0-ts",
    category: "skin",
    quality: { width: 256, height: 256, sharpness: 60, usable: true },
    metrics: [
      { key: "erythema", label: "Redness", value: redness, higherMeans: "more", description: "" },
    ],
  },
});

describe("weather in your trends", () => {
  it("finds redness higher on hot days, worded plainly", () => {
    const scans = [
      scan(0, 48, 31),
      scan(1, 50, 30),
      scan(2, 47, 33),
      scan(3, 49, 29),
      scan(4, 40, 22),
      scan(5, 41, 20),
      scan(6, 39, 18),
      scan(7, 42, 24),
    ];
    const [top] = weatherInsights(scans, "skin");
    expect(top?.condition).toBe("hot");
    expect(top?.better).toBe(false);
    expect(top?.sentence).toBe("Your redness reads 8 points higher on days above 28°.");
  });

  it("stays quiet with too few scans or a difference within normal variation", () => {
    expect(weatherInsights([scan(0, 50, 31), scan(1, 40, 20)], "skin")).toEqual([]);
    const noisy = [
      scan(0, 30, 31),
      scan(1, 60, 30),
      scan(2, 45, 33),
      scan(3, 35, 20),
      scan(4, 55, 21),
      scan(5, 42, 19),
    ];
    expect(weatherInsights(noisy, "skin")).toEqual([]);
  });
});
