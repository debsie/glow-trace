import { z } from "zod";

import { addDays, dayKey } from "./engagement";
import type { ScanRecord } from "./types";

/**
 * Daily habits: routine tick-offs, a daily streak (any day with a scan or a finished routine)
 * and a gentle forecast of where an indicator is heading. Pure, so it is tested; stays on the
 * device.
 */

/* ---------- Routine tick-offs ---------- */

export const TICKS_KEY = "glowtrace:routine-ticks:v1";

/** { "2026-11-19": { am: [0, 1, 2], pm: [0] } }: the step numbers ticked per routine, per day. */
const ticksSchema = z.record(
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.record(z.string().max(16), z.array(z.number().int().min(0).max(30)).max(30)),
);
export type Ticks = z.infer<typeof ticksSchema>;

export const loadTicks = (raw: string | null): Ticks => {
  if (!raw) return {};
  try {
    const parsed = ticksSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

/** Toggles one step and keeps only the last 90 days. */
export const toggleTick = (ticks: Ticks, day: string, mode: string, step: number): Ticks => {
  const today = new Set(ticks[day]?.[mode] ?? []);
  if (today.has(step)) today.delete(step);
  else today.add(step);
  const next: Ticks = {
    ...ticks,
    [day]: { ...ticks[day], [mode]: [...today].sort((a, b) => a - b) },
  };
  const keep = Object.keys(next).sort().slice(-90);
  return Object.fromEntries(keep.map((key) => [key, next[key] ?? {}]));
};

export const routineDone = (ticks: Ticks, day: string, mode: string, stepCount: number): boolean =>
  stepCount > 0 && (ticks[day]?.[mode]?.length ?? 0) >= stepCount;

/* ---------- Daily streak ---------- */

/**
 * Days in a row with a real scan or a finished routine (`finishedDays`), counting back from today.
 * Today still counts as "in progress", so the streak does not break before the evening routine.
 */
export const dailyStreak = (
  scans: readonly ScanRecord[],
  finishedDays: readonly string[],
  now: Date,
): number => {
  const active = new Set([
    ...finishedDays,
    ...scans.filter((scan) => !scan.demo).map((scan) => dayKey(new Date(scan.created_at))),
  ]);
  let day = dayKey(now);
  if (!active.has(day)) day = addDays(day, -1);
  let streak = 0;
  while (active.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
};

/* ---------- Forecast ---------- */

export type Forecast = {
  /** Expected health a week from the latest reading, 0-100. */
  inAWeek: number;
  /** Half-width of the likely range, in points. */
  range: number;
  direction: "up" | "down" | "steady";
};

const DAY_MS = 86_400_000;

/**
 * Where an indicator is heading if nothing changes: a straight line through the last 30 days of
 * readings (at least 4, spread over 10+ days), projected one week on. "steady" unless the
 * projected move is larger than the likely range. Honest about uncertainty, never a promise.
 */
export const forecastWeek = (
  readings: readonly { at: string; value: number }[],
  readingSd: number,
): Forecast | null => {
  const sorted = [...readings].sort((a, b) => a.at.localeCompare(b.at));
  const last = sorted.at(-1);
  if (!last) return null;
  const end = Date.parse(last.at);
  const recent = sorted.filter((r) => end - Date.parse(r.at) <= 30 * DAY_MS);
  const first = recent[0];
  if (recent.length < 4 || !first || end - Date.parse(first.at) < 10 * DAY_MS) return null;
  const xs = recent.map((r) => (Date.parse(r.at) - end) / DAY_MS);
  const ys = recent.map((r) => r.value);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const sxx = xs.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const slope = xs.reduce((sum, x, i) => sum + (x - mx) * ((ys[i] ?? 0) - my), 0) / (sxx || 1);
  const intercept = my - slope * mx;
  const residualSd = Math.sqrt(
    ys.reduce((sum, y, i) => sum + (y - (intercept + slope * (xs[i] ?? 0))) ** 2, 0) /
      Math.max(1, ys.length - 2),
  );
  const now = intercept;
  const inAWeek = Math.min(100, Math.max(0, now + slope * 7));
  // Uncertainty of the slope times seven days, plus the noise of one reading.
  const slopeSd = Math.max(residualSd, readingSd) / Math.sqrt(sxx || 1);
  const range = Math.round(2 * Math.hypot(slopeSd * 7, readingSd) * 10) / 10;
  const move = inAWeek - now;
  return {
    inAWeek: Math.round(inAWeek * 10) / 10,
    range,
    direction: Math.abs(move) <= range ? "steady" : move > 0 ? "up" : "down",
  };
};
