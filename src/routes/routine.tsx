import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FlaskConical, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import {
  Badge,
  GhostButton,
  PageHeader,
  PrimaryButton,
  ProBadge,
  SectionCard,
} from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { activeNeeds, matchShelf } from "@/lib/beauty";
import type { BlockedGate, RoutineMode } from "@/lib/plans";
import { PLANS, routineModeGate } from "@/lib/plans";
import { ROUTINE_MODES, routineModeSpec } from "@/lib/routines";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/routine")({
  head: () =>
    pageHead({
      title: "Daily Skincare Routine From Your Own Shelf — Glowtrace",
      description:
        "Morning, evening, pre-makeup and barrier-reset routines built from your latest check-in and the products you already own, with DIY options when something's missing.",
      path: "/routine",
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
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div>
          <p className="font-display font-semibold text-warning">Missing Product</p>
          <p className="text-sm text-muted-foreground">{need}</p>
        </div>
      </div>
      <div
        className="mt-4 grid grid-cols-2 gap-2"
        role="tablist"
        aria-label={`Resolve missing product for ${need}`}
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "buy"}
          onClick={() => setTab("buy")}
          className={`min-h-[50px] rounded-2xl border px-3 text-sm font-semibold transition-colors ${
            tab === "buy"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          <ShoppingBag className="mr-1 inline h-4 w-4" aria-hidden="true" /> Buy Recommended
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "diy"}
          onClick={() => setTab("diy")}
          className={`min-h-[50px] rounded-2xl border px-3 text-sm font-semibold transition-colors ${
            tab === "diy"
              ? "border-accent bg-accent/15 text-accent"
              : "border-border bg-card text-muted-foreground"
          }`}
        >
          <FlaskConical className="mr-1 inline h-4 w-4" aria-hidden="true" /> DIY Alternative
        </button>
      </div>
      {tab === "buy" ? (
        <div className="mt-4">
          <p className="font-display text-lg font-semibold">{productName}</p>
          <p className="text-sm text-muted-foreground">{brand}</p>
          <p className="mt-1 text-xs text-muted-foreground">{ingredients}</p>
          <PrimaryButton
            className="mt-3"
            onClick={() => toast.success(`${productName} added to your cart.`)}
          >
            Add to cart
          </PrimaryButton>
        </div>
      ) : (
        <div className="mt-4">
          <p className="font-display text-lg font-semibold text-accent">{diyName}</p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {diyRecipe.split("\n").map((line) => (
              <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">
            Patch-test first; stop if irritation occurs.
          </p>
        </div>
      )}
    </div>
  );
};

function RoutinePage() {
  const { scans, inventory, catalog, tier, shelfCount, toggleShelfProduct } = useAppState();
  const [mode, setMode] = useState<RoutineMode>("am");
  const [blocked, setBlocked] = useState<BlockedGate | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const latest = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (!latest) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Daily Treatment Routine"
          subtitle="Run a scan first and your routine builds itself."
        />
        <SectionCard>
          <p className="text-muted-foreground">
            No scans yet — head to the Scan tab to analyze skin, hair or nails.
          </p>
        </SectionCard>
      </div>
    );
  }

  const needs = activeNeeds(latest.biomarkers, latest.category);
  const matches = matchShelf(needs, inventory, catalog);
  const inStockProducts = catalog.filter((product) =>
    inventory.some((item) => item.product_id === product.id && item.in_stock && !product.is_diy),
  );
  const shelfCap = PLANS[tier].limits.shelfProducts;
  const shelfCandidates = catalog.filter((product) => !product.is_diy);
  // A downgrade mid-session falls back to a routine the plan still includes.
  const activeMode = routineModeSpec(routineModeGate(tier, mode).allowed ? mode : "am");

  const pickMode = (next: RoutineMode) => {
    const gate = routineModeGate(tier, next);
    if (!gate.allowed) {
      setBlocked(gate);
      return;
    }
    setBlocked(null);
    setMode(next);
  };

  const toggleProduct = (productId: string) => {
    const gate = toggleShelfProduct(productId);
    setBlocked(gate.allowed ? null : gate);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Treatment Routine"
        subtitle={`Built from your latest ${latest.category} scan · ${new Date(latest.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Routine">
        {ROUTINE_MODES.map((spec) => {
          const locked = !routineModeGate(tier, spec.id).allowed;
          const selected = activeMode.id === spec.id;
          return (
            <button
              key={spec.id}
              type="button"
              aria-pressed={selected}
              onClick={() => pickMode(spec.id)}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-sm font-bold transition-colors ${
                selected
                  ? "bg-primary border-transparent text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {spec.label}
              {locked && <ProBadge />}
            </button>
          );
        })}
      </div>

      {blocked && <UpgradeCard gate={blocked} onDismiss={() => setBlocked(null)} />}

      <SectionCard title={`${activeMode.label} routine`}>
        <p className="text-sm text-muted-foreground">{activeMode.summary}</p>
        <ol className="mt-3 list-inside list-decimal space-y-1.5 text-sm text-foreground">
          {activeMode.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        title={`On your shelf · ${shelfCount} of ${shelfCap}`}
        action={
          <button
            type="button"
            aria-expanded={shelfOpen}
            onClick={() => setShelfOpen((open) => !open)}
            className="inline-flex min-h-[50px] items-center rounded-lg px-4 text-sm font-semibold text-primary hover:underline"
          >
            {shelfOpen ? "Done" : "Edit shelf"}
          </button>
        }
      >
        {shelfOpen ? (
          <ul className="space-y-2">
            {shelfCandidates.map((product) => {
              const onShelf = inventory.some(
                (item) => item.product_id === product.id && item.in_stock,
              );
              return (
                <li key={product.id}>
                  <button
                    type="button"
                    aria-pressed={onShelf}
                    onClick={() => toggleProduct(product.id)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {product.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.brand}
                      </span>
                    </span>
                    <Badge tone={onShelf ? "success" : "outline"}>
                      {onShelf ? "On shelf" : "Add"}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex flex-wrap gap-2">
            {inStockProducts.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing on your shelf yet — tap Edit shelf to add what you own.
              </p>
            )}
            {inStockProducts.map((product) => (
              <Badge key={product.id} tone="success">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {product.name}
              </Badge>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="space-y-4">
        <h2 className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Matched to your latest check-in
        </h2>
        {matches.map((match) =>
          match.inStock ? (
            <SectionCard key={match.need.id}>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold">{match.need.label}</p>
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
              diyRecipe={
                match.diy?.recipe_instructions ??
                "Combine gentle kitchen ingredients and patch-test first."
              }
            />
          ),
        )}
        {matches.length === 0 && (
          <SectionCard>
            <p className="text-muted-foreground">
              Your biomarkers look balanced — a gentle cleanse, hydrate and protect day.
            </p>
            <GhostButton
              className="mt-3"
              onClick={() => toast("Maintenance mode: SPF and hydration only.")}
            >
              View maintenance plan
            </GhostButton>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
