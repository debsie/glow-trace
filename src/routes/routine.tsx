import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, Check, ChevronDown, Copy, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { useTicks } from "@/components/engagement/use-ticks";
import { UpgradeCard } from "@/components/billing/upgrade-card";
import { MakeupDayPanel } from "@/components/makeup/makeup-day-panel";
import { Badge, PageHeader, ProBadge, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { activeNeeds, matchShelf } from "@/lib/beauty";
import { routineDone } from "@/lib/daily";
import { dayKey } from "@/lib/engagement";
import { longDate } from "@/lib/progress";
import type { BlockedGate, RoutineMode } from "@/lib/plans";
import { PLANS, routineModeGate } from "@/lib/plans";
import { routineModeSpec } from "@/lib/routines";
import { pageHead } from "@/lib/seo";
import { listAsText, loadList, saveList, toggleItem } from "@/lib/shopping-list";
import type { ListItem } from "@/lib/shopping-list";

const TABS = ["am", "makeup", "pm", "reset"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/routine")({
  validateSearch: z.object({ tab: z.enum(TABS).optional().catch(undefined) }),
  head: () =>
    pageHead({
      title: "Daily Skincare Routine From Your Own Shelf — Glowtrace",
      description:
        "Morning, makeup day, evening and reset routines built from your latest check-in and the products you already own, with at-home options when something's missing.",
      path: "/routine",
    }),
  component: RoutinePage,
});

/** In the order of a day: wake up, maybe makeup, wind down; reset is for rough patches. */
const TAB_LABELS: Record<Tab, { label: string; hint: string }> = {
  am: { label: "Morning", hint: "Wake up and protect" },
  makeup: { label: "Makeup day", hint: "Prep, wear, take it off" },
  pm: { label: "Evening", hint: "Wind down and repair" },
  reset: { label: "Reset", hint: "When skin feels upset" },
};

const NeedRow = ({
  need,
  product,
  brand,
  ingredients,
  onShelf,
  saved,
  onSave,
  diyName,
  diyRecipe,
}: {
  need: string;
  product: string;
  brand: string;
  ingredients: string;
  onShelf: boolean;
  saved: boolean;
  onSave: () => void;
  diyName: string | null;
  diyRecipe: string | null;
}) => {
  const [diyOpen, setDiyOpen] = useState(false);
  return (
    <li className="py-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
            onShelf ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
          }`}
          aria-hidden="true"
        >
          {onShelf ? (
            <Check className="h-4 w-4" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{need}</p>
          {onShelf ? (
            <p className="text-sm text-muted-foreground">
              You've already got this covered with{" "}
              <span className="text-foreground">{product}</span>.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Nothing on your shelf does this yet. We'd reach for{" "}
                <span className="font-semibold text-foreground">{product}</span> by {brand}.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">What's in it: {ingredients}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={saved}
                  onClick={onSave}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors ${
                    saved
                      ? "border-transparent bg-secondary text-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  }`}
                >
                  {saved ? (
                    <BookmarkCheck className="h-4 w-4 text-accent" aria-hidden="true" />
                  ) : (
                    <Bookmark className="h-4 w-4" aria-hidden="true" />
                  )}
                  {saved ? "On your list" : "Save to my list"}
                </button>
                {diyName && diyRecipe && (
                  <button
                    type="button"
                    aria-expanded={diyOpen}
                    onClick={() => setDiyOpen((open) => !open)}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Or make it at home
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${diyOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
              {diyOpen && diyName && diyRecipe && (
                <div className="mt-3 rounded-xl border border-border p-4">
                  <p className="font-semibold">{diyName}</p>
                  <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                    {diyRecipe.split("\n").map((line) => (
                      <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
                    ))}
                  </ol>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Try a little on your inner arm first and stop if it stings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
};

function RoutinePage() {
  const { ticks, toggle } = useTicks();
  const { tab: tabFromLink } = Route.useSearch();
  const { scans, inventory, catalog, tier, shelfCount, toggleShelfProduct } = useAppState();
  const [tab, setTab] = useState<Tab>(tabFromLink ?? "am");
  const [blocked, setBlocked] = useState<BlockedGate | null>(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [list, setList] = useState<ListItem[]>([]);
  useEffect(() => setList(loadList()), []);
  useEffect(() => {
    if (tabFromLink) setTab(tabFromLink);
  }, [tabFromLink]);

  const latest = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const latestSkin = scans
    .filter((scan) => scan.category === "skin" && !scan.demo && scan.report)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

  if (!latest) {
    return (
      <div className="space-y-6">
        <PageHeader title="Your routine" subtitle="One scan and we'll build it around you." />
        <SectionCard>
          <p className="text-muted-foreground">
            Nothing to build from yet. Take a quick scan and your routine shows up here.
          </p>
          <Link
            to="/scan"
            className="mt-4 inline-flex min-h-[50px] items-center rounded-lg bg-primary px-6 font-semibold text-primary-foreground"
          >
            Take my first scan
          </Link>
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

  const pick = (next: Tab) => {
    if (next !== "makeup") {
      const gate = routineModeGate(tier, next as RoutineMode);
      if (!gate.allowed) {
        setBlocked(gate);
        return;
      }
    }
    setBlocked(null);
    setTab(next);
  };

  const toggleSaved = (item: Omit<ListItem, "addedAt">) => {
    const next = toggleItem(list, { ...item, addedAt: new Date().toISOString() });
    setList(next);
    saveList(next);
  };

  const share = async () => {
    const text = listAsText(list);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch {
      // Cancelled or unsupported: fall back to WhatsApp.
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(listAsText(list));
      toast.success("Copied. Paste it wherever you keep your lists.");
    } catch {
      toast("Couldn't copy here. Try Share instead.");
    }
  };

  const steps = tab === "makeup" ? null : routineModeSpec(tab as RoutineMode);
  const today = dayKey(new Date());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your routine"
        subtitle={`Built around your ${latest.category} scan from ${longDate(latest.created_at)}.`}
      />

      <div role="tablist" aria-label="Routine" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABS.map((id) => {
          const selected = tab === id;
          const locked = id !== "makeup" && !routineModeGate(tier, id as RoutineMode).allowed;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => pick(id)}
              className={`flex min-h-[64px] flex-col items-start justify-center rounded-2xl border px-4 text-left transition-colors ${
                selected
                  ? "border-foreground/20 bg-secondary"
                  : "border-border bg-card hover:bg-secondary/60"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {TAB_LABELS[id].label}
                {locked && <ProBadge />}
              </span>
              <span className="text-xs text-muted-foreground">{TAB_LABELS[id].hint}</span>
            </button>
          );
        })}
      </div>

      {blocked && <UpgradeCard gate={blocked} onDismiss={() => setBlocked(null)} />}

      {tab === "makeup" ? (
        <MakeupDayPanel report={latestSkin?.report ?? null} tier={tier} />
      ) : (
        steps && (
          <SectionCard>
            <p className="text-sm text-muted-foreground">{steps.summary}</p>
            <ol className="mt-4 space-y-2">
              {steps.steps.map((step, index) => {
                const ticked = ticks[today]?.[tab]?.includes(index) ?? false;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={ticked}
                      onClick={() => toggle(today, tab, index)}
                      className={`flex min-h-[56px] w-full items-center gap-4 rounded-2xl border px-4 text-left transition-colors ${
                        ticked ? "border-primary bg-secondary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          ticked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                        aria-hidden="true"
                      >
                        {ticked && <Check className="h-4 w-4" />}
                      </span>
                      <span className="readout w-6 shrink-0 text-sm text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className={ticked ? "text-muted-foreground" : "text-foreground"}>
                        {step}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-sm" aria-live="polite">
              {routineDone(ticks, today, tab, steps.steps.length)
                ? `${TAB_LABELS[tab].label} done. That counts towards your daily streak.`
                : "Tick each step as you go. A finished routine counts towards your daily streak."}
            </p>
          </SectionCard>
        )
      )}

      <section aria-labelledby="asks" className="space-y-2">
        <h2 id="asks" className="font-display text-2xl font-semibold">
          What your {latest.category} is asking for
        </h2>
        {matches.length === 0 ? (
          <p className="text-muted-foreground">
            Honestly, not much right now. Keep up the basics: cleanse, hydrate, sunscreen.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {matches.map((match) => (
              <NeedRow
                key={match.need.id}
                need={match.need.label}
                product={match.product.name}
                brand={match.product.brand}
                ingredients={match.product.ingredients}
                onShelf={match.inStock}
                saved={list.some((item) => item.productId === match.product.id)}
                onSave={() =>
                  toggleSaved({
                    productId: match.product.id,
                    name: match.product.name,
                    brand: match.product.brand,
                    forNeed: match.need.label,
                  })
                }
                diyName={match.diy?.name ?? null}
                diyRecipe={match.diy?.recipe_instructions ?? null}
              />
            ))}
          </ul>
        )}
      </section>

      {list.length > 0 && (
        <SectionCard title="Your shopping list">
          <p className="text-sm text-muted-foreground">
            Take it to the shop, or send it to yourself. Prices from local stores are coming soon.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {list.map((item) => (
              <li key={item.productId} className="flex min-h-[56px] items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.brand} · for {item.forNeed.toLowerCase()}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${item.name} from your list`}
                  onClick={() => toggleSaved(item)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void share()}
              className="inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-border bg-secondary px-5 font-semibold"
            >
              <Send className="h-4 w-4" aria-hidden="true" /> Share list
            </button>
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex min-h-[50px] items-center gap-2 rounded-lg px-5 font-semibold text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-4 w-4" aria-hidden="true" /> Copy
            </button>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title={`What's on your shelf · ${shelfCount} of ${shelfCap}`}
        action={
          <button
            type="button"
            aria-expanded={shelfOpen}
            onClick={() => setShelfOpen((open) => !open)}
            className="inline-flex min-h-[44px] items-center rounded-lg px-3 text-sm font-semibold text-primary hover:underline"
          >
            {shelfOpen ? "Done" : "Update"}
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
                    onClick={() => {
                      const gate = toggleShelfProduct(product.id);
                      setBlocked(gate.allowed ? null : gate);
                    }}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 text-left hover:bg-secondary/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{product.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {product.brand}
                      </span>
                    </span>
                    <Badge tone={onShelf ? "success" : "outline"}>
                      {onShelf ? "I have this" : "Add"}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : inStockProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tell us what you already own and we'll build around it before suggesting anything new.
          </p>
        ) : (
          <p className="text-sm text-foreground">
            {inStockProducts.map((product) => product.name).join(" · ")}
          </p>
        )}
      </SectionCard>
    </div>
  );
}
