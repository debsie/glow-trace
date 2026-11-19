import { describe, expect, it } from "vitest";

import {
  COACH_BUDGET_MICRO_USD_PER_MONTH,
  COACH_QUESTIONS_PER_DAY,
  coachCostMicroUsd,
} from "@/lib/coach-limits";
import { PLANS } from "@/lib/plans";

// Rough rand per dollar, only for checking budgets against plan prices.
const ZAR_PER_USD = 18.5;

describe("Coach budgets", () => {
  it("prices an answer from the usage report", () => {
    // 1,500 input tokens and 400 output tokens on Haiku: $0.00035.
    expect(coachCostMicroUsd({ input_tokens: 1500, output_tokens: 400 })).toBe(350);
  });

  it("never lets a paid plan's model spend pass a quarter of its price", () => {
    for (const tier of ["pro", "studio"] as const) {
      const budgetZar = (COACH_BUDGET_MICRO_USD_PER_MONTH[tier] / 1_000_000) * ZAR_PER_USD;
      expect(budgetZar).toBeLessThanOrEqual(PLANS[tier].monthlyZar * 0.25);
    }
  });

  it("gives every plan some questions, paid plans more", () => {
    expect(COACH_QUESTIONS_PER_DAY.free).toBeGreaterThan(0);
    expect(COACH_QUESTIONS_PER_DAY.pro).toBeGreaterThan(COACH_QUESTIONS_PER_DAY.free);
  });
});
