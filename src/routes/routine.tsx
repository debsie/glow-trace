import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FlaskConical, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, GhostButton, PageHeader, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { activeNeeds, matchShelf } from "@/lib/beauty";

export const Route = createFileRoute("/routine")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — Daily Treatment Routine" },
      {
        name: "description",
        content: "Match today's AI recommendations to the products on your shelf, with DIY alternatives.",
      },
      { property: "og:title", content: "Glowtrace AI — Daily Treatment Routine" },
      {
        property: "og:description",
        content: "Match today's AI recommendations to the products on your shelf, with DIY alternatives.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoutinePage,
});

/* A missing product gets two honest paths: buy it, or make it at home. */
const MissingProductCard = ({
  need,
  productName,
  brand,
  ingredients,
  diyName,
  diyRecipe,
}: {
  need: string;
  productName: string;
  brand: string;
  ingredients: string;
  diyName: string;
  diyRecipe: string;
}) => {
  const [tab, setTab] = useState<"buy" | "diy">("buy");
  return (
    <div className="rounded-3xl border border-warning/40 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="font-display font-bold text-warning">Missing Product</p>
          <p className="text-sm text-muted-foreground">{need}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2" role="tablist" aria-label={`Resolve missing product for ${need}`}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "buy"}
          onClick={() => setTab("buy")}
          className={`min-h-[50px] rounded-2xl border px-3 text-sm font-bold transition-colors ${
            tab === "buy" ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground"
          }`}
        >
          <ShoppingBag className="mr-1 inline h-4 w-4" aria-hidden="true" /> Buy Recommended
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "diy"}
          onClick={() => setTab("diy")}
          className={`min-h-[50px] rounded-2xl border px-3 text-sm font-bold transition-colors ${
            tab === "diy" ? "border-accent bg-accent/15 text-accent" : "border-border bg-card text-muted-foreground"
          }`}
        >
          <FlaskConical className="mr-1 inline h-4 w-4" aria-hidden="true" /> DIY Alternative
        </button>
      </div>
      {tab === "buy" ? (
        <div className="mt-4">
          <p className="font-display text-lg font-bold">{productName}</p>
          <p className="text-sm text-muted-foreground">{brand}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ingredients}</p>
          <PrimaryButton className="mt-3" onClick={() => toast.success(`${productName} added to your cart.`)}>
            Add to cart
          </PrimaryButton>
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-display text-lg font-bold text-accent">{diyName}</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {diyRecipe.split("\n").map((line) => (
              <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Patch-test first; stop if irritation occurs.</p>
        </div>
      )}
    </div>
  );
};

function RoutinePage() {
  const { scans, inventory, catalog } = useAppState();
  const latest = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) {
    return (
      <div className="space-y-4">
        <PageHeader title="Daily Treatment Routine" subtitle="Run a scan first and your routine builds itself." />
        <SectionCard>
          <p className="text-muted-foreground">No scans yet — head to the Scan tab to analyze skin, hair or nails.</p>
        </SectionCard>
      </div>
    );
  }

  const needs = activeNeeds(latest.biomarkers, latest.category);
  const matches = matchShelf(needs, inventory, catalog);
  const inStockProducts = catalog.filter((product) =>
    inventory.some((item) => item.product_id === product.id && item.in_stock && !product.is_diy),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Treatment Routine"
        subtitle={`Built from your latest ${latest.category} scan · ${new Date(latest.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
      />

      <SectionCard title="My Library — on your shelf">
        <div className="flex flex-wrap gap-2">
          {inStockProducts.map((product) => (
            <Badge key={product.id} tone="success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {product.name}
            </Badge>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-4">
        <h2 className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Today's recommended routine
        </h2>
        {matches.map((match) =>
          match.inStock ? (
            <SectionCard key={match.need.id}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">{match.need.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {match.product.name} · {match.product.brand}
                  </p>
                </div>
                <Badge tone="success">On your shelf</Badge>
              </div>
            </SectionCard>
          ) : (
            <MissingProductCard
              key={match.need.id}
              need={match.need.label}
              productName={match.product.name}
              brand={match.product.brand}
              ingredients={match.product.ingredients}
              diyName={match.diy?.name ?? "DIY remedy"}
              diyRecipe={match.diy?.recipe_instructions ?? "Combine gentle kitchen ingredients and patch-test first."}
            />
          ),
        )}
        {matches.length === 0 && (
          <SectionCard>
            <p className="text-muted-foreground">Your biomarkers look balanced — a gentle cleanse, hydrate and protect day.</p>
            <GhostButton className="mt-3" onClick={() => toast("Maintenance mode: SPF and hydration only.")}>
              View maintenance plan
            </GhostButton>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
