import { gaugesFor, scanScore } from "./beauty";
import type { DiagnosticScan, ScanCategory } from "./types";

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
export const seriesFor = (
  scans: readonly DiagnosticScan[],
  category: ScanCategory,
): ProgressPoint[] =>
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

const readings = (scan: DiagnosticScan): Reading[] =>
  scan.report && !scan.demo && scan.report.metrics.length > 0
    ? scan.report.metrics.map((metric) => ({
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
export const compareScans = (before: DiagnosticScan, after: DiagnosticScan): MetricChange[] => {
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
