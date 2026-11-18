import { useEffect, useState } from "react";

import { Badge, Gauge } from "@/components/ui/bits";
import { prefersReducedMotion } from "@/hooks/use-in-view";

import scanSkin from "@/assets/scan-skin.jpg";
import scanHair from "@/assets/scan-hair.jpg";
import scanNails from "@/assets/scan-nails.jpg";

type Reading = { label: string; value: number; caption: string };
type Sample = { id: string; label: string; image: string; score: number; readings: Reading[] };

const MORE = "Higher means more.";
const BETTER = "Higher is better.";

const SKIN: Sample = {
  id: "skin",
  label: "Skin",
  image: scanSkin,
  score: 79,
  readings: [
    { label: "Redness", value: 32.9, caption: MORE },
    { label: "Texture Coarseness", value: 37.6, caption: MORE },
    { label: "Hydration", value: 69.9, caption: BETTER },
    { label: "Discoloration", value: 5.9, caption: MORE },
  ],
};

const SAMPLES: readonly Sample[] = [
  SKIN,
  {
    id: "hair",
    label: "Hair",
    image: scanHair,
    score: 70,
    readings: [
      { label: "Shine", value: 58.4, caption: BETTER },
      { label: "Porosity", value: 41.2, caption: MORE },
      { label: "Texture Coarseness", value: 33.0, caption: MORE },
      { label: "Density Variance", value: 22.7, caption: MORE },
    ],
  },
  {
    id: "nails",
    label: "Nails",
    image: scanNails,
    score: 78,
    readings: [
      { label: "Yellowness", value: 12.5, caption: MORE },
      { label: "Ridge Texture", value: 28.1, caption: MORE },
      { label: "Spots", value: 6.3, caption: MORE },
      { label: "Hydration", value: 71.0, caption: BETTER },
    ],
  },
];

const ROTATE_MS = 4500;

/** The hero's live "instrument": a photo under a scan line, with readings that retune per area. */
export const HeroInstrument = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const sample = SAMPLES[index] ?? SKIN;

  useEffect(() => {
    if (paused || prefersReducedMotion()) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % SAMPLES.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div
      className="surface overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="relative h-44 overflow-hidden sm:h-52">
        {SAMPLES.map((item, itemIndex) => (
          <img
            key={item.id}
            src={item.image}
            alt={itemIndex === index ? `Close-up ${item.label.toLowerCase()} photo` : ""}
            aria-hidden={itemIndex === index ? undefined : true}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              itemIndex === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <span
          className="scanline absolute inset-x-0 h-px bg-primary-foreground/80"
          aria-hidden="true"
        />
        <div className="absolute top-3 left-3">
          <Badge tone="accent">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            On-device
          </Badge>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div
            className="flex rounded-full border border-border bg-secondary p-1"
            role="group"
            aria-label="Sample reading area"
          >
            {SAMPLES.map((item, itemIndex) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={itemIndex === index}
                onClick={() => {
                  setIndex(itemIndex);
                  setPaused(true);
                }}
                className={`min-h-[50px] rounded-full px-4 text-sm font-semibold transition-colors ${
                  itemIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-right">
            <span className="font-display text-3xl font-semibold text-foreground">
              {sample.score}
            </span>
            <span className="text-sm text-muted-foreground"> / 100</span>
          </p>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {sample.readings.map((reading, slot) => (
            // Keyed by slot so each bar retunes to the next value instead of remounting.
            <Gauge key={slot} {...reading} />
          ))}
        </div>
        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          Example values. Wellness indicators, not a medical measurement.
        </p>
      </div>
    </div>
  );
};
