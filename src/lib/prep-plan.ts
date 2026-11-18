import type { Finding } from "./agent/agent";

/**
 * A 7-day skin-prep plan counting down to an event. Fixed, cautious rules: pause strong actives
 * early, add nothing new, calm and hydrate, protect. General cosmetic guidance, not treatment.
 */

export type PrepDay = { daysBefore: number; title: string; steps: string[] };

const DAY_MS = 86_400_000;

/** Whole days from `today` to `event` (UTC dates). Negative when the event has passed. */
export const daysUntil = (eventIso: string, todayIso: string): number =>
  Math.round((Date.parse(eventIso.slice(0, 10)) - Date.parse(todayIso.slice(0, 10))) / DAY_MS);

const BASE: Record<number, PrepDay> = {
  7: {
    daysBefore: 7,
    title: "Lock in the routine",
    steps: [
      "Stop trying new products from today. Only use what your skin already knows.",
      "Book any facial, wax or peel for now or never. Nothing new after this point.",
      "Start daily sunscreen if you are not already, and drink water through the day.",
    ],
  },
  6: {
    daysBefore: 6,
    title: "Gentle and steady",
    steps: ["Cleanse gently, moisturise morning and night.", "No scrubs and no new actives."],
  },
  5: {
    daysBefore: 5,
    title: "Pause retinoids",
    steps: [
      "Last retinoid night was yesterday. Skip them from tonight until after the event.",
      "Swap in a plain moisturiser or hydrating serum instead.",
    ],
  },
  4: {
    daysBefore: 4,
    title: "Hydration day",
    steps: ["Add a hydrating serum or mask, 10 minutes, once today.", "Keep sunscreen on."],
  },
  3: {
    daysBefore: 3,
    title: "Pause acids",
    steps: [
      "Last AHA or BHA use was yesterday. Skip them until after the event.",
      "Cleanse, moisturise, sunscreen. Nothing else.",
    ],
  },
  2: {
    daysBefore: 2,
    title: "Rest the skin",
    steps: [
      "Keep it to cleanser, moisturiser and sunscreen.",
      "Sleep early and avoid touching your face.",
    ],
  },
  1: {
    daysBefore: 1,
    title: "The day before",
    steps: [
      "Cleanse and moisturise as usual, with a hydrating mask if your skin feels tight.",
      "No exfoliating, no squeezing, no new products.",
      "Sleep on a clean pillowcase.",
    ],
  },
  0: {
    daysBefore: 0,
    title: "Event day",
    steps: [
      "Cleanse gently, moisturise, then sunscreen.",
      "Leave 10 minutes before makeup so products settle.",
      "Do not try anything new today.",
    ],
  },
};

const extras = (findings: readonly Finding[]): Partial<Record<number, string>> => {
  const extra: Partial<Record<number, string>> = {};
  const focus = new Set(
    findings.filter((finding) => finding.severity !== "good").map((finding) => finding.concern),
  );
  if (focus.has("redness"))
    extra[2] = "The latest scan reads red: use a calming serum and lukewarm water only.";
  if (focus.has("dryness"))
    extra[4] = "The latest scan reads dry: repeat the hydrating mask on day 2.";
  if (focus.has("texture"))
    extra[3] = "Texture reads uneven: skip scrubs entirely. Makeup prep can smooth it on the day.";
  return extra;
};

/** The plan from `today` onward. Days already past are dropped; a short runway says so. */
export const prepPlan = (
  eventIso: string,
  todayIso: string,
  findings: readonly Finding[] = [],
): { days: PrepDay[]; shortRunway: boolean; daysAway: number } => {
  const daysAway = daysUntil(eventIso, todayIso);
  const extra = extras(findings);
  const days: PrepDay[] = [];
  for (let n = Math.min(7, Math.max(daysAway, 0)); n >= 0; n -= 1) {
    const base = BASE[n];
    if (!base) continue;
    const note = extra[n];
    days.push({ ...base, steps: note ? [...base.steps, note] : base.steps });
  }
  return { days, shortRunway: daysAway >= 0 && daysAway < 7, daysAway };
};
