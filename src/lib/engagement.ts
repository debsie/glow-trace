import { z } from "zod";

import type { ScanCategory, ScanRecord } from "./types";

/**
 * Keeping people coming back without nagging: before-and-after check-ins around events they
 * choose, a weekly scan streak and milestones. Pure, so it is tested; all of
 * it stays on the device.
 */

/* ---------- Dates (local calendar days, never UTC slices: a scan at 23:30 is that day) ---------- */

export const dayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const fromKey = (key: string): Date => {
  const [y = 1970, m = 1, d = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, days: number): string => {
  const date = fromKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
};

const scanDay = (scan: ScanRecord) => dayKey(new Date(scan.created_at));
const real = (scans: readonly ScanRecord[]) => scans.filter((scan) => !scan.demo);

/* ---------- Before-and-after check-ins ---------- */

export const EVENT_KINDS = {
  makeup: { label: "Makeup day", area: "skin" },
  product: { label: "New product", area: "skin" },
  facial: { label: "Facial or peel", area: "skin" },
  "braids-out": { label: "Braids or wig out", area: "hair" },
  treatment: { label: "Relaxer, colour or heat", area: "hair" },
  manicure: { label: "Gel, acrylics or manicure", area: "nails" },
} as const satisfies Record<string, { label: string; area: ScanCategory }>;

export type EventKind = keyof typeof EVENT_KINDS;

export const checkinEventSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(Object.keys(EVENT_KINDS) as [EventKind, ...EventKind[]]),
  /** The event's own day, YYYY-MM-DD. */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(80).default(""),
});
export type CheckinEvent = z.infer<typeof checkinEventSchema>;

export const EVENTS_KEY = "glowtrace:checkin-events:v1";

export const loadEvents = (raw: string | null): CheckinEvent[] => {
  if (!raw) return [];
  try {
    const parsed = z.array(checkinEventSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export type CheckinStep = {
  event: CheckinEvent;
  moment: "before" | "after";
  /** The day this check-in belongs to. */
  day: string;
  area: ScanCategory;
  done: boolean;
};

/** The day-before and day-after scans for an event, and whether each was taken. */
export const stepsFor = (event: CheckinEvent, scans: readonly ScanRecord[]): CheckinStep[] => {
  const area = EVENT_KINDS[event.kind].area;
  const taken = new Set(
    real(scans)
      .filter((scan) => scan.category === area)
      .map(scanDay),
  );
  return (["before", "after"] as const).map((moment) => {
    const day = addDays(event.day, moment === "before" ? -1 : 1);
    return { event, moment, day, area, done: taken.has(day) };
  });
};

/** Check-ins due today and not yet taken, soonest event first. */
export const dueToday = (
  events: readonly CheckinEvent[],
  scans: readonly ScanRecord[],
  today: string,
): CheckinStep[] =>
  events
    .flatMap((event) => stepsFor(event, scans))
    .filter((step) => step.day === today && !step.done)
    .sort((a, b) => a.event.day.localeCompare(b.event.day));

/** The before and after scans of a finished event, for the comparison; null until both exist. */
export const pairFor = (
  event: CheckinEvent,
  scans: readonly ScanRecord[],
): { before: ScanRecord; after: ScanRecord } | null => {
  const area = EVENT_KINDS[event.kind].area;
  const onDay = (day: string, latest: boolean) =>
    real(scans)
      .filter((scan) => scan.category === area && scanDay(scan) === day)
      .sort((a, b) => (latest ? b : a).created_at.localeCompare((latest ? a : b).created_at))[0];
  const before = onDay(addDays(event.day, -1), true);
  const after = onDay(addDays(event.day, 1), false);
  return before && after ? { before, after } : null;
};

/* ---------- Weekly streak ---------- */

/** Monday of the local week containing `date`, as YYYY-MM-DD. */
export const weekOf = (date: Date): string => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return dayKey(monday);
};

/**
 * Consecutive weeks with at least one real scan, counting back from this week. This week still
 * counts as "in progress" when it has no scan yet, so the streak does not break on a Monday.
 */
export const weeklyStreak = (scans: readonly ScanRecord[], now: Date): number => {
  const weeks = new Set(real(scans).map((scan) => weekOf(new Date(scan.created_at))));
  let week = weekOf(now);
  if (!weeks.has(week)) week = addDays(week, -7);
  let streak = 0;
  while (weeks.has(week)) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
};

/* ---------- Milestones ---------- */

export type Milestone = { id: string; title: string; detail: string; reached: boolean };

export const milestones = (
  scans: readonly ScanRecord[],
  events: readonly CheckinEvent[],
  now: Date,
): Milestone[] => {
  const mine = real(scans);
  const areas = new Set(mine.map((scan) => scan.category));
  const streak = weeklyStreak(scans, now);
  const pairs = events.filter((event) => pairFor(event, scans)).length;
  return [
    { id: "first", title: "First look", detail: "Your first scan", reached: mine.length > 0 },
    {
      id: "all-three",
      title: "Head to fingertips",
      detail: "Scanned skin, hair and nails",
      reached: areas.size === 3,
    },
    {
      id: "streak-4",
      title: "Four weeks steady",
      detail: "A scan every week for 4 weeks",
      reached: streak >= 4,
    },
    {
      id: "before-after",
      title: "Before and after",
      detail: "Finished a day-before and day-after check-in",
      reached: pairs > 0,
    },
    {
      id: "streak-12",
      title: "Three months strong",
      detail: "A scan every week for 12 weeks",
      reached: streak >= 12,
    },
  ];
};
