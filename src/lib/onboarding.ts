import { z } from "zod";

import type { ScanCategory } from "./types";

/** First-run answers, kept on the device. Used to tailor the first scan and Makeup Day. */
export const onboardingSchema = z.object({
  goals: z.array(z.enum(["skin", "hair", "nails", "makeup"])).min(1),
  artist: z.boolean(),
  hairPattern: z.enum(["straight", "wavy", "curly", "coily"]).nullable(),
  hairTreated: z.boolean().nullable(),
  completedAt: z.string(),
});

export type Onboarding = z.infer<typeof onboardingSchema>;
export type Goal = Onboarding["goals"][number];

export const ONBOARDING_KEY = "glowtrace:onboarding:v1";

export const loadOnboarding = (): Onboarding | null => {
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return null;
    const parsed = onboardingSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveOnboarding = (answers: Onboarding): void => {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboardingSchema.parse(answers)));
  } catch {
    // Not saved: onboarding may show again next visit.
  }
};

/** Which area to scan first: makeup starts with skin, otherwise the first goal chosen. */
export const firstScanArea = (goals: readonly Goal[]): ScanCategory => {
  const first = goals[0] ?? "skin";
  return first === "makeup" ? "skin" : first;
};

/** The onboarding steps to show for these goals (skin questions only when skin or makeup). */
export const onboardingSteps = (goals: readonly Goal[]): string[] => [
  "welcome",
  "goals",
  ...(goals.includes("skin") || goals.includes("makeup") ? ["skin"] : []),
  ...(goals.includes("hair") ? ["hair"] : []),
  "how",
  "ready",
];
