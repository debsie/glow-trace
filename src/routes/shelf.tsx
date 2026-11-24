import { createFileRoute, Link } from "@tanstack/react-router";
import { Barcode, PenLine, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import {
  Badge,
  BUTTON_GHOST,
  BUTTON_PRIMARY,
  GhostButton,
  SectionCard,
} from "@/components/ui/bits";
import { ScoreRing } from "@/components/ui/score-ring";
import { useAppState } from "@/context/app-state";
import { lookUpBarcode } from "@/lib/barcode";
import { readBarcode } from "@/lib/barcode-read";
import type { CareNeed } from "@/lib/beauty";
import { activeNeeds } from "@/lib/beauty";
import { ACTIVE_LABEL } from "@/lib/ingredients";
import { PLANS, shelfGate } from "@/lib/plans";
import { pageHead } from "@/lib/seo";
import type { AddedProduct, Role, ShelfProduct } from "@/lib/shelf";
import { addedProductSchema, loadAdded, productInsight, saveAdded, shelfScore } from "@/lib/shelf";

export const Route = createFileRoute("/shelf")({
  head: () =>
    pageHead({
      title: "Your shelf — Glowtrace",
      description: "What every product on your shelf does, and how well your shelf covers you.",
      path: "/shelf",
      noindex: true,
    }),
  component: ShelfPage,
});

const ROLE_LABEL: Record<Role, string> = {
  cleanser: "Cleanser",
  moisturiser: "Moisturiser",
  sunscreen: "Sunscreen",
  treatment: "Treatment",
  hair: "Hair",
  nails: "Nails",
  other: "Other",
};

const headline = (score: number) =>
  score >= 80 ? "A well-rounded shelf" : score >= 55 ? "Nearly there" : "A few gaps to fill";

const Bar = ({ got, max }: { got: number; max: number }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(got));
    return () => cancelAnimationFrame(frame);
  }, [got]);
  return (
    <div className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out motion-reduce:transition-none"
        style={{ width: `${(shown / max) * 100}%` }}
      />
    </div>
  );
};

function ShelfPage() {
  const { scans, inventory, catalog, tier, shelfCount, toggleShelfProduct } = useAppState();
  const [added, setAdded] = useState<AddedProduct[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState({ name: "", ingredients: "" });
  useEffect(() => setAdded(loadAdded()), []);

  const products: ShelfProduct[] = useMemo(
    () => [
      ...catalog
        .filter((product) => !product.is_diy)
        .filter((product) =>
          inventory.some((item) => item.product_id === product.id && item.in_stock),
        )
        .map((product) => ({
          id: product.id,
          name: product.name,
          brand: product.brand,
          ingredients: product.ingredients,
          source: "catalog" as const,
        })),
      ...added.map((product) => ({ ...product, source: "added" as const })),
    ],
    [catalog, inventory, added],
  );

  // Today's care needs: from the latest real scan of each area.
  const needs = useMemo(() => {
    const out = new Map<string, CareNeed>();
    for (const area of ["skin", "hair", "nails"] as const) {
      const latest = scans
        .filter((scan) => scan.category === area && !scan.demo)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      if (latest) for (const need of activeNeeds(latest.biomarkers, area)) out.set(need.id, need);
    }
    return [...out.values()];
  }, [scans]);

  const result = useMemo(() => shelfScore(products, needs), [products, needs]);
  const cap = PLANS[tier].limits.shelfProducts;
  const total = shelfCount + added.length;

  const add = (product: Omit<AddedProduct, "id" | "addedAt">) => {
    const gate = shelfGate(tier, total);
    if (!gate.allowed) {
      setNote(gate.message);
      return false;
    }
    const parsed = addedProductSchema.safeParse({
      ...product,
      id: `added_${Date.now().toString(36)}`,
      addedAt: new Date().toISOString(),
    });
    if (!parsed.success) {
      setNote("That product couldn't be added. Check the name and try again");
      return false;
    }
    const next = [...added, parsed.data];
    setAdded(next);
    saveAdded(next);
    setNote(`Added ${parsed.data.name}`);
    return true;
  };

  const scan = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setNote("Reading the barcode on this device");
    try {
      const code = await readBarcode(file);
      if (!code) {
        setNote("No barcode found. Fill the frame with the barcode, flat and sharp");
        return;
      }
      setNote("Looking up the barcode number in Open Beauty Facts");
      const found = await lookUpBarcode(code);
      if (!found) {
        setNote("That product isn't in Open Beauty Facts yet. Type it in instead");
        setDraft({ name: "", ingredients: "" });
        setTyping(true);
        return;
      }
      add({ name: found.name, ingredients: found.ingredients, barcode: code });
    } catch {
      setNote("The lookup didn't work. Check your connection or type it in instead");
    } finally {
      setBusy(false);
    }
  };

  const remove = (product: ShelfProduct) => {
    if (product.source === "catalog") {
      toggleShelfProduct(product.id);
    } else {
      const next = added.filter((item) => item.id !== product.id);
      setAdded(next);
      saveAdded(next);
    }
    setNote(`Took ${product.name} off your shelf`);
  };

  return (
    <div className="space-y-8">
      <section className="surface-strong page-enter relative overflow-hidden p-6 sm:p-10">
        <LineArt
          motif="flask"
          className="art-draw art-breathe pointer-events-none absolute top-6 right-6 hidden h-28 w-28 opacity-80 md:block"
        />
        <div className="grid items-center gap-8 sm:grid-cols-[auto_1fr]">
          <ScoreRing value={result.score} label="Shelf score" className="mx-auto h-40 w-40" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              Your shelf · {total} of {cap}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">
              {headline(result.score)}
            </h1>
            <dl className="mt-6 grid max-w-xl gap-4 sm:grid-cols-2">
              {result.parts.map((part) => (
                <div key={part.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <dt className="font-semibold">{part.label}</dt>
                    <dd className="readout text-muted-foreground">
                      {part.got}/{part.max}
                    </dd>
                  </div>
                  <Bar got={part.got} max={part.max} />
                  <p className="mt-1 text-xs text-muted-foreground">{part.note}</p>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <SectionCard title="Add a product">
        <div className="flex flex-wrap gap-3">
          <label className={`${BUTTON_PRIMARY} relative ${busy ? "opacity-60" : "cursor-pointer"}`}>
            <Barcode className="h-5 w-5" aria-hidden="true" />
            {busy ? "Reading" : "Scan a barcode"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Take a photo of the product's barcode"
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              disabled={busy}
              onChange={(event) => {
                void scan(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <GhostButton onClick={() => setTyping((open) => !open)}>
            <PenLine className="h-5 w-5" aria-hidden="true" /> Type it in
          </GhostButton>
        </div>
        {typing && (
          <form
            className="mt-4 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (add({ name: draft.name, ingredients: draft.ingredients })) {
                setDraft({ name: "", ingredients: "" });
                setTyping(false);
              }
            }}
          >
            <label className="text-sm font-semibold">
              Product name
              <input
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className="mt-1 min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Ingredients (optional, from the back of the pack)
              <textarea
                maxLength={6000}
                value={draft.ingredients}
                onChange={(event) => setDraft({ ...draft, ingredients: event.target.value })}
                className="mt-1 min-h-[110px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-base font-normal"
              />
            </label>
            <div>
              <button type="submit" className={BUTTON_GHOST}>
                Add to my shelf
              </button>
            </div>
          </form>
        )}
        <p className="mt-3 min-h-5 text-sm" role="status" aria-live="polite">
          {note}
        </p>
        <p className="text-xs text-muted-foreground">
          The barcode is read on this phone; only its number goes to Open Beauty Facts (open data).
          Products you add are kept on this device.
        </p>
      </SectionCard>

      {(result.gaps.length > 0 || result.clashes.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {result.gaps.length > 0 && (
            <SectionCard title="Worth adding">
              <ul className="space-y-3 text-sm">
                {result.gaps.map((gap) => (
                  <li key={gap} className="flex gap-3">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                    {gap}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          {result.clashes.length > 0 && (
            <SectionCard title="Space these out">
              <ul className="space-y-3 text-sm">
                {result.clashes.map((clash) => (
                  <li key={clash.products.join("|") + clash.actives.join("|")}>
                    <p className="font-semibold">
                      {clash.products[0]} and {clash.products[1]}
                    </p>
                    <p className="text-muted-foreground">{clash.advice}</p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>
      )}

      <section aria-labelledby="on-shelf" className="space-y-3">
        <h2
          id="on-shelf"
          className="label-tracking text-xs font-bold text-muted-foreground uppercase"
        >
          On your shelf
        </h2>
        {products.length === 0 ? (
          <SectionCard>
            <p className="text-muted-foreground">
              Nothing here yet. Scan the barcode on anything you use, or pick from the products on
              your{" "}
              <Link to="/routine" className="font-semibold text-primary hover:underline">
                routine
              </Link>{" "}
              page.
            </p>
          </SectionCard>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {products.map((product, index) => {
              const insight = productInsight(product);
              return (
                <Reveal
                  as="li"
                  key={product.id}
                  delay={index * 60}
                  className="surface lift min-w-0 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold">{product.name}</p>
                      {product.brand && (
                        <p className="text-sm text-muted-foreground">{product.brand}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(product)}
                      aria-label={`Take ${product.name} off your shelf`}
                      className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge tone="outline">{ROLE_LABEL[insight.role]}</Badge>
                    {insight.actives.map((active) => (
                      <Badge key={active} tone="primary">
                        {ACTIVE_LABEL[active]}
                      </Badge>
                    ))}
                    {insight.hydrates && <Badge tone="success">Hydrating</Badge>}
                  </div>
                  {insight.helps.length > 0 && (
                    <p className="mt-3 text-sm">
                      <span className="text-muted-foreground">Helps with </span>
                      {insight.helps.join("; ")}
                    </p>
                  )}
                  {!product.ingredients.trim() && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      No ingredient list yet, so this reads the name only.
                    </p>
                  )}
                  {insight.watch.length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {insight.watch.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </Reveal>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Reads ingredient names, not strengths. General cosmetic guidance, not medical advice.
      </p>
    </div>
  );
}
