import { describe, expect, it } from "vitest";

import { firstScanArea, onboardingSchema, onboardingSteps } from "@/lib/onboarding";
import { listAsText, toggleItem } from "@/lib/shopping-list";

describe("Onboarding", () => {
  it("asks about skin only for skin or makeup, and hair only for hair", () => {
    expect(onboardingSteps(["nails"])).toEqual(["welcome", "goals", "how", "ready"]);
    expect(onboardingSteps(["makeup", "hair"])).toEqual([
      "welcome",
      "goals",
      "skin",
      "hair",
      "how",
      "ready",
    ]);
  });

  it("starts makeup people with a skin scan", () => {
    expect(firstScanArea(["makeup"])).toBe("skin");
    expect(firstScanArea(["hair", "skin"])).toBe("hair");
    expect(firstScanArea([])).toBe("skin");
  });

  it("needs at least one goal", () => {
    expect(
      onboardingSchema.safeParse({
        goals: [],
        artist: false,
        hairPattern: null,
        hairTreated: null,
        completedAt: "x",
      }).success,
    ).toBe(false);
  });
});

describe("Shopping list", () => {
  const item = {
    productId: "p_bha",
    name: "2% BHA Polish Toner",
    brand: "Clearline",
    forNeed: "Smooth texture",
    addedAt: "t",
  };

  it("adds once and removes on the second tap", () => {
    const once = toggleItem([], item);
    expect(once).toHaveLength(1);
    expect(toggleItem(once, item)).toEqual([]);
  });

  it("writes a plain list to share", () => {
    expect(listAsText([item])).toBe(
      "My Glowtrace shopping list\n- 2% BHA Polish Toner (Clearline), for smooth texture",
    );
  });
});
