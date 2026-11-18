import type {
  Biomarkers,
  EventLook,
  InventoryItem,
  LookStatus,
  Product,
  ScanCategory,
  ScanReport,
} from "./types";
import { reportScore } from "./cv/kernel";

/** Pure Glowtrace logic: gauge specs, shelf matching, lookbook status. */

export type Gauge = {
  key: keyof Biomarkers;
  label: string;
  value: number;
  /** Starts with the direction ("Higher means more" / "Higher is better"), then one plain sentence. */
  caption: string;
};

const GAUGE_LABELS: Record<keyof Biomarkers, string> = {
  redness: "Redness",
  texture: "Texture Coarseness",
  dryness: "Hydration",
  porosity: "Hydration / Porosity",
  discoloration: "Discoloration",
};

const GAUGE_CAPTIONS: Record<keyof Biomarkers, string> = {
  redness: "Higher means more. How red the tone reads.",
  texture: "Higher means more. How uneven the surface looks.",
  dryness: "Higher is better. Smooth, lightly glowing surfaces score higher.",
  porosity: "Higher means more. How open and rough the surface looks.",
  discoloration: "Higher means more. How patchy the colour is.",
};

const invertKeys: ReadonlySet<keyof Biomarkers> = new Set(["dryness"]);

export const gaugesFor = (category: ScanCategory, b: Biomarkers): Gauge[] => {
  const keys: (keyof Biomarkers)[] =
    category === "skin"
      ? ["redness", "texture", "dryness"]
      : category === "hair"
        ? ["porosity", "texture", "dryness"]
        : ["dryness", "texture", "discoloration"];
  return keys.map((key) => ({
    key,
    label: GAUGE_LABELS[key],
    caption: GAUGE_CAPTIONS[key],
    value: invertKeys.has(key) ? 100 - b[key] : b[key],
  }));
};

/** A scan's overall score: from the on-device report when there is one. Higher is healthier. */
export const scanScore = (scan: {
  biomarkers: Biomarkers;
  report?: ScanReport | undefined;
}): number => (scan.report ? reportScore(scan.report) : null) ?? wellnessScore(scan.biomarkers);

/** Higher is healthier. */
export const wellnessScore = (b: Biomarkers): number =>
  Math.round(100 - (b.redness + b.dryness + b.texture + b.porosity + b.discoloration) / 5);

export const scoreVerdict = (score: number): string =>
  score >= 80
    ? "Excellent"
    : score >= 65
      ? "Balanced"
      : score >= 50
        ? "Needs care"
        : "Priority care";

/* ---------- Shelf matcher ---------- */

export type CareNeed = {
  id: string;
  label: string;
  biomarker: keyof Biomarkers;
  threshold: number;
  recommendedProductId: string;
};

export const CARE_NEEDS: CareNeed[] = [
  {
    id: "calm",
    label: "Calm & soothe redness",
    biomarker: "redness",
    threshold: 35,
    recommendedProductId: "p_centella",
  },
  {
    id: "hydrate",
    label: "Deep hydration & barrier repair",
    biomarker: "dryness",
    threshold: 35,
    recommendedProductId: "p_hydrab5",
  },
  {
    id: "smooth",
    label: "Smooth & refine texture",
    biomarker: "texture",
    threshold: 35,
    recommendedProductId: "p_bha",
  },
  {
    id: "strength",
    label: "Rebuild hair strength",
    biomarker: "porosity",
    threshold: 40,
    recommendedProductId: "p_bond",
  },
  {
    id: "brighten",
    label: "Brighten discoloration",
    biomarker: "discoloration",
    threshold: 35,
    recommendedProductId: "p_vitc",
  },
  {
    id: "nails",
    label: "Nourish nails & cuticles",
    biomarker: "dryness",
    threshold: 35,
    recommendedProductId: "p_nailoil",
  },
];

export const activeNeeds = (b: Biomarkers, category: ScanCategory): CareNeed[] =>
  CARE_NEEDS.filter((need) => {
    const categoryFit =
      need.id === "strength"
        ? category === "hair"
        : need.id === "nails"
          ? category === "nails"
          : need.id === "smooth"
            ? category !== "nails"
            : true;
    return categoryFit && b[need.biomarker] >= need.threshold;
  });

export const DIY_ALTERNATIVES: Record<string, string> = {
  calm: "p_diy_aloe",
  hydrate: "p_diy_avocado",
  smooth: "p_diy_turmeric",
  strength: "p_diy_rice",
  brighten: "p_diy_turmeric",
  nails: "p_diy_avocado",
};

export type ShelfMatch = {
  need: CareNeed;
  product: Product;
  inStock: boolean;
  diy: Product | undefined;
};

export const matchShelf = (
  needs: CareNeed[],
  inventory: InventoryItem[],
  catalog: Product[],
): ShelfMatch[] =>
  needs.map((need) => {
    const product = catalog.find((p) => p.id === need.recommendedProductId);
    const inStock =
      product !== undefined &&
      inventory.some((item) => item.product_id === product.id && item.in_stock);
    const diyId = DIY_ALTERNATIVES[need.id];
    return {
      need,
      product: product ?? {
        id: need.recommendedProductId,
        name: "Recommended product",
        brand: "Glowtrace",
        category: "skincare",
        ingredients: "",
        is_diy: false,
      },
      inStock,
      diy: diyId ? catalog.find((p) => p.id === diyId) : undefined,
    };
  });

/* ---------- Lookbook ---------- */

export const LOOK_STATUS_META: Record<
  LookStatus,
  { label: string; tone: "muted" | "accent" | "success"; icon: "edit" | "send" | "check" }
> = {
  drafting: { label: "Drafting", tone: "muted", icon: "edit" },
  sent: { label: "Sent for Client Approval", tone: "accent", icon: "send" },
  approved: { label: "Approved by Client", tone: "success", icon: "check" },
};

export const approveLook = (look: EventLook, clientNotes?: string): EventLook => {
  const notes = clientNotes?.trim();
  return {
    ...look,
    status: "approved",
    approved: true,
    ...(notes ? { client_notes: notes } : {}),
  };
};

export const sendLook = (look: EventLook): EventLook =>
  look.status === "drafting" ? { ...look, status: "sent" } : look;

export const lookForClient = (looks: EventLook[], clientId: string): EventLook | undefined =>
  looks.find((look) => look.client_id === clientId);

export const latestScanFor = (scans: { created_at: string }[], category?: ScanCategory) => {
  const pool = category
    ? scans.filter((s) => ("category" in s ? s.category === category : false))
    : scans;
  return [...pool].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
};
