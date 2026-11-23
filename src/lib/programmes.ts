import { z } from "zod";

import { addDays, dayKey } from "./engagement";
import type { ScanCategory, ScanRecord } from "./types";

/**
 * Goal programmes: four-week plans with three small steps a week and a weekly check-in scan.
 * Enrolment and ticks stay on the device. Pure, so it is tested.
 */

export type ProgrammeWeek = { title: string; steps: readonly string[] };

export type Programme = {
  id: string;
  title: string;
  promise: string;
  area: ScanCategory;
  /** Indicator key in the analysis report used for the before and after. */
  metric: string;
  metricLabel: string;
  /** True when a lower reading is healthier (e.g. redness). */
  lowerIsBetter: boolean;
  motif: "face" | "spots" | "strands" | "nail" | "drop";
  guides: readonly string[];
  weeks: readonly ProgrammeWeek[];
};

export const PROGRAMMES: readonly Programme[] = [
  {
    id: "calm-redness",
    title: "Calm my redness",
    promise: "Four weeks of gentle, steady care so your skin can settle.",
    area: "skin",
    metric: "erythema",
    metricLabel: "Redness",
    lowerIsBetter: true,
    motif: "face",
    guides: ["nose-redness", "sunscreen", "niacinamide"],
    weeks: [
      {
        title: "Strip it back",
        steps: [
          "Swap to a gentle, fragrance-free cleanser",
          "Rinse with lukewarm water, never hot",
          "Pause scrubs and strong acids",
        ],
      },
      {
        title: "Protect",
        steps: [
          "Sunscreen every morning, even indoors by a window",
          "Moisturise on damp skin, morning and night",
          "Notice what makes you flush: heat, spice, sun",
        ],
      },
      {
        title: "Soothe",
        steps: [
          "Add niacinamide in the evening",
          "Keep showers short and warm",
          "Sleep on a clean pillowcase twice a week",
        ],
      },
      {
        title: "Keep what works",
        steps: [
          "Keep the routine that calmed you",
          "Reintroduce one active, slowly",
          "Take your final check-in in the same light",
        ],
      },
    ],
  },
  {
    id: "fade-marks",
    title: "Fade my dark marks",
    promise: "Protect, brighten and be patient: marks fade when they stop being re-darkened.",
    area: "skin",
    metric: "discoloration",
    metricLabel: "Even tone",
    lowerIsBetter: true,
    motif: "spots",
    guides: ["pigmentation", "sunscreen", "vitamin-c"],
    weeks: [
      {
        title: "Sunscreen first",
        steps: [
          "SPF 30+ every morning, two finger-lengths",
          "Top up at lunch on sunny days",
          "Hands off spots: picking leaves marks",
        ],
      },
      {
        title: "Brighten gently",
        steps: [
          "Add vitamin C in the morning, under sunscreen",
          "Moisturise every night",
          "Keep your scan light the same each week",
        ],
      },
      {
        title: "Even it out",
        steps: [
          "Add azelaic acid or niacinamide at night",
          "Hat or shade at midday",
          "Check your shelf for clashes",
        ],
      },
      {
        title: "Hold the line",
        steps: [
          "Keep sunscreen daily, it's the whole game",
          "Stay patient: fading takes weeks",
          "Take your final check-in",
        ],
      },
    ],
  },
  {
    id: "keep-length",
    title: "Keep my length",
    promise: "Grow it and keep it: protect your ends so breakage stops eating your progress.",
    area: "hair",
    metric: "porosity",
    metricLabel: "Hair texture",
    lowerIsBetter: true,
    motif: "strands",
    guides: ["hair-length", "hair-dry", "protective-styles"],
    weeks: [
      {
        title: "Moisture and seal",
        steps: [
          "Leave-in, then seal with an oil or butter",
          "Sleep on satin or silk",
          "Take a length photo, stretched or natural",
        ],
      },
      {
        title: "Gentle hands",
        steps: [
          "Detangle from the ends up, with conditioner in",
          "One low-heat week: no flat iron",
          "Trim only split ends",
        ],
      },
      {
        title: "Strength",
        steps: [
          "One protein treatment this week",
          "Loosen any tight styles at the edges",
          "Rinse conditioner out with cool water",
        ],
      },
      {
        title: "Protect the ends",
        steps: [
          "Low-manipulation style for a few days",
          "Moisturise the ends every other day",
          "Final length photo in the same state",
        ],
      },
    ],
  },
  {
    id: "stronger-nails",
    title: "Stronger nails",
    promise: "Bare, oiled and protected: give your nails a month to grow out healthier.",
    area: "nails",
    metric: "ridges",
    metricLabel: "Ridges",
    lowerIsBetter: true,
    motif: "nail",
    guides: ["nail-ridges", "cuticles", "gel-acrylic"],
    weeks: [
      {
        title: "Go bare",
        steps: [
          "Remove polish gently, no picking or prying",
          "Cuticle oil every evening",
          "File in one direction only",
        ],
      },
      {
        title: "Protect",
        steps: [
          "Gloves for washing up and cleaning",
          "Hand cream after every wash",
          "Base coat if you paint them",
        ],
      },
      {
        title: "Nourish",
        steps: [
          "Massage oil into nails and cuticles nightly",
          "Keep nails short while they strengthen",
          "Push cuticles back after a shower, never cut",
        ],
      },
      {
        title: "Keep the habit",
        steps: [
          "Keep the oil by your bed",
          "Plan polish breaks between manicures",
          "Final check-in with bare nails",
        ],
      },
    ],
  },
  {
    id: "glow-reset",
    title: "Hydration reset",
    promise: "Plump, comfortable skin in a month: rebuild the barrier and stop the ashy look.",
    area: "skin",
    metric: "hydration",
    metricLabel: "Hydration",
    lowerIsBetter: false,
    motif: "drop",
    guides: ["ashy", "skin-type", "water-diet"],
    weeks: [
      {
        title: "Damp skin rule",
        steps: [
          "Moisturise within a minute of washing",
          "Short, lukewarm showers",
          "A glass of water with every meal",
        ],
      },
      {
        title: "Seal it in",
        steps: [
          "Add a richer night cream or a few drops of oil",
          "Body lotion straight after showering",
          "Swap foaming cleansers for a cream cleanser",
        ],
      },
      {
        title: "Smooth",
        steps: [
          "Gentle exfoliation once this week",
          "Lip balm before bed",
          "Humid air if you can: a bowl of water by the heater",
        ],
      },
      {
        title: "Keep it",
        steps: [
          "Keep the damp skin rule",
          "Sunscreen still every morning",
          "Final check-in in the same light",
        ],
      },
    ],
  },
];

export const programmeById = (id: string): Programme | null =>
  PROGRAMMES.find((programme) => programme.id === id) ?? null;

/* ---------- Enrolment, on the device ---------- */

export const PROGRAMMES_KEY = "glowtrace:programmes:v1";

const enrolmentSchema = z.object({
  id: z.string().min(1).max(40),
  startDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** "w-s": week index and step index ticked. */
  ticks: z
    .array(z.string().regex(/^\d-\d$/))
    .max(40)
    .default([]),
});
export type Enrolment = z.infer<typeof enrolmentSchema>;

export const loadEnrolments = (raw: string | null): Enrolment[] => {
  if (!raw) return [];
  try {
    const parsed = z.array(enrolmentSchema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.filter((e) => programmeById(e.id)) : [];
  } catch {
    return [];
  }
};

const DAY_MS = 86_400_000;

/** 0-3 while running, 4 once the four weeks are over. */
export const currentWeek = (enrolment: Enrolment, today: string): number => {
  const days = Math.floor(
    (Date.parse(`${today}T12:00:00`) - Date.parse(`${enrolment.startDay}T12:00:00`)) / DAY_MS,
  );
  return Math.max(0, Math.min(4, Math.floor(days / 7)));
};

/** Whether each week had a real scan of the programme's area. */
export const weeklyCheckIns = (
  programme: Programme,
  enrolment: Enrolment,
  scans: readonly ScanRecord[],
): boolean[] =>
  [0, 1, 2, 3].map((week) => {
    const from = addDays(enrolment.startDay, week * 7);
    const to = addDays(from, 7);
    return scans.some((scan) => {
      if (scan.demo || scan.category !== programme.area) return false;
      const day = dayKey(new Date(scan.created_at));
      return day >= from && day < to;
    });
  });

/** The reading at the start (first scan on or after day one) and now (latest), when both exist. */
export const beforeAfter = (
  programme: Programme,
  enrolment: Enrolment,
  scans: readonly ScanRecord[],
): { before: number; after: number; better: boolean } | null => {
  const value = (scan: ScanRecord) =>
    scan.report?.metrics.find((metric) => metric.key === programme.metric)?.value;
  const inside = scans
    .filter(
      (scan) =>
        !scan.demo &&
        scan.category === programme.area &&
        dayKey(new Date(scan.created_at)) >= enrolment.startDay &&
        value(scan) !== undefined,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = inside[0];
  const last = inside.at(-1);
  if (!first || !last || first === last) return null;
  const before = value(first) ?? 0;
  const after = value(last) ?? 0;
  return { before, after, better: programme.lowerIsBetter ? after < before : after > before };
};

export const toggleProgrammeTick = (
  enrolment: Enrolment,
  week: number,
  step: number,
): Enrolment => {
  const key = `${week}-${step}`;
  const ticks = enrolment.ticks.includes(key)
    ? enrolment.ticks.filter((tick) => tick !== key)
    : [...enrolment.ticks, key];
  return { ...enrolment, ticks };
};
