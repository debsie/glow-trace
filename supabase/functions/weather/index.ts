// Glowtrace skin weather: the next hours of temperature, humidity and clear-sky UV for one town,
// from MET Norway's Locationforecast 2.0 (https://api.met.no, data CC BY 4.0, "Data from MET
// Norway"). Their terms (accepted by the Glowtrace owner) ask apps to call through their own
// server, identify themselves, cache, honour Expires and send at most 4 decimals of coordinates.
// The person's phone never talks to MET Norway; MET only sees a town's coordinates and this server.
// Secret MET_CONTACT (an email or website MET can reach us at) must be set; without it this
// function answers `off` and the app hides the weather card.
import { z } from "npm:zod@4";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const body = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const metDetails = z.object({
  air_temperature: z.number(),
  relative_humidity: z.number(),
  ultraviolet_index_clear_sky: z.number().optional(),
});
const metResponse = z.object({
  properties: z.object({
    meta: z.object({ updated_at: z.string() }),
    timeseries: z
      .array(
        z.object({
          time: z.string(),
          data: z.object({ instant: z.object({ details: metDetails }) }),
        }),
      )
      .min(1),
  }),
});

type Cached = { expires: number; lastModified: string | null; payload: unknown };
const cache = new Map<string, Cached>();

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});
const json = (status: number, data: unknown, origin: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("Origin") ?? "";
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]!;
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "POST only" }, origin);

  const contact = Deno.env.get("MET_CONTACT");
  if (!contact)
    return json(503, { error: "Skin weather isn't switched on yet.", off: true }, origin);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "That place couldn't be read." }, origin);
  // Two decimals (about 1 km) is all a town needs, and well inside MET's 4-decimal limit; it also
  // lets nearby requests share one cached forecast.
  const lat = Math.round(parsed.data.lat * 100) / 100;
  const lon = Math.round(parsed.data.lon * 100) / 100;
  const key = `${lat},${lon}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return json(200, cached.payload, origin);

  try {
    const response = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`,
      {
        headers: {
          "User-Agent": `Glowtrace/1.0 ${contact}`,
          "Accept-Encoding": "gzip, deflate",
          ...(cached?.lastModified ? { "If-Modified-Since": cached.lastModified } : {}),
        },
      },
    );
    const expiresHeader = response.headers.get("Expires");
    // Never ask again before MET's Expires time; at least 30 minutes either way.
    const expires = Math.max(
      Date.now() + 30 * 60 * 1000,
      expiresHeader ? Date.parse(expiresHeader) || 0 : 0,
    );
    if (response.status === 304 && cached) {
      cache.set(key, { ...cached, expires });
      return json(200, cached.payload, origin);
    }
    if (!response.ok) {
      if (cached) return json(200, cached.payload, origin);
      return json(502, { error: "The weather service didn't answer. Try again later." }, origin);
    }
    const met = metResponse.safeParse(await response.json());
    if (!met.success) return json(502, { error: "The forecast couldn't be read." }, origin);
    const now = Date.now() - 60 * 60 * 1000;
    const hours = met.data.properties.timeseries
      .filter((step) => Date.parse(step.time) >= now)
      .slice(0, 24)
      .map((step) => {
        const d = step.data.instant.details;
        return {
          time: step.time,
          temperature: d.air_temperature,
          humidity: Math.max(0, Math.min(100, d.relative_humidity)),
          uv: d.ultraviolet_index_clear_sky ?? null,
        };
      });
    if (hours.length === 0) return json(502, { error: "The forecast had no hours ahead." }, origin);
    const payload = { updatedAt: met.data.properties.meta.updated_at, hours };
    cache.set(key, { expires, lastModified: response.headers.get("Last-Modified"), payload });
    if (cache.size > 2000) cache.delete(cache.keys().next().value!);
    return json(200, payload, origin);
  } catch {
    if (cached) return json(200, cached.payload, origin);
    return json(502, { error: "The weather service didn't answer. Try again later." }, origin);
  }
});
