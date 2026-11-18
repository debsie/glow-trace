import { describe, expect, it } from "vitest";

import { cleanIngredientText } from "@/lib/label-text";
import { detectActives } from "@/lib/ingredients";

describe("Label text clean-up", () => {
  it("keeps only the ingredient list and joins broken lines", () => {
    const raw =
      "GLOW SERUM 30ml\nIngredients: Aqua, Niacin-\namide, Glycerin,\nRetinol • Parfum\nDirections: apply at night";
    expect(cleanIngredientText(raw)).toBe("Aqua, Niacinamide, Glycerin, Retinol, Parfum");
  });

  it("feeds the ingredient check", () => {
    const text = cleanIngredientText("INCI: Aqua, Salicylic Acid, Glycerin");
    expect(detectActives(text).length).toBeGreaterThan(0);
  });

  it("keeps the whole text when there is no heading", () => {
    expect(cleanIngredientText("Aqua,\nGlycerin")).toBe("Aqua, Glycerin");
  });
});
