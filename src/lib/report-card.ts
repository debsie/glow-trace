import { scanScore } from "./beauty";
import type { MetricChange } from "./progress";
import { compareScans } from "./progress";
import type { ScanCategory, ScanRecord } from "./types";

/** Monthly report card: pure maths over the person's own scans, one month at a time. */

export type MonthKey = `${number}-${string}`;

export type AreaReport = {
  area: ScanCategory;
  scans: number;
  /** Score going into the month (last scan before it, else the month's first scan). */
  start: number | null;
  end: number | null;
  /** end − start, one decimal; null without two scored scans to compare. */
  change: number | null;
  best: MetricChange | null;
  watch: MetricChange | null;
};

export type MonthReport = {
  month: MonthKey;
  totalScans: number;
  activeDays: number;
  areas: AreaReport[];
  /** Overall grade from the areas' changes: "rising", "holding", "dipping" or "getting started". */
  grade: "rising" | "holding" | "dipping" | "getting started";
};

const AREAS: ScanCategory[] = ["skin", "hair", "nails"];

export const monthOf = (iso: string): MonthKey => iso.slice(0, 7) as MonthKey;

/** Months with at least one real scan, newest first. */
export const reportMonths = (scans: readonly ScanRecord[]): MonthKey[] =>
  [...new Set(scans.filter((scan) => !scan.demo).map((scan) => monthOf(scan.created_at)))]
    .sort()
    .reverse();

/** "2026-11" to the ISO date of the month's 1st, for longDate-style formatting. */
export const monthStart = (month: MonthKey) => `${month}-01T12:00:00Z`;

const round1 = (value: number) => Math.round(value * 10) / 10;

export const areaReport = (
  scans: readonly ScanRecord[],
  area: ScanCategory,
  month: MonthKey,
): AreaReport => {
  const own = scans
    .filter((scan) => scan.category === area && !scan.demo)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const inMonth = own.filter((scan) => monthOf(scan.created_at) === month);
  const before = own.filter((scan) => monthOf(scan.created_at) < month);
  const first = before[before.length - 1] ?? inMonth[0];
  const last = inMonth[inMonth.length - 1];
  const empty = { area, scans: inMonth.length, best: null, watch: null };
  if (!first || !last) return { ...empty, start: null, end: null, change: null };
  const start = scanScore(first);
  const end = scanScore(last);
  if (first.id === last.id) return { ...empty, start, end, change: null };
  const changes = compareScans(first, last);
  const better = changes.filter((c) => c.verdict === "better");
  const worse = changes.filter((c) => c.verdict === "worse");
  const biggest = (list: MetricChange[]) =>
    list.reduce<MetricChange | null>(
      (top, c) => (!top || Math.abs(c.delta) > Math.abs(top.delta) ? c : top),
      null,
    );
  return {
    ...empty,
    start,
    end,
    change: round1(end - start),
    best: biggest(better),
    watch: biggest(worse),
  };
};

/** Change of this size or more in an area's score counts towards the grade. */
export const GRADE_STEP = 2;

export const monthReport = (scans: readonly ScanRecord[], month: MonthKey): MonthReport => {
  const real = scans.filter((scan) => !scan.demo && monthOf(scan.created_at) === month);
  const areas = AREAS.map((area) => areaReport(scans, area, month)).filter((a) => a.scans > 0);
  const changes = areas.flatMap((a) => (a.change === null ? [] : [a.change]));
  const up = changes.filter((c) => c >= GRADE_STEP).length;
  const down = changes.filter((c) => c <= -GRADE_STEP).length;
  const grade =
    changes.length === 0
      ? "getting started"
      : up > down
        ? "rising"
        : down > up
          ? "dipping"
          : "holding";
  return {
    month,
    totalScans: real.length,
    activeDays: new Set(real.map((scan) => scan.created_at.slice(0, 10))).size,
    areas,
    grade,
  };
};
