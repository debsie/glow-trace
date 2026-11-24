import { z } from "zod";

import type { Active } from "./agent/knowledge";
import type { CareNeed } from "./beauty";
import type { Clash } from "./ingredients";
import { checkIngredients, detectActives } from "./ingredients";

/**
 * Smarter shelf: what each product does, and one shelf score out of 100 for how well the shelf
 * covers the basics and the person's own needs. Reads ingredient names, never concentrations;
 * general cosmetic guidance, not medical advice.
 */

export type ShelfProduct = {
  id: string;
  name: string;
  brand?: string | undefined;
  ingredients: string;
  source: "catalog" | "added";
  barcode?: string | undefined;
};

/** Products added by barcode or by hand, kept on this device. */
export const addedProductSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  brand: z.string().max(80).optional(),
  ingredients: z.string().max(6000),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  addedAt: z.string(),
});
export type AddedProduct = z.infer<typeof addedProductSchema>;

export const ADDED_KEY = "glowtrace:shelf-added:v1";

export const loadAdded = (): AddedProduct[] => {
  try {
    const raw = window.localStorage.getItem(ADDED_KEY);
    const parsed = z.array(addedProductSchema).safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const saveAdded = (items: readonly AddedProduct[]): void => {
  try {
    window.localStorage.setItem(ADDED_KEY, JSON.stringify(items));
  } catch {
    // Not saved; the list still works for this visit.
  }
};

export type Role =
  "cleanser" | "moisturiser" | "sunscreen" | "treatment" | "hair" | "nails" | "other";

const has = (text: string, words: readonly string[]) => words.some((word) => text.includes(word));

const UV_FILTERS = [
  "zinc oxide",
  "titanium dioxide",
  "avobenzone",
  "butyl methoxydibenzoylmethane",
  "ethylhexyl methoxycinnamate",
  "octinoxate",
  "octocrylene",
  "bis-ethylhexyloxyphenol",
  "bemotrizinol",
  "tinosorb",
  "uvinul",
  "homosalate",
  "ethylhexyl salicylate",
  "diethylamino hydroxybenzoyl",
];
const HYDRATORS = [
  "glycerin",
  "hyaluron",
  "sodium pca",
  "urea",
  "panthenol",
  "squalane",
  "ceramide",
];
const FRAGRANCE = ["parfum", "fragrance", "linalool", "limonene", "citronellol", "geraniol"];
const DRYING_ALCOHOL = ["alcohol denat", "sd alcohol", "isopropyl alcohol"];

/** Sunscreen by name or by UV filter in the ingredients. */
export const isSunscreen = (product: Pick<ShelfProduct, "name" | "ingredients">): boolean => {
  const name = product.name.toLowerCase();
  return (
    has(name, ["spf", "sunscreen", "sun cream", "sun block", "sunblock"]) ||
    has(product.ingredients.toLowerCase(), UV_FILTERS)
  );
};

export const roleOf = (product: Pick<ShelfProduct, "name" | "ingredients">): Role => {
  const name = product.name.toLowerCase();
  if (isSunscreen(product)) return "sunscreen";
  if (has(name, ["cleanser", "face wash", "cleansing", "micellar", "wash"])) return "cleanser";
  if (has(name, ["shampoo", "conditioner", "leave-in", "hair", "curl", "edge"])) return "hair";
  if (has(name, ["nail", "cuticle"])) return "nails";
  if (has(name, ["serum", "toner", "treatment", "essence", "exfoliant", "peel", "acid"]))
    return "treatment";
  if (has(name, ["moistur", "cream", "lotion", "balm", "gel cream", "butter"]))
    return "moisturiser";
  return detectActives(product.ingredients).length > 0 ? "treatment" : "other";
};

/** What each active is for, in plain words. */
const HELPS: Partial<Record<Active, string>> = {
  niacinamide: "redness, marks and shine",
  azelaic: "redness and dark marks",
  "vitamin-c": "dark marks and dullness",
  retinoid: "texture and fine lines",
  aha: "texture and dullness",
  bha: "breakouts and clogged pores",
  spf: "protecting everything else you do",
  oil: "dryness and shine",
  protein: "weak, breaking strands",
};

export type Insight = {
  role: Role;
  actives: Active[];
  helps: string[];
  hydrates: boolean;
  watch: string[];
};

export const productInsight = (product: Pick<ShelfProduct, "name" | "ingredients">): Insight => {
  const text = product.ingredients.toLowerCase();
  const actives: Active[] = [...detectActives(product.ingredients)];
  if (isSunscreen(product)) actives.push("spf");
  const watch: string[] = [];
  if (has(text, FRAGRANCE)) watch.push("Contains fragrance: patch test if your skin is sensitive");
  if (has(text, DRYING_ALCOHOL))
    watch.push("Drying alcohol high up can sting dry or irritated skin");
  if (actives.includes("retinoid"))
    watch.push("Retinoid: night only, and check with a doctor if pregnant");
  if (actives.includes("aha") || actives.includes("bha") || actives.includes("retinoid")) {
    watch.push("Makes skin more sun-sensitive: wear sunscreen daily");
  }
  return {
    role: roleOf(product),
    actives,
    helps: actives.flatMap((active) => HELPS[active] ?? []),
    hydrates: has(text, HYDRATORS),
    watch,
  };
};

/** Which actives answer each care need (ids from beauty.ts CARE_NEEDS). */
const NEED_ACTIVES: Record<string, readonly Active[]> = {
  calm: ["niacinamide", "azelaic"],
  smooth: ["aha", "bha", "retinoid"],
  brighten: ["vitamin-c", "niacinamide", "azelaic"],
  strength: ["protein"],
  nails: ["oil"],
};

export type ScorePart = { id: string; label: string; got: number; max: number; note: string };
export type ShelfScore = {
  score: number;
  parts: ScorePart[];
  gaps: string[];
  clashes: Clash[];
  covered: { need: CareNeed; by: string | null }[];
};

const covers = (need: CareNeed, product: ShelfProduct, insight: Insight): boolean =>
  product.id === need.recommendedProductId ||
  (need.id === "hydrate"
    ? insight.hydrates
    : (NEED_ACTIVES[need.id] ?? []).some((a) => insight.actives.includes(a)));

/**
 * Shelf score out of 100: basics 40 (sunscreen 20, cleanser 10, moisturiser 10), your needs 30
 * (share of today's care needs something on the shelf answers), no clashes 20 (10 off per clash),
 * gentle 10 (5 off per leave-on product with fragrance or drying alcohol).
 */
export const shelfScore = (
  products: readonly ShelfProduct[],
  needs: readonly CareNeed[],
): ShelfScore => {
  const insights = products.map((product) => ({ product, insight: productInsight(product) }));
  const roles = new Set(insights.map(({ insight }) => insight.role));
  const gaps: string[] = [];
  const basic = (role: Role, points: number, gap: string) => {
    if (roles.has(role)) return points;
    gaps.push(gap);
    return 0;
  };
  const basics =
    basic(
      "sunscreen",
      20,
      "A daily sunscreen, SPF 30 or more: the single biggest help for marks and ageing",
    ) +
    basic("cleanser", 10, "A gentle cleanser") +
    basic("moisturiser", 10, "A moisturiser to keep your skin barrier comfortable");

  const covered = needs.map((need) => ({
    need,
    by:
      insights.find(({ product, insight }) => covers(need, product, insight))?.product.name ?? null,
  }));
  for (const item of covered) {
    if (!item.by) gaps.push(`Something for ${item.need.label.toLowerCase()}`);
  }
  const needPoints =
    needs.length === 0 ? 30 : Math.round((30 * covered.filter((c) => c.by).length) / needs.length);

  const { clashes } = checkIngredients(
    products.map((p) => ({ name: p.name, ingredients: p.ingredients })),
  );
  const clashPoints = Math.max(0, 20 - 10 * clashes.length);

  const harsh = insights.filter(
    ({ insight }) =>
      insight.role !== "cleanser" &&
      insight.role !== "hair" &&
      insight.watch.some(
        (w) => w.startsWith("Contains fragrance") || w.startsWith("Drying alcohol"),
      ),
  ).length;
  const gentlePoints = Math.max(0, 10 - 5 * harsh);

  const parts: ScorePart[] = [
    {
      id: "basics",
      label: "The basics",
      got: basics,
      max: 40,
      note: "Cleanser, moisturiser and daily sunscreen",
    },
    {
      id: "needs",
      label: "Your needs",
      got: needPoints,
      max: 30,
      note: needs.length
        ? `${covered.filter((c) => c.by).length} of ${needs.length} of today's needs covered`
        : "No care needs flagged right now",
    },
    {
      id: "clashes",
      label: "No clashes",
      got: clashPoints,
      max: 20,
      note: clashes.length
        ? `${clashes.length} ${clashes.length === 1 ? "pair needs" : "pairs need"} spacing out`
        : "Nothing on your shelf fights each other",
    },
    {
      id: "gentle",
      label: "Gentle",
      got: gentlePoints,
      max: 10,
      note: harsh
        ? `${harsh} leave-on ${harsh === 1 ? "product has" : "products have"} fragrance or drying alcohol`
        : "No fragrance or drying alcohol in leave-ons",
    },
  ];
  return { score: parts.reduce((sum, part) => sum + part.got, 0), parts, gaps, clashes, covered };
};
