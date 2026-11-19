import { z } from "zod";

/**
 * Product lookup by barcode in Open Beauty Facts (open database, ODbL). Only the barcode number is
 * sent; no photo, reading or account detail. Pure helpers here; the browser reader is in
 * lib/barcode-read.ts.
 */
export const OPEN_BEAUTY_FACTS_ORIGIN = "https://world.openbeautyfacts.org";

/** EAN-8, UPC-A (12), EAN-13 or GTIN-14 with a valid check digit. */
export const isValidBarcode = (code: string): boolean => {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() ?? -1;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
};

const responseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      brands: z.string().optional(),
      ingredients_text_en: z.string().optional(),
      ingredients_text: z.string().optional(),
    })
    .optional(),
});

export type FoundProduct = { name: string; ingredients: string };

/** The product's name and ingredients, or null when the database has no ingredient list. */
export const parseProduct = (json: unknown): FoundProduct | null => {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) return null;
  const p = parsed.data.product;
  const ingredients = (p.ingredients_text_en || p.ingredients_text || "").trim().slice(0, 4000);
  if (ingredients.length < 5) return null;
  const brand = p.brands?.split(",")[0]?.trim();
  const title = p.product_name?.trim() ?? "";
  const withBrand =
    brand && !title.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${title}` : title;
  const name = withBrand.trim().slice(0, 80);
  return { name: name || "Scanned product", ingredients };
};

export const productUrl = (code: string): string =>
  `${OPEN_BEAUTY_FACTS_ORIGIN}/api/v2/product/${code}.json?fields=product_name,brands,ingredients_text,ingredients_text_en`;

export const lookUpBarcode = async (code: string): Promise<FoundProduct | null> => {
  if (!isValidBarcode(code)) return null;
  const response = await fetch(productUrl(code), {
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) return null;
  return parseProduct(await response.json());
};
