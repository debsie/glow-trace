import { z } from "zod";

/**
 * Skin weather: today's UV, humidity and temperature where the person is, turned into skin advice.
 * Towns come from a built-in world list (GeoNames, CC BY 4.0) searched on the device; the forecast
 * comes from MET Norway (CC BY 4.0) through Glowtrace's own server, which only ever sees a town's
 * coordinates. Advice is Glowtrace's own, derived from that data; general guidance, not medical.
 */

/** [name, ascii name or "", region, country code, lat, lon], most populous first. */
export const placeRowSchema = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.string().length(2),
  z.number().min(-90).max(90),
  z.number().min(-180).max(180),
]);
export const placesFileSchema = z.object({
  source: z.string(),
  countries: z.record(z.string(), z.string()),
  places: z.array(placeRowSchema),
});
export type PlacesFile = z.infer<typeof placesFileSchema>;

export const placeSchema = z.object({
  name: z.string().min(1).max(120),
  region: z.string().max(120),
  country: z.string().max(80),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof placeSchema>;

export const PLACE_KEY = "glowtrace:weather-place:v1";

/** Lower case, accents removed, so "sao paulo" finds São Paulo. */
export const fold = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Towns matching what was typed, best first. "Springfield, Illinois" or "Paris, US" narrow by
 * region or country after the comma. Earlier rows are bigger towns, so ties go to the bigger one.
 */
export const searchPlaces = (file: PlacesFile, query: string, limit = 8): Place[] => {
  const [rawName = "", ...rest] = query.split(",");
  const name = fold(rawName);
  const where = fold(rest.join(","));
  if (name.length < 2) return [];
  const starts: Place[] = [];
  const contains: Place[] = [];
  for (const [placeName, ascii, region, code, lat, lon] of file.places) {
    const names = [fold(placeName), fold(ascii)];
    const country = file.countries[code] ?? code;
    if (
      where &&
      ![fold(region), fold(country), code.toLowerCase()].some((w) => w.startsWith(where))
    ) {
      continue;
    }
    const place = { name: placeName, region, country, lat, lon };
    if (names.some((n) => n.startsWith(name))) starts.push(place);
    else if (contains.length < limit && names.some((n) => n.includes(name))) contains.push(place);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
};

/** What the weather server returns: the next hours at the town, from MET Norway. */
export const forecastSchema = z.object({
  updatedAt: z.string(),
  hours: z
    .array(
      z.object({
        time: z.string(),
        temperature: z.number(),
        humidity: z.number().min(0).max(100),
        /** Clear-sky UV index (no clouds), when the forecast has it. */
        uv: z.number().min(0).max(20).nullable(),
      }),
    )
    .min(1),
});
export type Forecast = z.infer<typeof forecastSchema>;

export type UvBand = "low" | "moderate" | "high" | "very high" | "extreme";

/** WHO UV index bands. */
export const uvBand = (uv: number): UvBand =>
  uv < 3 ? "low" : uv < 6 ? "moderate" : uv < 8 ? "high" : uv < 11 ? "very high" : "extreme";

export type SkinWeather = {
  uvMax: number | null;
  uvBand: UvBand | null;
  humidity: number;
  temperature: number;
  headline: string;
  tips: string[];
};

/**
 * Advice for today from the next 12 hours. `concerns` are the person's own flagged indicators
 * (e.g. "redness", "pigment", "dryness", "shine"), so tips lead with what matters to them.
 */
export const skinWeather = (forecast: Forecast, concerns: readonly string[] = []): SkinWeather => {
  const next = forecast.hours.slice(0, 12);
  const now = next[0] ?? forecast.hours[0];
  const uvs = next.flatMap((hour) => (hour.uv === null ? [] : [hour.uv]));
  const uvMax = uvs.length ? Math.round(Math.max(...uvs) * 10) / 10 : null;
  const band = uvMax === null ? null : uvBand(uvMax);
  const humidity = Math.round(now?.humidity ?? 50);
  const temperature = Math.round((now?.temperature ?? 20) * 10) / 10;
  const has = (word: string) => concerns.includes(word);
  const tips: string[] = [];

  if (band === "high" || band === "very high" || band === "extreme") {
    tips.push(
      has("pigment")
        ? "Strong sun today, and sun is what darkens marks. SPF 30 or more, reapplied every two hours outdoors, plus a hat."
        : "Strong sun today. SPF 30 or more on face, neck and ears, and reapply every two hours outdoors.",
    );
  } else if (band === "moderate") {
    tips.push("Moderate sun. Daily sunscreen is enough unless you're outside for long.");
  } else if (band === "low") {
    tips.push("Low UV today, but daily sunscreen still protects against marks over time.");
  }

  if (humidity < 30) {
    tips.push(
      has("dryness")
        ? "Very dry air pulls water from skin that's already dry. Layer a hydrating serum under a richer cream, and lip balm."
        : "Dry air today. Seal in moisture with a cream after cleansing, and skip extra exfoliation.",
    );
  } else if (humidity > 75) {
    tips.push(
      has("shine")
        ? "Humid air means more shine. Use a light gel moisturiser and blot rather than re-powdering."
        : "Humid today. A lighter moisturiser is plenty; heavy creams can feel clogging.",
    );
  }

  if (temperature >= 30) {
    tips.push(
      has("redness")
        ? "Heat brings redness up. Rinse with cool water, and keep strong actives for the evening."
        : "Hot day: cleanse off sweat and sunscreen at night so pores stay clear.",
    );
  } else if (temperature <= 8) {
    tips.push(
      "Cold air and indoor heating dry the skin barrier. A barrier cream and hand cream help.",
    );
  }

  const headline =
    band === "extreme" || band === "very high"
      ? "Sun protection day"
      : humidity < 30
        ? "Dry-air day"
        : humidity > 75
          ? "Humid day"
          : temperature >= 30
            ? "Hot day"
            : "Gentle day for skin";
  return { uvMax, uvBand: band, humidity, temperature, headline, tips: tips.slice(0, 3) };
};

/** UV at or above this needs sunscreen reapplied outdoors (WHO "moderate" and up). */
export const UV_REAPPLY = 3;

/**
 * The run of hours today when UV is at or above `threshold`: start and end as ISO times (end is the
 * last such hour), and the peak. Null when the forecast has no UV or it never gets that high.
 */
export const uvWindow = (
  forecast: Forecast,
  threshold = UV_REAPPLY,
): { start: string; end: string; peak: number; peakAt: string } | null => {
  const next = forecast.hours.slice(0, 16);
  const strong = next.filter((hour) => hour.uv !== null && hour.uv >= threshold);
  const first = strong[0];
  const last = strong[strong.length - 1];
  if (!first || !last) return null;
  const top = strong.reduce((a, b) => ((b.uv ?? 0) > (a.uv ?? 0) ? b : a));
  return { start: first.time, end: last.time, peak: top.uv ?? 0, peakAt: top.time };
};

export type WeatherStep = { when: "am" | "pm"; step: string; why: string };

/** Routine changes for today's weather, shown in the morning and evening routines. */
export const weatherSteps = (today: SkinWeather): WeatherStep[] => {
  const steps: WeatherStep[] = [];
  if (today.uvBand && today.uvBand !== "low") {
    steps.push({
      when: "am",
      step: "SPF 30 or more as your last skincare step",
      why: `UV reaches ${today.uvMax?.toFixed(1)} today`,
    });
  }
  if (today.uvBand === "high" || today.uvBand === "very high" || today.uvBand === "extreme") {
    steps.push({
      when: "am",
      step: "Pack sunscreen to reapply at midday",
      why: "Strong sun from late morning",
    });
  }
  if (today.humidity < 30) {
    steps.push({
      when: "am",
      step: "Hydrating serum under a richer moisturiser",
      why: `Air is dry (${today.humidity}%)`,
    });
    steps.push({
      when: "pm",
      step: "Skip exfoliating acids tonight; seal in moisture instead",
      why: "Dry air weakens the skin barrier",
    });
  } else if (today.humidity > 75) {
    steps.push({
      when: "am",
      step: "Swap to a light gel moisturiser",
      why: `Humid air (${today.humidity}%)`,
    });
  }
  if (today.temperature >= 30) {
    steps.push({
      when: "pm",
      step: "Double cleanse to lift sweat and sunscreen",
      why: `Hot day (${today.temperature.toFixed(0)}°)`,
    });
  } else if (today.temperature <= 8) {
    steps.push({
      when: "pm",
      step: "Barrier cream on face and hands",
      why: `Cold air (${today.temperature.toFixed(0)}°)`,
    });
  }
  return steps;
};

/** "10:00" in the phone's own time; client only (never rendered on the server). */
export const hourLabel = (iso: string) => `${String(new Date(iso).getHours()).padStart(2, "0")}:00`;
