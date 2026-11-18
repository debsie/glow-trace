import { z } from "zod";

/**
 * A shopping list kept on the device. Glowtrace does not sell products: until retailer feeds
 * are connected (docs/product-catalogue-plan.md) the list is something to take to a shop or
 * share. Validated on load like anything else entering state.
 */

export const listItemSchema = z.object({
  productId: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  brand: z.string().max(80),
  forNeed: z.string().max(120),
  addedAt: z.string(),
});

export type ListItem = z.infer<typeof listItemSchema>;

export const LIST_KEY = "glowtrace:shopping-list:v1";

export const loadList = (): ListItem[] => {
  try {
    const parsed = z
      .array(listItemSchema)
      .safeParse(JSON.parse(window.localStorage.getItem(LIST_KEY) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

export const saveList = (items: readonly ListItem[]): void => {
  try {
    window.localStorage.setItem(LIST_KEY, JSON.stringify(items));
  } catch {
    // Not saved: the list still works for this visit.
  }
};

/** Adds or removes a product; at most one entry per product. */
export const toggleItem = (items: readonly ListItem[], item: ListItem): ListItem[] =>
  items.some((entry) => entry.productId === item.productId)
    ? items.filter((entry) => entry.productId !== item.productId)
    : [...items, item];

/** Plain text for copying or sharing (e.g. WhatsApp). */
export const listAsText = (items: readonly ListItem[]): string =>
  [
    "My Glowtrace shopping list",
    ...items.map((item) => `- ${item.name} (${item.brand}), for ${item.forNeed.toLowerCase()}`),
  ].join("\n");
