import { CONFLICTS } from "./agent/knowledge";
import type { Active } from "./agent/knowledge";

/**
 * Spot the active ingredients in pasted INCI lists and flag pairs that should not share a
 * routine. General cosmetic guidance only: it reads names, not concentrations.
 */

const ACTIVE_NAMES: Record<Exclude<Active, "spf" | "oil" | "protein">, readonly string[]> = {
  retinoid: [
    "retinol",
    "retinal",
    "retinaldehyde",
    "retinyl",
    "tretinoin",
    "adapalene",
    "bakuchiol",
  ],
  aha: [
    "glycolic acid",
    "lactic acid",
    "mandelic acid",
    "malic acid",
    "tartaric acid",
    "citric acid",
  ],
  bha: ["salicylic acid", "betaine salicylate", "willow bark"],
  "vitamin-c": ["ascorbic acid", "ascorbyl", "magnesium ascorbyl phosphate", "ethyl ascorbic"],
  niacinamide: ["niacinamide"],
  azelaic: ["azelaic acid"],
};

export const ACTIVE_LABEL: Record<Active, string> = {
  retinoid: "Retinoid",
  aha: "AHA",
  bha: "BHA",
  "vitamin-c": "Vitamin C",
  niacinamide: "Niacinamide",
  azelaic: "Azelaic acid",
  spf: "Sunscreen",
  oil: "Oil",
  protein: "Protein",
};

/** Bakuchiol is a gentler retinol alternative, so it is named but not treated as a retinoid. */
const NOT_A_RETINOID = ["bakuchiol"];

export type ProductInput = { name: string; ingredients: string };
export type DetectedProduct = { name: string; actives: Active[] };
export type Clash = { products: [string, string]; actives: [Active, Active]; advice: string };

export const detectActives = (ingredients: string): Active[] => {
  const text = ingredients.toLowerCase();
  const found: Active[] = [];
  for (const [active, names] of Object.entries(ACTIVE_NAMES) as [Active, readonly string[]][]) {
    const hit = names.some(
      (name) => text.includes(name) && !(active === "retinoid" && NOT_A_RETINOID.includes(name)),
    );
    if (hit) found.push(active);
  }
  return found;
};

export const checkIngredients = (
  products: readonly ProductInput[],
): { detected: DetectedProduct[]; clashes: Clash[] } => {
  const detected = products
    .filter((product) => product.ingredients.trim() !== "")
    .map((product, index) => ({
      name: product.name.trim() || `Product ${index + 1}`,
      actives: detectActives(product.ingredients),
    }));
  const clashes: Clash[] = [];
  for (let i = 0; i < detected.length; i += 1) {
    for (let j = i + 1; j < detected.length; j += 1) {
      const a = detected[i];
      const b = detected[j];
      if (!a || !b) continue;
      for (const { pair, advice } of CONFLICTS) {
        const [first, second] = pair;
        const forward = a.actives.includes(first) && b.actives.includes(second);
        const backward = a.actives.includes(second) && b.actives.includes(first);
        if (forward || backward) {
          clashes.push({ products: [a.name, b.name], actives: [first, second], advice });
        }
      }
    }
  }
  return { detected, clashes };
};
