/**
 * The written coach (server-side): who gets it, on which model and how often. No imports, so the
 * Supabase edge function (supabase/functions/coach) reads the same numbers as the app.
 *
 * Paid plans get Anthropic's frontier Opus model. A question costs roughly $0.02-0.03 on it
 * (system prompt cached, about 1,000 output tokens with thinking), so the daily caps keep a
 * heavy user's worst case near the plan price; typical use is far lower. Free plans keep the
 * on-device agent, which costs nothing and works offline.
 */
export const COACH_MODEL_BY_TIER = {
  free: null,
  pro: "claude-opus-5-5",
  studio: "claude-opus-5-5",
} as const;

/** Questions a day by plan. */
export const COACH_QUESTIONS_PER_DAY = { free: 0, pro: 5, studio: 15 } as const;

export type CoachTier = keyof typeof COACH_QUESTIONS_PER_DAY;
