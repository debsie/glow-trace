import { CloudSun } from "lucide-react";

import { skinWeather, weatherSteps } from "@/lib/weather";

import { useSkinWeather } from "./use-skin-weather";

/**
 * Today's weather adjustments at the top of the morning or evening routine. Shows nothing until
 * the person has picked a town on Home and a forecast is in.
 */
export const WeatherSteps = ({ when }: { when: "am" | "pm" }) => {
  const { place, forecast } = useSkinWeather();
  if (!place || !forecast) return null;
  const steps = weatherSteps(skinWeather(forecast)).filter((step) => step.when === when);
  if (steps.length === 0) return null;
  return (
    <section
      className="surface page-enter p-5"
      aria-label={`Today's weather in ${place.name}: routine changes`}
    >
      <p className="flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-muted-foreground uppercase">
        <CloudSun className="h-4 w-4 text-primary" aria-hidden="true" />
        For today's weather in {place.name}
      </p>
      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.step} className="text-sm">
            <span className="font-semibold">{step.step}</span>
            <span className="text-muted-foreground"> · {step.why}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
