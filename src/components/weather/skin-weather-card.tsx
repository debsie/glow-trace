import { MapPin, Search, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import { BUTTON_GHOST } from "@/components/ui/bits";
import type { Finding } from "@/lib/agent/agent";
import type { Forecast, Place, PlacesFile } from "@/lib/weather";
import { hourLabel, searchPlaces, skinWeather, UV_REAPPLY, uvWindow } from "@/lib/weather";
import { loadPlaces } from "@/lib/weather-client";

import { useSkinWeather } from "./use-skin-weather";

const UV_WORD = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very high": "Very high",
  extreme: "Extreme",
} as const;

// The person's flagged indicators, in the words skinWeather() understands.
const WEATHER_CONCERN: Partial<Record<Finding["concern"], string>> = {
  redness: "redness",
  tone: "pigment",
  dryness: "dryness",
  texture: "shine",
};

const placeLabel = (place: Place) =>
  [place.name, place.region && place.region !== place.name ? place.region : "", place.country]
    .filter(Boolean)
    .join(", ");

const Picker = ({ onPick }: { onPick: (place: Place) => void }) => {
  const [file, setFile] = useState<PlacesFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    void loadPlaces().then((loaded) => (loaded ? setFile(loaded) : setFailed(true)));
  }, []);
  const results = useMemo(() => (file ? searchPlaces(file, query) : []), [file, query]);
  return (
    <div className="mt-4">
      <label className="block text-sm font-semibold">
        Your town or city
        <span className="relative mt-1 block">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={file ? "e.g. Durban, or Los Angeles, California" : "Loading towns"}
            disabled={!file}
            autoComplete="off"
            className="min-h-[50px] w-full rounded-2xl border border-input bg-background pr-4 pl-11 text-base font-normal"
          />
        </span>
      </label>
      {failed && (
        <p className="mt-2 text-sm text-muted-foreground">
          The town list didn't load. Check your connection and try again.
        </p>
      )}
      {results.length > 0 && (
        <ul className="mt-2 divide-y divide-border rounded-2xl border border-border" role="listbox">
          {results.map((place) => (
            <li key={`${place.name}-${place.lat}-${place.lon}`}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                onClick={() => onPick(place)}
                className="flex min-h-[50px] w-full items-center gap-3 px-4 text-left text-sm hover:bg-secondary"
              >
                <MapPin className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {placeLabel(place)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Searched on this phone. Only the town's position goes to Glowtrace's weather service.
      </p>
    </div>
  );
};

/** The next 12 hours of clear-sky UV as bars, with the hours to reapply sunscreen named in words. */
const UvStrip = ({ forecast }: { forecast: Forecast }) => {
  const hours = forecast.hours.slice(0, 12).filter((hour) => hour.uv !== null);
  if (hours.length < 2) return null;
  const window = uvWindow(forecast);
  const top = Math.max(11, ...hours.map((hour) => hour.uv ?? 0));
  return (
    <div className="mt-5">
      <p className="text-sm font-semibold">
        {window
          ? `Reapply sunscreen outdoors ${hourLabel(window.start)} to ${hourLabel(window.end)}`
          : "UV stays low today"}
        {window && (
          <span className="font-normal text-muted-foreground">
            {" "}
            · peak <span className="readout">{window.peak.toFixed(1)}</span> at{" "}
            {hourLabel(window.peakAt)}
          </span>
        )}
      </p>
      <div className="mt-3 flex h-16 items-end gap-1" aria-hidden="true">
        {hours.map((hour, index) => (
          <div key={hour.time} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={`uv-bar w-full rounded-t-sm ${(hour.uv ?? 0) >= UV_REAPPLY ? "bg-primary" : "bg-secondary"}`}
              style={{
                height: `${Math.max(4, ((hour.uv ?? 0) / top) * 100)}%`,
                animationDelay: `${index * 40}ms`,
              }}
            />
          </div>
        ))}
      </div>
      <div
        className="mt-1 flex justify-between text-[11px] text-muted-foreground"
        aria-hidden="true"
      >
        <span>{hourLabel(hours[0]?.time ?? "")}</span>
        <span>{hourLabel(hours[hours.length - 1]?.time ?? "")}</span>
      </div>
    </div>
  );
};

/**
 * Skin weather on Home: today's clear-sky UV, humidity and temperature for the person's town, with
 * up to three tips aimed at their own flagged indicators. Hidden when the service is switched off.
 */
export const SkinWeatherCard = ({ findings }: { findings: readonly Finding[] }) => {
  const { place, ready, forecast, note, off, setPlace } = useSkinWeather();
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    if (ready && !place) setPicking(true);
  }, [ready, place]);

  const concerns = findings
    .filter((finding) => finding.severity !== "good")
    .flatMap((finding) => WEATHER_CONCERN[finding.concern] ?? []);
  const today = forecast ? skinWeather(forecast, concerns) : null;

  if (off) return null;

  return (
    <section className="surface lift relative overflow-hidden p-5" aria-labelledby="skin-weather">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="skin-weather"
            className="label-tracking text-xs font-bold text-muted-foreground uppercase"
          >
            Skin weather{place ? ` · ${place.name}` : ""}
          </h2>
          <p className="mt-2 font-display text-2xl font-semibold" aria-live="polite">
            {today ? today.headline : place ? "Today's weather" : "Where are you today?"}
          </p>
        </div>
        <LineArt motif="sun" className="art-draw art-orbit h-14 w-14 shrink-0" />
      </div>

      {today && (
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <dt className="text-xs text-muted-foreground">UV, clear sky</dt>
            <dd className="mt-1 flex items-baseline gap-1.5">
              <span className="readout text-2xl">{today.uvMax?.toFixed(1) ?? "—"}</span>
              {today.uvBand && (
                <span className="text-xs text-muted-foreground">{UV_WORD[today.uvBand]}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Humidity</dt>
            <dd className="readout mt-1 text-2xl">{today.humidity}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Now</dt>
            <dd className="readout mt-1 text-2xl">{today.temperature.toFixed(1)}°</dd>
          </div>
        </dl>
      )}

      {forecast && <UvStrip forecast={forecast} />}

      {today && today.tips.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {today.tips.map((tip) => (
            <li key={tip} className="flex gap-3">
              <Sun className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      )}

      {note && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {note}
        </p>
      )}

      {picking ? (
        <Picker
          onPick={(picked) => {
            setPlace(picked);
            setPicking(false);
          }}
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)} className={`${BUTTON_GHOST} mt-4`}>
          <MapPin className="h-4 w-4" aria-hidden="true" /> Change town
        </button>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Weather data from{" "}
        <a
          href="https://www.met.no/en"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          MET Norway
        </a>{" "}
        (
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          CC BY 4.0
        </a>
        ). UV is a clear-sky forecast. Skin tips are Glowtrace's own, based on that data, and are
        general guidance. Towns from{" "}
        <a
          href="https://www.geonames.org"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          GeoNames
        </a>
        .
      </p>
    </section>
  );
};
