import { describe, expect, it } from "vitest";

import type { Forecast, PlacesFile } from "@/lib/weather";
import { fold, searchPlaces, skinWeather, uvBand } from "@/lib/weather";

const file: PlacesFile = {
  source: "test",
  countries: { US: "United States", ZA: "South Africa", BR: "Brazil", ES: "Spain" },
  places: [
    ["New York City", "", "New York", "US", 40.71, -74.01],
    ["São Paulo", "Sao Paulo", "São Paulo", "BR", -23.55, -46.64],
    ["Los Angeles", "", "California", "US", 34.05, -118.24],
    ["Pietermaritzburg", "", "KwaZulu-Natal", "ZA", -29.62, 30.39],
    ["Los Angeles", "", "Madrid", "ES", 40.36, -3.7],
  ],
};

const forecast = (uv: number | null, humidity: number, temperature: number): Forecast => ({
  updatedAt: "2026-11-24T10:00:00Z",
  hours: Array.from({ length: 12 }, (_, i) => ({
    time: `2026-11-24T${String(10 + i).padStart(2, "0")}:00:00Z`,
    temperature,
    humidity,
    uv: uv === null ? null : i === 3 ? uv : uv / 2,
  })),
});

describe("skin weather", () => {
  it("finds towns in any country, accents and case ignored", () => {
    expect(searchPlaces(file, "sao pau")[0]?.name).toBe("São Paulo");
    expect(searchPlaces(file, "pieter")[0]?.region).toBe("KwaZulu-Natal");
    expect(searchPlaces(file, "new york")[0]?.country).toBe("United States");
  });

  it("narrows by region or country after a comma", () => {
    expect(searchPlaces(file, "los angeles, spain").map((p) => p.region)).toEqual(["Madrid"]);
    expect(searchPlaces(file, "los angeles, cali").map((p) => p.region)).toEqual(["California"]);
    expect(searchPlaces(file, "l")).toEqual([]);
  });

  it("uses the WHO UV bands", () => {
    expect([1, 4, 7, 9, 12].map(uvBand)).toEqual([
      "low",
      "moderate",
      "high",
      "very high",
      "extreme",
    ]);
  });

  it("leads with sun protection on a strong-UV day, and speaks to marks", () => {
    const today = skinWeather(forecast(9.4, 50, 24), ["pigment"]);
    expect(today.uvMax).toBe(9.4);
    expect(today.headline).toBe("Sun protection day");
    expect(today.tips[0]).toMatch(/darkens marks/);
  });

  it("flags dry air, humid air and heat", () => {
    expect(skinWeather(forecast(2, 20, 15), ["dryness"]).tips.join(" ")).toMatch(/dry/i);
    expect(skinWeather(forecast(2, 85, 22), ["shine"]).headline).toBe("Humid day");
    expect(skinWeather(forecast(2, 50, 33), ["redness"]).tips.join(" ")).toMatch(/redness/);
  });

  it("works without UV in the forecast", () => {
    const today = skinWeather(forecast(null, 50, 20));
    expect(today.uvMax).toBeNull();
    expect(today.headline).toBe("Gentle day for skin");
  });

  it("folds accents", () => {
    expect(fold(" Zürich ")).toBe("zurich");
  });
});
