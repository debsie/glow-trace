import { isPreview } from "@/lib/cv/preview";
import { gaugesFor, scanScore } from "./beauty";
import type { ScanRecord, ScanCategory } from "./types";

/** Pure progress maths: score series over time and before/after comparisons. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * "25 Oct". Fixed format in UTC, so the server and every browser render the same text
 * (locale formatters differ between Node and browsers and break hydration).
 */
export const shortDate = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`;
};

/** "25 October 2026", same rules as shortDate. */
export const longDate = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()] ?? ""} ${date.getUTCFullYear()}`;
};

export type ProgressPoint = { id: string; date: string; score: number };

/** Scored scans for one area, oldest first. Unscored ("demo") scans are left out. */
export const seriesFor = (scans: readonly ScanRecord[], category: ScanCategory): ProgressPoint[] =>
  scans
    .filter((scan) => scan.category === category && !scan.demo)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((scan) => ({ id: scan.id, date: scan.created_at, score: scanScore(scan) }));

/** Change in overall score from the first to the latest point; null with fewer than two. */
export const scoreChange = (series: readonly ProgressPoint[]): number | null => {
  const first = series[0];
  const last = series[series.length - 1];
  return first && last && series.length > 1 ? last.score - first.score : null;
};

export type Verdict = "better" | "worse" | "same";

export type MetricChange = {
  key: string;
  label: string;
  before: number;
  after: number;
  /** after − before, one decimal. */
  delta: number;
  verdict: Verdict;
};

/** Changes smaller than this are measurement noise, not progress. */
export const NOISE = 2;

const LEGACY_KEYS: Partial<Record<ScanCategory, Partial<Record<string, string>>>> = {
  skin: { redness: "erythema", dryness: "hydration" },
};

type Reading = { key: string; label: string; value: number; higherIsBetter: boolean };

const readings = (scan: ScanRecord): Reading[] =>
  scan.report && !scan.demo && scan.report.metrics.length > 0
    ? scan.report.metrics
        // Preview readings (cv/preview.ts) are shown on results but not tracked as change.
        .filter((metric) => !isPreview(scan.category, metric.key))
        .map((metric) => ({
          key: metric.key,
          label: metric.label,
          value: metric.value,
          higherIsBetter: metric.higherMeans === "better",
        }))
    : gaugesFor(scan.category, scan.biomarkers).map((gauge) => ({
        // Older scans use care-dimension keys; align them with the analysis report's keys.
        key: LEGACY_KEYS[scan.category]?.[gauge.key] ?? gauge.key,
        label: gauge.label,
        value: gauge.value,
        higherIsBetter: gauge.caption.startsWith("Higher is better"),
      }));

/** Indicator-by-indicator change between two scans of the same area. */
export const compareScans = (before: ScanRecord, after: ScanRecord): MetricChange[] => {
  const earlier = new Map(readings(before).map((reading) => [reading.key, reading]));
  return readings(after).flatMap((reading) => {
    const previous = earlier.get(reading.key);
    if (!previous) return [];
    const delta = Math.round((reading.value - previous.value) * 10) / 10;
    const improved = reading.higherIsBetter ? delta > 0 : delta < 0;
    return [
      {
        key: reading.key,
        label: reading.label,
        before: previous.value,
        after: reading.value,
        delta,
        verdict: Math.abs(delta) < NOISE ? "same" : improved ? "better" : "worse",
      },
    ];
  });
};

export type IndicatorSeries = {
  key: string;
  label: string;
  higherIsBetter: boolean;
  points: { id: string; date: string; value: number }[];
  /** Latest minus first, one decimal; null with fewer than two readings. */
  change: number | null;
  verdict: Verdict | null;
};

/** Every indicator's readings over time for one area, oldest first, in the latest scan's order. */
export const indicatorSeries = (
  scans: readonly ScanRecord[],
  category: ScanCategory,
): IndicatorSeries[] => {
  const own = scans
    .filter((scan) => scan.category === category && !scan.demo)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byKey = new Map<string, IndicatorSeries>();
  for (const scan of own) {
    for (const reading of readings(scan)) {
      const entry = byKey.get(reading.key) ?? {
        key: reading.key,
        label: reading.label,
        higherIsBetter: reading.higherIsBetter,
        points: [],
        change: null,
        verdict: null,
      };
      entry.label = reading.label;
      entry.points.push({ id: scan.id, date: scan.created_at, value: reading.value });
      byKey.set(reading.key, entry);
    }
  }
  const latest = own[own.length - 1];
  const order = latest ? readings(latest).map((reading) => reading.key) : [];
  return [...byKey.values()]
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
    .map((entry) => {
      const first = entry.points[0];
      const last = entry.points[entry.points.length - 1];
      if (!first || !last || entry.points.length < 2) return entry;
      const change = Math.round((last.value - first.value) * 10) / 10;
      const improved = entry.higherIsBetter ? change > 0 : change < 0;
      return {
        ...entry,
        change,
        verdict: Math.abs(change) < NOISE ? "same" : improved ? "better" : "worse",
      };
    });
};

export type ZoneKey = "forehead" | "leftCheek" | "rightCheek" | "chin";
export type ZoneChange = {
  zone: ZoneKey;
  before: number | null;
  after: number;
  delta: number | null;
};

/**
 * Redness by face zone for the face map: the latest zoned skin scan against the earliest one.
 * Higher means more redness. Null when no skin scan has zones yet.
 */
export const zoneChanges = (scans: readonly ScanRecord[]): ZoneChange[] | null => {
  const zoned = scans
    .filter((scan) => scan.category === "skin" && !scan.demo && scan.report?.zones)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const last = zoned[zoned.length - 1]?.report?.zones;
  if (!last) return null;
  const first = zoned.length > 1 ? zoned[0]?.report?.zones : undefined;
  return (["forehead", "leftCheek", "rightCheek", "chin"] as const).map((zone) => {
    const before = first ? first[zone] : null;
    return {
      zone,
      before,
      after: last[zone],
      delta: before === null ? null : Math.round((last[zone] - before) * 10) / 10,
    };
  });
};
