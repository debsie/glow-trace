import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, CloudSun } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "@/components/ui/bits";
import type { ScanCategory, ScanRecord } from "@/lib/types";
import { loadPlace } from "@/lib/weather-client";
import { MIN_SCANS_EACH, scansWithWeather, weatherInsights } from "@/lib/weather-trends";

/** Weather and your skin: patterns between the day's weather and this area's own readings. */
export const WeatherTrendsCard = ({
  scans,
  area,
}: {
  scans: readonly ScanRecord[];
  area: ScanCategory;
}) => {
  const [hasTown, setHasTown] = useState(true);
  useEffect(() => setHasTown(loadPlace() !== null), []);
  const insights = weatherInsights(scans, area);
  const saved = scansWithWeather(scans, area);
  const needed = MIN_SCANS_EACH * 2;

  return (
    <SectionCard title="Weather and your skin">
      {insights.length > 0 ? (
        <ul className="space-y-3">
          {insights.map((insight) => {
            const Icon = insight.difference > 0 ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={`${insight.key}-${insight.condition}`} className="flex gap-3 text-sm">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{insight.sentence}</span>
              </li>
            );
          })}
        </ul>
      ) : !hasTown ? (
        <p className="flex gap-3 text-sm text-muted-foreground">
          <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            Pick your town for skin weather on{" "}
            <Link to="/app" className="font-semibold text-primary hover:underline">
              Home
            </Link>
            , and each scan will remember the day's weather. After a few weeks we'll show how heat,
            humidity and sun move your readings.
          </span>
        </p>
      ) : (
        <p className="flex gap-3 text-sm text-muted-foreground">
          <CloudSun className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {saved} of your scans here have the day's weather saved. With about {needed} across
            different kinds of days, we'll show any pattern that's clearly real, not chance.
          </span>
        </p>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Patterns in your own readings, not a cause. Weather from MET Norway.
      </p>
    </SectionCard>
  );
};
