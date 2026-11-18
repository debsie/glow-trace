import { z } from "zod";

import type { BiomarkerReport } from "./cv/types";

/**
 * Calibration contributions. A tester may share the scores the app computed on their device
 * plus their own 1-5 rating of what they see. Photos never leave the device. This file builds
 * and checks the payload, and holds the statistics the admin dashboard shows.
 */

export const LIGHTING = [
  { id: "daylight_window", label: "Daylight by a window" },
  { id: "outdoor_shade", label: "Outdoors, in shade" },
  { id: "indoor_warm", label: "Indoors, warm bulb" },
  { id: "indoor_white", label: "Indoors, white or LED light" },
  { id: "flash", label: "Camera flash" },
  { id: "other", label: "Something else" },
] as const;

export type Lighting = (typeof LIGHTING)[number]["id"];

export const FITZPATRICK = [
  { id: 1, label: "I: always burns, never tans" },
  { id: 2, label: "II: burns easily, tans a little" },
  { id: 3, label: "III: sometimes burns, tans gradually" },
  { id: 4, label: "IV: rarely burns, tans easily" },
  { id: 5, label: "V: very rarely burns, tans darkly" },
  { id: 6, label: "VI: never burns, deeply pigmented" },
] as const;

/** Do not read a correlation from fewer pairs than this. */
export const MIN_SAMPLES = 30;
/** A repeat photo more than this long after the first is not a fair repeat. */
export const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

const scoreMap = z.record(z.string().min(1).max(40), z.number().min(0).max(100));
const ratingMap = z.record(z.string().min(1).max(40), z.number().int().min(1).max(5));

export const calibrationSampleSchema = z.object({
  kernel_version: z.string().min(1).max(60),
  category: z.enum(["skin", "hair", "nails"]),
  metrics: scoreMap,
  self_report: ratingMap,
  lighting: z.enum(LIGHTING.map((item) => item.id) as [Lighting, ...Lighting[]]),
  sharpness: z.number().min(0).max(100),
  cast_warning: z.boolean(),
  fitzpatrick: z.number().int().min(1).max(6).nullable(),
  repeat_of: z.string().uuid().nullable(),
});

export type CalibrationSample = z.infer<typeof calibrationSampleSchema>;

/** The question to ask for one indicator, worded so 5 always means "more of what it names". */
export const questionFor = (metric: BiomarkerReport["metrics"][number]): string =>
  metric.higherMeans === "better"
    ? `How good is the ${metric.label.toLowerCase()}? (1 poor, 5 excellent)`
    : `How much ${metric.label.toLowerCase()} do you see? (1 none, 5 a lot)`;

export type ContributionInput = {
  report: BiomarkerReport;
  selfReport: Record<string, number>;
  lighting: Lighting;
  fitzpatrick: number | null;
  repeatOf: string | null;
};

export type BuildResult = { ok: true; sample: CalibrationSample } | { ok: false; reason: string };

/** Checks everything about a contribution before it is sent. */
export const buildSample = (input: ContributionInput): BuildResult => {
  const { report } = input;
  if (!report.quality.usable || report.metrics.length === 0) {
    return { ok: false, reason: "Only scored photos can be shared." };
  }
  const missing = report.metrics.find((metric) => input.selfReport[metric.key] === undefined);
  if (missing) return { ok: false, reason: `Rate ${missing.label.toLowerCase()} first.` };
  const parsed = calibrationSampleSchema.safeParse({
    kernel_version: report.kernelVersion,
    category: report.category,
    metrics: Object.fromEntries(report.metrics.map((metric) => [metric.key, metric.value])),
    self_report: Object.fromEntries(
      report.metrics.map((metric) => [metric.key, input.selfReport[metric.key]]),
    ),
    lighting: input.lighting,
    sharpness: report.quality.sharpness,
    cast_warning: Boolean(report.quality.warning),
    fitzpatrick: input.fitzpatrick,
    repeat_of: input.repeatOf,
  });
  return parsed.success
    ? { ok: true, sample: parsed.data }
    : { ok: false, reason: "Those answers couldn't be checked. Try again." };
};

/* ---------- Statistics for the admin dashboard ---------- */

export type CalibrationRow = {
  id: string;
  category: "skin" | "hair" | "nails";
  metrics: Record<string, number>;
  self_report: Record<string, number>;
  lighting: Lighting;
  fitzpatrick: number | null;
  repeat_of: string | null;
  created_at: string;
};

/** Ranks with ties averaged, 1-based. */
const ranks = (values: readonly number[]): number[] => {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value);
  const result = new Array<number>(values.length).fill(0);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1]?.value === order[start]?.value) end += 1;
    const average = (start + end) / 2 + 1;
    for (let i = start; i <= end; i += 1) result[order[i]?.index ?? 0] = average;
    start = end + 1;
  }
  return result;
};

/** Spearman rank correlation, or null when it cannot be computed (under 3 pairs, or no spread). */
export const spearman = (xs: readonly number[], ys: readonly number[]): number | null => {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const a = ranks(xs);
  const b = ranks(ys);
  const meanA = a.reduce((sum, value) => sum + value, 0) / a.length;
  const meanB = b.reduce((sum, value) => sum + value, 0) / b.length;
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }
  if (varianceA === 0 || varianceB === 0) return null;
  return Math.round((covariance / Math.sqrt(varianceA * varianceB)) * 100) / 100;
};

export type Agreement = { key: string; n: number; rho: number | null; enough: boolean };

/**
 * How closely the app's score follows people's own ratings, per indicator. Positive means they
 * move together. Self-ratings are rough, so read this as a sanity check, not as accuracy.
 */
export const agreementByMetric = (
  rows: readonly CalibrationRow[],
  category: CalibrationRow["category"],
): Agreement[] => {
  const keys = new Set<string>();
  for (const row of rows)
    if (row.category === category) for (const key of Object.keys(row.metrics)) keys.add(key);
  return [...keys].sort().map((key) => {
    const pairs = rows
      .filter((row) => row.category === category)
      .flatMap((row) => {
        const score = row.metrics[key];
        const rating = row.self_report[key];
        return score === undefined || rating === undefined ? [] : [[score, rating] as const];
      });
    return {
      key,
      n: pairs.length,
      rho: spearman(
        pairs.map((pair) => pair[0]),
        pairs.map((pair) => pair[1]),
      ),
      enough: pairs.length >= MIN_SAMPLES,
    };
  });
};

export type Repeatability = { key: string; pairs: number; meanDifference: number; p90: number };

/** How far the same indicator moves between a photo and its repeat. Smaller is steadier. */
export const repeatability = (rows: readonly CalibrationRow[]): Repeatability[] => {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const differences = new Map<string, number[]>();
  for (const row of rows) {
    const first = row.repeat_of ? byId.get(row.repeat_of) : undefined;
    if (!first || first.category !== row.category) continue;
    for (const [key, score] of Object.entries(row.metrics)) {
      const before = first.metrics[key];
      if (before === undefined) continue;
      const list = differences.get(key) ?? [];
      list.push(Math.abs(score - before));
      differences.set(key, list);
    }
  }
  return [...differences.entries()].sort().map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a - b);
    const mean = list.reduce((sum, value) => sum + value, 0) / list.length;
    return {
      key,
      pairs: list.length,
      meanDifference: Math.round(mean * 10) / 10,
      p90: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))] ?? 0,
    };
  });
};

export type Coverage = {
  total: number;
  byCategory: Record<string, number>;
  byLighting: Record<string, number>;
  byFitzpatrick: Record<string, number>;
  pairs: number;
};

export const coverage = (rows: readonly CalibrationRow[]): Coverage => {
  const count = (pick: (row: CalibrationRow) => string): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const row of rows) result[pick(row)] = (result[pick(row)] ?? 0) + 1;
    return result;
  };
  return {
    total: rows.length,
    byCategory: count((row) => row.category),
    byLighting: count((row) => row.lighting),
    byFitzpatrick: count((row) => (row.fitzpatrick ? `Type ${row.fitzpatrick}` : "Not given")),
    pairs: rows.filter((row) => row.repeat_of !== null).length,
  };
};
