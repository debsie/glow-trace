import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { scanScore } from "@/lib/beauty";
import { dailyStreak, forecastWeek, routineDone } from "@/lib/daily";
import { dayKey } from "@/lib/engagement";
import { routineModeSpec } from "@/lib/routines";
import type { ScanCategory, ScanRecord } from "@/lib/types";

import { useTicks } from "./use-ticks";

const AREA_WORD: Record<ScanCategory, string> = { skin: "Skin", hair: "Hair", nails: "Nail" };
// Overall scores move with each indicator's noise; about 3 points is one reading's spread.
const SCORE_SD = 3;

/** Home: today's streak, the daily glow check, and where the latest area is heading. */
export const TodayCard = ({ scans }: { scans: readonly ScanRecord[] }) => {
  const { ticks } = useTicks();
  const now = new Date();
  const today = dayKey(now);
  const finished = Object.keys(ticks).filter((day) =>
    (["am", "pm"] as const).some((mode) =>
      routineDone(ticks, day, mode, routineModeSpec(mode).steps.length),
    ),
  );
  const streak = dailyStreak(scans, finished, now);
  const real = scans.filter((scan) => !scan.demo && !scan.report?.quality.filtered);
  const checkedToday = real.some(
    (scan) => scan.category === "skin" && dayKey(new Date(scan.created_at)) === today,
  );
  const latest = [...real].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const forecast = latest
    ? forecastWeek(
        real
          .filter(
            (scan) =>
              scan.category === latest.category &&
              scan.report?.kernelVersion === latest.report?.kernelVersion,
          )
          .map((scan) => ({ at: scan.created_at, value: scanScore(scan) })),
        SCORE_SD,
      )
    : null;
  const skinPhotos = real.filter((scan) => scan.category === "skin").length;

  return (
    <section aria-label="Today" className="surface grid gap-5 p-5 sm:grid-cols-3">
      <div>
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Daily streak
        </p>
        <p className="mt-1 font-display text-4xl leading-none font-semibold">
          {streak}
          <span className="ml-2 text-base font-semibold text-muted-foreground">
            {streak === 1 ? "day" : "days"}
          </span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          A glow check or a finished routine keeps it going.
        </p>
      </div>
      <div>
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Glow check
        </p>
        {checkedToday ? (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <Check className="h-4 w-4 text-success" aria-hidden="true" /> Done for today
          </p>
        ) : (
          <Link
            to="/scan"
            search={{ area: "skin" }}
            className="mt-2 inline-flex min-h-[50px] items-center gap-1 text-sm font-semibold text-primary"
          >
            Take today's 10-second selfie <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          More check-ins make your trends trustworthy sooner.
        </p>
        {skinPhotos >= 3 && (
          <Link
            to="/glowlapse"
            className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"
          >
            Watch your glow-lapse <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div>
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Next week
        </p>
        {forecast && latest ? (
          <>
            <p className="mt-1 font-display text-2xl font-semibold">
              {AREA_WORD[latest.category]} score about{" "}
              <span className="readout">{forecast.inAWeek.toFixed(1)}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {forecast.direction === "steady"
                ? `Holding steady (give or take ${forecast.range.toFixed(1)}). Consistency is doing its job.`
                : forecast.direction === "up"
                  ? `Heading up, give or take ${forecast.range.toFixed(1)}, if you keep going as you are.`
                  : `Drifting down, give or take ${forecast.range.toFixed(1)}. Your routine page shows what helps.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Four check-ins over ten days and we'll show where you're heading.
          </p>
        )}
      </div>
    </section>
  );
};
