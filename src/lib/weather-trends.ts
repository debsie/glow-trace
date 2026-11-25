import { isPreview } from "@/lib/cv/preview";
import type { ScanCategory, ScanRecord } from "./types";

/**
 * Weather and your skin: compares the person's own readings on days of one kind of weather with
 * the rest ("your redness reads 7 points higher on hot days"). Speaks only when both sides have
 * enough scans and the difference is clearly bigger than ordinary day-to-day variation.
 */

type Condition = {
  id: "hot" | "humid" | "dry" | "sunny";
  label: string;
  test: (w: NonNullable<ScanRecord["weather"]>) => boolean | null;
};

const CONDITIONS: Condition[] = [
  { id: "hot", label: "on days above 28°", test: (w) => w.temperature >= 28 },
  { id: "humid", label: "on humid days", test: (w) => w.humidity >= 70 },
  { id: "dry", label: "on dry-air days", test: (w) => w.humidity <= 35 },
  { id: "sunny", label: "on high-UV days", test: (w) => (w.uvMax === null ? null : w.uvMax >= 6) },
];

/** Scans each side needs before a comparison is shown. */
export const MIN_SCANS_EACH = 3;
/** The smallest difference worth mentioning, in indicator points. */
export const MIN_DIFFERENCE = 4;

export type WeatherInsight = {
  key: string;
  label: string;
  condition: Condition["id"];
  /** Mean on those days minus mean on the other days, one decimal. */
  difference: number;
  better: boolean;
  sentence: string;
};

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const variance = (values: number[]) => {
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / Math.max(1, values.length - 1);
};

/** The strongest weather patterns in one area's readings, most certain first (at most three). */
export const weatherInsights = (
  scans: readonly ScanRecord[],
  area: ScanCategory,
): WeatherInsight[] => {
  const own = scans.filter(
    (s) => s.category === area && !s.demo && s.weather && s.report?.metrics.length,
  );
  const keys = new Map<string, { label: string; higherIsBetter: boolean }>();
  for (const scan of own) {
    for (const metric of scan.report?.metrics ?? []) {
      if (isPreview(scan.category, metric.key)) continue;
      keys.set(metric.key, {
        label: metric.label,
        higherIsBetter: metric.higherMeans === "better",
      });
    }
  }
  const found: (WeatherInsight & { strength: number })[] = [];
  for (const [key, info] of keys) {
    for (const condition of CONDITIONS) {
      const on: number[] = [];
      const off: number[] = [];
      for (const scan of own) {
        const value = scan.report?.metrics.find((m) => m.key === key)?.value;
        const yes = scan.weather ? condition.test(scan.weather) : null;
        if (value === undefined || yes === null) continue;
        (yes ? on : off).push(value);
      }
      if (on.length < MIN_SCANS_EACH || off.length < MIN_SCANS_EACH) continue;
      const difference = mean(on) - mean(off);
      // Two standard errors apart, so it isn't one odd scan.
      const error = Math.sqrt(variance(on) / on.length + variance(off) / off.length);
      if (Math.abs(difference) < MIN_DIFFERENCE || Math.abs(difference) < 2 * error) continue;
      const better = info.higherIsBetter ? difference > 0 : difference < 0;
      const rounded = Math.round(Math.abs(difference) * 10) / 10;
      found.push({
        key,
        label: info.label,
        condition: condition.id,
        difference: Math.round(difference * 10) / 10,
        better,
        strength: Math.abs(difference) / Math.max(error, 0.1),
        sentence: `Your ${info.label.toLowerCase()} reads ${rounded} points ${difference > 0 ? "higher" : "lower"} ${condition.label}${better ? ", which is the better direction" : ""}.`,
      });
    }
  }
  return found
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 3)
    .map(({ strength: _strength, ...insight }) => insight);
};

/** How many scans in this area have the day's weather saved with them. */
export const scansWithWeather = (scans: readonly ScanRecord[], area: ScanCategory) =>
  scans.filter((s) => s.category === area && !s.demo && s.weather).length;
