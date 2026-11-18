import { describe, expect, it } from "vitest";

import { checkIngredients, detectActives } from "@/lib/ingredients";
import { daysUntil, prepPlan } from "@/lib/prep-plan";

describe("Ingredient checks", () => {
  it("finds actives by their ingredient names", () => {
    expect(detectActives("Aqua, Glycerin, Retinol, Tocopherol")).toEqual(["retinoid"]);
    expect(detectActives("Aqua, Salicylic Acid, Niacinamide")).toEqual(["bha", "niacinamide"]);
    expect(detectActives("Aqua, Bakuchiol")).toEqual([]);
    expect(detectActives("Aqua, Glycerin")).toEqual([]);
  });

  it("flags clashes between products and names both", () => {
    const { clashes, detected } = checkIngredients([
      { name: "Night cream", ingredients: "Aqua, Retinol" },
      { name: "Toner", ingredients: "Aqua, Glycolic Acid" },
    ]);
    expect(detected).toHaveLength(2);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]?.products).toEqual(["Night cream", "Toner"]);
    expect(clashes[0]?.advice).toMatch(/different nights/);
  });

  it("reports no clash for compatible products and skips empty lists", () => {
    const { clashes, detected } = checkIngredients([
      { name: "", ingredients: "Niacinamide, Aqua" },
      { name: "", ingredients: "Retinol" },
      { name: "Empty", ingredients: "  " },
    ]);
    expect(clashes).toEqual([]);
    expect(detected.map((product) => product.name)).toEqual(["Product 1", "Product 2"]);
  });
});

describe("Prep plan", () => {
  it("counts whole days between dates", () => {
    expect(daysUntil("2026-11-25", "2026-11-18")).toBe(7);
    expect(daysUntil("2026-11-18", "2026-11-18")).toBe(0);
    expect(daysUntil("2026-11-17", "2026-11-18")).toBe(-1);
  });

  it("gives a full week from seven days out, ending on the event day", () => {
    const plan = prepPlan("2026-11-25", "2026-11-18");
    expect(plan.days.map((day) => day.daysBefore)).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);
    expect(plan.shortRunway).toBe(false);
    expect(plan.days.find((day) => day.daysBefore === 5)?.title).toMatch(/retinoid/i);
  });

  it("drops days already past and says the runway is short", () => {
    const plan = prepPlan("2026-11-21", "2026-11-18");
    expect(plan.days.map((day) => day.daysBefore)).toEqual([3, 2, 1, 0]);
    expect(plan.shortRunway).toBe(true);
  });

  it("returns only event day for today and nothing sensible for the past", () => {
    expect(prepPlan("2026-11-18", "2026-11-18").days.map((day) => day.daysBefore)).toEqual([0]);
    expect(prepPlan("2026-11-10", "2026-11-18").daysAway).toBeLessThan(0);
  });
});
