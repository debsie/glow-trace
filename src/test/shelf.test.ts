import { describe, expect, it } from "vitest";

import { CARE_NEEDS } from "@/lib/beauty";
import { isSunscreen, productInsight, roleOf, shelfScore } from "@/lib/shelf";
import type { ShelfProduct } from "@/lib/shelf";

const p = (name: string, ingredients: string): ShelfProduct => ({
  id: name,
  name,
  ingredients,
  source: "added",
});

const need = (id: string) => {
  const found = CARE_NEEDS.find((n) => n.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("smarter shelf", () => {
  it("spots sunscreen by name or by UV filter", () => {
    expect(isSunscreen(p("Daily Fluid SPF 50", "aqua"))).toBe(true);
    expect(isSunscreen(p("Day Cream", "aqua, zinc oxide, glycerin"))).toBe(true);
    expect(isSunscreen(p("Night Cream", "aqua, glycerin"))).toBe(false);
  });

  it("names each product's role", () => {
    expect(roleOf(p("Gentle Foaming Cleanser", "aqua"))).toBe("cleanser");
    expect(roleOf(p("Barrier Moisturiser", "aqua, ceramide np"))).toBe("moisturiser");
    expect(roleOf(p("10% Niacinamide Serum", "aqua, niacinamide"))).toBe("treatment");
  });

  it("explains what a product does and what to watch", () => {
    const insight = productInsight(p("Retinol Night Serum", "aqua, retinol, parfum, glycerin"));
    expect(insight.actives).toContain("retinoid");
    expect(insight.helps).toContain("texture and fine lines");
    expect(insight.hydrates).toBe(true);
    expect(insight.watch.join(" ")).toMatch(/fragrance/);
    expect(insight.watch.join(" ")).toMatch(/night only/);
  });

  it("scores a complete, gentle shelf that covers the needs at 100", () => {
    const shelf = [
      p("Gentle Cleanser", "aqua, glycerin"),
      p("Barrier Moisturiser", "aqua, ceramide np, glycerin"),
      p("Mineral SPF 50", "zinc oxide"),
      p("Niacinamide Serum", "aqua, niacinamide"),
    ];
    const result = shelfScore(shelf, [need("calm"), need("hydrate")]);
    expect(result.score).toBe(100);
    expect(result.gaps).toEqual([]);
  });

  it("names the gaps and takes points for clashes and fragrance", () => {
    const shelf = [p("Retinol Serum", "retinol, parfum"), p("Glycolic Toner", "glycolic acid")];
    const result = shelfScore(shelf, [need("calm")]);
    expect(result.gaps[0]).toMatch(/sunscreen/);
    expect(result.gaps.some((g) => /redness|calm/i.test(g) || g.startsWith("Something for"))).toBe(
      true,
    );
    expect(result.clashes.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(50);
  });

  it("scores an empty shelf at the needs share only when nothing is flagged", () => {
    expect(shelfScore([], []).score).toBe(30 + 20 + 10);
  });
});
