import type { RoutineMode } from "./plans";

/** The four routine modes. Steps are general care guidance, not medical advice. */

export type RoutineModeSpec = {
  id: RoutineMode;
  label: string;
  short: string;
  summary: string;
  steps: readonly string[];
};

export const ROUTINE_MODES: readonly RoutineModeSpec[] = [
  {
    id: "am",
    label: "Morning",
    short: "AM",
    summary: "Light layers and sun protection to carry you through the day.",
    steps: [
      "Rinse or use a gentle cleanser",
      "Apply the serum from your matches below",
      "Moisturise while skin is still slightly damp",
      "Finish with SPF 30 or higher — every day, even in winter",
    ],
  },
  {
    id: "pm",
    label: "Evening",
    short: "PM",
    summary: "Clean off the day and give your skin time to recover overnight.",
    steps: [
      "Remove makeup and sunscreen first",
      "Cleanse gently — no scrubbing",
      "Apply the serum from your matches below",
      "Seal it in with a moisturiser",
    ],
  },
  {
    id: "premakeup",
    label: "Pre-Makeup Prep",
    short: "Prep",
    summary: "A smooth, hydrated base so makeup sits well and lasts.",
    steps: [
      "Cleanse and pat dry",
      "Hydrating mist or essence, pressed in with your hands",
      "Lightweight moisturiser — give it 5 to 10 minutes to settle",
      "Primer only where you need it (usually the T-zone)",
      "Lip balm now, so it's absorbed before colour goes on",
    ],
  },
  {
    id: "reset",
    label: "Barrier Reset",
    short: "Reset",
    summary: "A stripped-back routine for when your skin feels tight, red or over-treated.",
    steps: [
      "Pause exfoliating acids and retinoids for a few days",
      "Cleanse once a day with lukewarm water and a mild cleanser",
      "Use a plain, fragrance-free moisturiser morning and night",
      "Keep wearing SPF during the day",
      "Bring one active back at a time once skin feels calm",
    ],
  },
];

export const routineModeSpec = (mode: RoutineMode): RoutineModeSpec =>
  ROUTINE_MODES.find((spec) => spec.id === mode) ?? ROUTINE_MODES[0]!;
