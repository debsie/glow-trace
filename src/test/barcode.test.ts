import { describe, expect, it } from "vitest";

import { isValidBarcode, parseProduct, productUrl } from "@/lib/barcode";

describe("Barcode lookup", () => {
  it("checks the check digit", () => {
    expect(isValidBarcode("3337875597197")).toBe(true);
    expect(isValidBarcode("3337875597198")).toBe(false);
    expect(isValidBarcode("12345")).toBe(false);
    expect(isValidBarcode("036000291452")).toBe(true);
  });

  it("reads name and ingredients from Open Beauty Facts", () => {
    expect(
      parseProduct({
        status: 1,
        product: {
          brands: "CeraVe, L'Oreal",
          product_name: "Foaming Cleanser",
          ingredients_text_en: "aqua, glycerin, niacinamide",
        },
      }),
    ).toEqual({ name: "CeraVe Foaming Cleanser", ingredients: "aqua, glycerin, niacinamide" });
  });

  it("does not repeat the brand", () => {
    expect(
      parseProduct({
        status: 1,
        product: {
          brands: "CeraVe",
          product_name: "CeraVe Gel",
          ingredients_text: "aqua, glycerin",
        },
      })?.name,
    ).toBe("CeraVe Gel");
  });

  it("returns null when the product or its ingredients are missing", () => {
    expect(parseProduct({ status: 0 })).toBeNull();
    expect(parseProduct({ status: 1, product: { product_name: "X" } })).toBeNull();
    expect(parseProduct("junk")).toBeNull();
  });

  it("asks only for the fields it needs", () => {
    expect(productUrl("3337875597197")).toContain("fields=product_name,brands");
  });
});
