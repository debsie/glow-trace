import { gaugesFor } from "../beauty";
import type { ScanRecord, InventoryItem, Product, ScanCategory } from "../types";
import type { Active, Concern, ConcernSpec, ProductProfile } from "./knowledge";
import { CONCERNS, CONFLICTS, DIY_FOR, PRODUCT_PROFILES } from "./knowledge";

/**
 * The personal care agent. Pure functions over the person's own scans and shelf:
 * nothing here touches the network, and the same inputs always give the same advice.
 */

export type Severity = "focus" | "watch" | "good";
export type Trend = "improving" | "worsening" | "steady" | "new";

export type Finding = {
  concern: Exclude<Concern, "protection">;
  area: ScanCategory;
  label: string;
  /** The indicator's raw reading, 0-100. */
  value: number;
  /** 0-100, higher is healthier, whatever the indicator's direction. */
  health: number;
  severity: Severity;
  trend: Trend;
  /** Change in health since the previous scan of this area; null on the first. */
  change: number | null;
  line: string;
  habit: string;
};

export type Suggestion = {
  product: Product;
  profile: ProductProfile;
  concerns: Concern[];
  /** 0-100: how much of this area's need the product covers. */
  match: number;
  onShelf: boolean;
  why: string;
  conflict: string | null;
  diy: Product | null;
};

export type Briefing = {
  findings: Finding[];
  suggestions: Suggestion[];
  /** Areas with no scored scan yet. */
  unscanned: ScanCategory[];
  headline: string;
};

const FOCUS_BELOW = 45;
const WATCH_BELOW = 65;
const TREND_NOISE = 2;
const AREAS: ScanCategory[] = ["skin", "hair", "nails"];
const SEVERITY_WEIGHT: Record<Severity, number> = { focus: 3, watch: 1.5, good: 0 };

/** 0-100 health per indicator key for one scan (report first, older scans by legacy key). */
const healthByMetric = (scan: ScanRecord): Map<string, { value: number; health: number }> => {
  const result = new Map<string, { value: number; health: number }>();
  if (scan.report && !scan.demo && scan.report.metrics.length > 0) {
    for (const metric of scan.report.metrics) {
      result.set(metric.key, {
        value: metric.value,
        health: metric.higherMeans === "better" ? metric.value : 100 - metric.value,
      });
    }
    return result;
  }
  for (const gauge of gaugesFor(scan.category, scan.biomarkers)) {
    const higherIsBetter = gauge.caption.startsWith("Higher is better");
    result.set(gauge.key, {
      value: gauge.value,
      health: higherIsBetter ? gauge.value : 100 - gauge.value,
    });
  }
  return result;
};

const reading = (scan: ScanRecord, spec: ConcernSpec) => {
  const metrics = healthByMetric(scan);
  return (
    metrics.get(spec.metric) ?? (spec.legacyMetric ? metrics.get(spec.legacyMetric) : undefined)
  );
};

const severityFor = (health: number): Severity =>
  health < FOCUS_BELOW ? "focus" : health < WATCH_BELOW ? "watch" : "good";

/** What stands out in the latest scan of each area, worst first. */
export const findingsFor = (scans: readonly ScanRecord[]): Finding[] => {
  const findings: Finding[] = [];
  for (const area of AREAS) {
    const history = scans
      .filter((scan) => scan.category === area && !scan.demo)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const [latest, previous] = history;
    if (!latest) continue;
    for (const [concern, spec] of Object.entries(CONCERNS) as [Finding["concern"], ConcernSpec][]) {
      if (spec.area !== area) continue;
      const now = reading(latest, spec);
      if (!now) continue;
      const before = previous ? reading(previous, spec) : undefined;
      const change = before ? Math.round((now.health - before.health) * 10) / 10 : null;
      const trend: Trend =
        change === null
          ? "new"
          : change > TREND_NOISE
            ? "improving"
            : change < -TREND_NOISE
              ? "worsening"
              : "steady";
      findings.push({
        concern,
        area,
        label: spec.label,
        value: now.value,
        health: Math.round(now.health * 10) / 10,
        severity: severityFor(now.health),
        trend,
        change,
        line: spec.focusLine,
        habit: spec.habit,
      });
    }
  }
  const rank = (finding: Finding) =>
    SEVERITY_WEIGHT[finding.severity] * 100 +
    (finding.trend === "worsening" ? 50 : 0) -
    finding.health;
  return findings.sort((a, b) => rank(b) - rank(a));
};

const activesOn = (productIds: readonly string[]): Map<Active, string> => {
  const map = new Map<Active, string>();
  for (const id of productIds) {
    for (const active of PRODUCT_PROFILES[id]?.actives ?? []) map.set(active, id);
  }
  return map;
};

/** Advice when a product's actives clash with something already on the shelf. */
export const conflictWith = (
  productId: string,
  shelfIds: readonly string[],
  catalog: readonly Product[],
): string | null => {
  const actives = PRODUCT_PROFILES[productId]?.actives ?? [];
  const shelf = activesOn(shelfIds.filter((id) => id !== productId));
  for (const { pair, advice } of CONFLICTS) {
    for (const [mine, theirs] of [pair, [pair[1], pair[0]] as const]) {
      if (!actives.includes(mine)) continue;
      const otherId = shelf.get(theirs);
      if (!otherId) continue;
      const other = catalog.find((product) => product.id === otherId);
      return `${advice} You have ${other?.name ?? "a product"} on your shelf.`;
    }
  }
  return null;
};

/** Product suggestions for the findings that need attention, best first. */
export const suggestProducts = (
  findings: readonly Finding[],
  catalog: readonly Product[],
  inventory: readonly InventoryItem[],
): Suggestion[] => {
  const shelfIds = inventory.filter((item) => item.in_stock).map((item) => item.product_id);
  const needs = findings.filter((finding) => finding.severity !== "good");
  const redSkin = findings.some(
    (finding) => finding.concern === "redness" && finding.severity === "focus",
  );
  const scannedSkin = findings.some((finding) => finding.area === "skin");
  const suggestions: Suggestion[] = [];

  for (const product of catalog) {
    const profile = PRODUCT_PROFILES[product.id];
    if (!profile || product.is_diy) continue;
    const areaNeeds = needs.filter((finding) => finding.area === profile.area);
    const covered = areaNeeds.filter((finding) => profile.addresses.includes(finding.concern));
    // Sunscreen is suggested to everyone with a skin scan: it protects every other result.
    const protects = profile.addresses.includes("protection") && scannedSkin;
    if (covered.length === 0 && !protects) continue;
    // While skin is red, hold back strong actives rather than make it worse.
    if (redSkin && profile.area === "skin" && !profile.gentle) continue;

    const total = areaNeeds.reduce((sum, finding) => sum + SEVERITY_WEIGHT[finding.severity], 0);
    const weight = covered.reduce((sum, finding) => sum + SEVERITY_WEIGHT[finding.severity], 0);
    // Match = how much of the area's need it covers, plus how serious that need is.
    const coverage = weight / Math.max(total, 1);
    const intensity =
      covered.reduce((sum, finding) => sum + (100 - finding.health) / 100, 0) /
      Math.max(covered.length, 1);
    const match =
      protects && covered.length === 0
        ? 60
        : Math.min(98, Math.max(40, Math.round(35 + 35 * coverage + 30 * intensity)));
    const onShelf = shelfIds.includes(product.id);
    const top = covered[0];
    const why = top
      ? `For ${covered.map((finding) => finding.label.toLowerCase()).join(" and ")}, your ${top.severity === "focus" ? "main focus" : "one to watch"} in ${profile.area}.`
      : "Daily sunscreen protects every other result.";
    const diyId = covered.map((finding) => DIY_FOR[finding.concern]).find(Boolean);
    suggestions.push({
      product,
      profile,
      concerns: covered.map((finding) => finding.concern),
      match,
      onShelf,
      why,
      conflict: onShelf ? null : conflictWith(product.id, shelfIds, catalog),
      diy: (diyId && catalog.find((item) => item.id === diyId)) || null,
    });
  }

  // What you already own first, then by how well it fits, then fewer clashes.
  return suggestions.sort(
    (a, b) =>
      Number(b.onShelf) - Number(a.onShelf) ||
      b.match - a.match ||
      Number(a.conflict !== null) - Number(b.conflict !== null),
  );
};

export const briefing = (
  scans: readonly ScanRecord[],
  catalog: readonly Product[],
  inventory: readonly InventoryItem[],
): Briefing => {
  const findings = findingsFor(scans);
  const suggestions = suggestProducts(findings, catalog, inventory);
  const unscanned = AREAS.filter((area) => !findings.some((finding) => finding.area === area));
  const top = findings[0];
  const headline = !top
    ? "Run your first scan and I'll build your plan from it."
    : top.severity === "good"
      ? "Everything is reading well. Keep your routine steady and protect what you have."
      : `${top.label} in your ${top.area} is the place to start. ${top.line}`;
  return { findings, suggestions, unscanned, headline };
};

/* ---------- Questions ---------- */

export type Intent = "focus" | "products" | "routine" | "conflicts" | "progress" | "habits";

export const QUICK_QUESTIONS: { intent: Intent; label: string }[] = [
  { intent: "focus", label: "What should I focus on?" },
  { intent: "products", label: "Which products should I use?" },
  { intent: "routine", label: "When do I use them?" },
  { intent: "conflicts", label: "Is my shelf safe to mix?" },
  { intent: "progress", label: "Am I improving?" },
  { intent: "habits", label: "What habits help most?" },
];

const KEYWORDS: [Intent, RegExp][] = [
  ["conflicts", /\b(mix|together|combine|safe|clash|conflict|layer)/i],
  // Progress before routine: "am I getting better" is about progress, not the morning.
  ["progress", /\b(improv|better|worse|progress|change|trend)/i],
  ["routine", /\b(when|morning|night|evening|order|routine)\b/i],
  ["habits", /\b(habit|tip|lifestyle|stop|avoid|without)/i],
  ["products", /\b(product|buy|use|recommend|serum|cream|oil|shampoo|polish|suggest)/i],
  ["focus", /\b(focus|priority|worst|problem|start|what.*do)/i],
];

/** Match free text to an intent; null when nothing fits, so the UI can offer the questions. */
export const intentFor = (text: string): Intent | null =>
  KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;

export type Answer = { paragraphs: string[]; productIds: string[] };

const list = (items: readonly string[]) =>
  items.length <= 1
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/** Answer one question from the briefing and the shelf. */
export const answer = (
  intent: Intent,
  brief: Briefing,
  catalog: readonly Product[],
  inventory: readonly InventoryItem[],
): Answer => {
  const needs = brief.findings.filter((finding) => finding.severity !== "good");
  if (brief.findings.length === 0) {
    return {
      paragraphs: [
        "I don't have a scan to go on yet. Run a skin, hair or nail scan and ask again.",
      ],
      productIds: [],
    };
  }
  switch (intent) {
    case "focus": {
      if (needs.length === 0) {
        return { paragraphs: [brief.headline], productIds: [] };
      }
      const [first, ...rest] = needs;
      return {
        paragraphs: [
          `Start with ${first?.label.toLowerCase()} in your ${first?.area}: it reads ${first?.health} out of 100 for health. ${first?.line}`,
          ...(rest.length
            ? [
                `After that: ${list(rest.slice(0, 3).map((finding) => `${finding.label.toLowerCase()} (${finding.area})`))}.`,
              ]
            : []),
        ],
        productIds: [],
      };
    }
    case "products": {
      const picks = brief.suggestions.slice(0, 3);
      if (picks.length === 0) {
        return {
          paragraphs: ["Nothing needs a new product right now. Keep using what's working."],
          productIds: [],
        };
      }
      const owned = picks.filter((pick) => pick.onShelf).map((pick) => pick.product.name);
      return {
        paragraphs: [
          owned.length
            ? `You already own ${list(owned)}. Use ${owned.length === 1 ? "it" : "them"} before buying anything.`
            : "These fit your results best:",
        ],
        productIds: picks.map((pick) => pick.product.id),
      };
    }
    case "routine": {
      const shelf = inventory
        .filter((item) => item.in_stock)
        .map((item) => catalog.find((product) => product.id === item.product_id))
        .filter((product): product is Product => Boolean(product));
      const by = (when: "am" | "pm") =>
        shelf.filter((product) => {
          const profile = PRODUCT_PROFILES[product.id];
          return profile && (profile.when === when || profile.when === "any");
        });
      const am = by("am").map((product) => product.name);
      const pm = by("pm").map((product) => product.name);
      return {
        paragraphs: [
          am.length ? `Morning: ${list(am)}.` : "Morning: cleanse, moisturise and sunscreen.",
          pm.length ? `Evening: ${list(pm)}.` : "Evening: cleanse and moisturise.",
          "Thinnest texture first, thickest last, and sunscreen always last in the morning.",
        ],
        productIds: [],
      };
    }
    case "conflicts": {
      const shelfIds = inventory.filter((item) => item.in_stock).map((item) => item.product_id);
      const clashes = shelfIds
        .map((id) => conflictWith(id, shelfIds, catalog))
        .filter((advice): advice is string => advice !== null);
      return {
        paragraphs: clashes.length
          ? [...new Set(clashes)]
          : ["Nothing on your shelf clashes. You can layer it all as it is."],
        productIds: [],
      };
    }
    case "progress": {
      const moved = brief.findings.filter((finding) => finding.change !== null);
      if (moved.length === 0) {
        return {
          paragraphs: [
            "I need two scans of the same area to see a trend. Scan again in about two weeks.",
          ],
          productIds: [],
        };
      }
      const better = moved
        .filter((finding) => finding.trend === "improving")
        .map((finding) => finding.label.toLowerCase());
      const worse = moved
        .filter((finding) => finding.trend === "worsening")
        .map((finding) => finding.label.toLowerCase());
      return {
        paragraphs: [
          better.length ? `Improving: ${list(better)}.` : "Nothing has clearly improved yet.",
          worse.length
            ? `Slipping: ${list(worse)}. Check your light and angle match your last scan before changing anything.`
            : "Nothing has slipped.",
        ],
        productIds: [],
      };
    }
    case "habits":
      return {
        paragraphs: (needs.length ? needs : brief.findings)
          .slice(0, 3)
          .map((finding) => finding.habit),
        productIds: [],
      };
  }
};
