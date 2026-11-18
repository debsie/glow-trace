import { createFileRoute } from "@tanstack/react-router";
import { Plus, X } from "lucide-react";
import { useState } from "react";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import { Badge, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { ACTIVE_LABEL, checkIngredients } from "@/lib/ingredients";
import type { ProductInput } from "@/lib/ingredients";
import { ingredientGate } from "@/lib/plans";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/ingredients")({
  head: () =>
    pageHead({
      title: "Ingredient Check — Glowtrace",
      description: "Paste ingredient lists to see which products should not share a routine.",
      path: "/ingredients",
      noindex: true,
    }),
  component: IngredientCheck,
});

const MAX_PRODUCTS = 6;
const MAX_LENGTH = 4000;

function IngredientCheck() {
  const { tier } = useAppState();
  const gate = ingredientGate(tier);
  const [products, setProducts] = useState<ProductInput[]>([
    { name: "", ingredients: "" },
    { name: "", ingredients: "" },
  ]);
  const { detected, clashes } = checkIngredients(products);

  const update = (index: number, patch: Partial<ProductInput>) =>
    setProducts((current) =>
      current.map((product, i) => (i === index ? { ...product, ...patch } : product)),
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ingredient Check"
        subtitle="Paste the ingredient list from two or more products. Nothing leaves this device."
      />

      {!gate.allowed && <UpgradeCard gate={gate} />}

      {gate.allowed && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {products.map((product, index) => (
              <SectionCard
                key={index}
                title={`Product ${index + 1}`}
                action={
                  products.length > 2 ? (
                    <button
                      type="button"
                      aria-label={`Remove product ${index + 1}`}
                      onClick={() =>
                        setProducts((current) => current.filter((_, i) => i !== index))
                      }
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : undefined
                }
              >
                <label className="block text-sm font-semibold" htmlFor={`name-${index}`}>
                  Name (optional)
                </label>
                <input
                  id={`name-${index}`}
                  value={product.name}
                  maxLength={80}
                  onChange={(event) => update(index, { name: event.target.value })}
                  className="mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base"
                />
                <label className="mt-3 block text-sm font-semibold" htmlFor={`inci-${index}`}>
                  Ingredients
                </label>
                <textarea
                  id={`inci-${index}`}
                  value={product.ingredients}
                  maxLength={MAX_LENGTH}
                  rows={4}
                  onChange={(event) => update(index, { ingredients: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-card p-3 text-base"
                />
              </SectionCard>
            ))}
          </div>

          {products.length < MAX_PRODUCTS && (
            <button
              type="button"
              onClick={() => setProducts((current) => [...current, { name: "", ingredients: "" }])}
              className="inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-border bg-secondary px-6 text-base font-semibold"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add another product
            </button>
          )}

          <div aria-live="polite" className="space-y-3">
            {detected.length < 2 ? (
              <SectionCard>
                <p className="text-sm text-muted-foreground">
                  Paste ingredients for at least two products to compare them.
                </p>
              </SectionCard>
            ) : (
              <>
                <SectionCard title="Actives found">
                  <ul className="space-y-2">
                    {detected.map((product) => (
                      <li key={product.name} className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{product.name}</span>
                        {product.actives.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            No common actives found
                          </span>
                        ) : (
                          product.actives.map((active) => (
                            <Badge key={active} tone="accent">
                              {ACTIVE_LABEL[active]}
                            </Badge>
                          ))
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
                <SectionCard title="Clashes">
                  {clashes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No clashes found between these products. This reads ingredient names only, not
                      strengths. Patch-test anything new.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {clashes.map((clash) => (
                        <li key={`${clash.products.join("|")}-${clash.actives.join("|")}`}>
                          <p className="font-semibold">
                            {clash.products[0]} + {clash.products[1]}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {ACTIVE_LABEL[clash.actives[0]]} with {ACTIVE_LABEL[clash.actives[1]]}.{" "}
                            {clash.advice}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
