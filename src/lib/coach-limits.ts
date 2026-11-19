/**
 * The written coach (server-side): which model, and how much each plan may spend. No imports, so
 * the Supabase edge function (supabase/functions/coach) reads the same numbers as the app.
 *
 * One model for everyone: Claude Haiku, the most affordable current Claude model, at $0.10 per
 * million input tokens and $0.50 per million output tokens. A typical answer costs about $0.0006.
 * Each plan gets a monthly spend budget (in millionths of a dollar) and a daily cap against
 * bursts, so a heavy user can never cost more than a small share of what they pay.
 */
export const COACH_MODEL = "claude-haiku-5-5";

/** Price per token in millionths of a dollar ($ per million tokens). */
export const COACH_PRICE_MICRO_USD = {
  input: 0.1,
  output: 0.5,
  cacheWrite: 0.125,
  cacheRead: 0.01,
};

/** Monthly spend budget per user: free about R1, Pro about R14, Studio about R37. */
export const COACH_BUDGET_MICRO_USD_PER_MONTH = {
  free: 50_000,
  pro: 750_000,
  studio: 2_000_000,
} as const;

/** Questions a day by plan, so one day can't use up a month. */
export const COACH_QUESTIONS_PER_DAY = { free: 3, pro: 30, studio: 60 } as const;

export type CoachTier = keyof typeof COACH_QUESTIONS_PER_DAY;

/** Cost of one answer in millionths of a dollar, from the API's usage report. */
export const coachCostMicroUsd = (usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): number =>
  Math.ceil(
    usage.input_tokens * COACH_PRICE_MICRO_USD.input +
      usage.output_tokens * COACH_PRICE_MICRO_USD.output +
      (usage.cache_creation_input_tokens ?? 0) * COACH_PRICE_MICRO_USD.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * COACH_PRICE_MICRO_USD.cacheRead,
  );
