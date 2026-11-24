import { z } from "zod";

import { getSupabase } from "@/integrations/supabase/client";

import type { Forecast, Place, PlacesFile } from "./weather";
import { forecastSchema, PLACE_KEY, placeSchema, placesFileSchema } from "./weather";

/** The chosen town, kept on this device. */
export const loadPlace = (): Place | null => {
  try {
    const raw = window.localStorage.getItem(PLACE_KEY);
    const parsed = placeSchema.safeParse(raw ? JSON.parse(raw) : null);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const savePlace = (place: Place | null): void => {
  try {
    if (place) window.localStorage.setItem(PLACE_KEY, JSON.stringify(place));
    else window.localStorage.removeItem(PLACE_KEY);
  } catch {
    // Not saved; the card still works for this visit.
  }
};

let placesFile: Promise<PlacesFile | null> | null = null;

/** The world town list, downloaded once when the picker first opens. */
export const loadPlaces = (): Promise<PlacesFile | null> => {
  placesFile ??= fetch("/data/places.json")
    .then((response) => (response.ok ? response.json() : null))
    .then((data: unknown) => {
      const parsed = placesFileSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    })
    .catch(() => null);
  return placesFile;
};

const CACHE_KEY = "glowtrace:weather-cache:v1";
const cacheSchema = z.object({ key: z.string(), at: z.number(), forecast: forecastSchema });
const errorSchema = z.object({ error: z.string().max(300), off: z.boolean().optional() });

export type WeatherReply = { forecast: Forecast } | { error: string; off?: boolean | undefined };

/** Forecast for a town via Glowtrace's server, reused on this device for up to an hour. */
export const fetchForecast = async (place: Place): Promise<WeatherReply> => {
  const key = `${place.lat.toFixed(2)},${place.lon.toFixed(2)}`;
  try {
    const cached = cacheSchema.safeParse(
      JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? "null"),
    );
    if (cached.success && cached.data.key === key && Date.now() - cached.data.at < 60 * 60 * 1000) {
      return { forecast: cached.data.forecast };
    }
  } catch {
    // No cache; fetch below.
  }
  const supabase = getSupabase();
  if (!supabase) return { error: "Sign in to see skin weather.", off: true };
  const { data, error } = await supabase.functions.invoke("weather", {
    body: { lat: place.lat, lon: place.lon },
  });
  if (error) {
    const context: unknown = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const parsed = errorSchema.safeParse(await context.json().catch(() => null));
      if (parsed.success) return parsed.data;
    }
    return { error: "Skin weather can't be reached right now." };
  }
  const parsed = forecastSchema.safeParse(data);
  if (!parsed.success) return { error: "The forecast couldn't be read." };
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ key, at: Date.now(), forecast: parsed.data }),
    );
  } catch {
    // Not cached; fine.
  }
  return { forecast: parsed.data };
};
