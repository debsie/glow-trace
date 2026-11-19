/**
 * The written coach (Claude Haiku, server-side): who gets it and how often. No imports, so the
 * Supabase edge function (supabase/functions/coach) reads the same numbers as the app.
 */
export const COACH_MODEL = "claude-haiku-5-5";

/** Questions a day by plan. Free plans keep the on-device agent, which needs no network. */
export const COACH_QUESTIONS_PER_DAY = { free: 0, pro: 20, studio: 50 } as const;

export type CoachTier = keyof typeof COACH_QUESTIONS_PER_DAY;
