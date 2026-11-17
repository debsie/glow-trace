import type { ScanCategory } from "../types";

/**
 * The agent's fixed care knowledge: what each indicator means, what each product does,
 * and which actives should not share a routine. General cosmetic guidance only.
 */

/** A thing the agent can help with. Each maps to one indicator from the analysis report. */
export type Concern =
  | "redness"
  | "texture"
  | "dryness"
  | "tone"
  | "porosity"
  | "dullness"
  | "thinning"
  | "staining"
  | "spots"
  | "ridges"
  | "protection";

export type ConcernSpec = {
  area: ScanCategory;
  /** Indicator key in the analysis report. */
  metric: string;
  /** Legacy care-dimension key used by older scans without a report. */
  legacyMetric?: string;
  label: string;
  /** Plain sentence used when this concern is the focus. */
  focusLine: string;
  /** Short habit that helps regardless of products. */
  habit: string;
};

export const CONCERNS: Record<Exclude<Concern, "protection">, ConcernSpec> = {
  redness: {
    area: "skin",
    metric: "erythema",
    legacyMetric: "redness",
    label: "Redness",
    focusLine: "Your skin is reading redder than ideal, so calming comes before anything active.",
    habit: "Rinse with lukewarm water, not hot, and skip scrubs until it settles.",
  },
  texture: {
    area: "skin",
    metric: "texture",
    label: "Texture",
    focusLine: "The surface is reading uneven. Gentle, regular exfoliation helps most.",
    habit: "Exfoliate at most twice a week. More than that roughens skin instead.",
  },
  dryness: {
    area: "skin",
    metric: "hydration",
    legacyMetric: "dryness",
    label: "Hydration",
    focusLine: "Hydration is low. Rebuilding your barrier is the quickest win.",
    habit: "Apply moisturiser within a minute of washing, while skin is still damp.",
  },
  tone: {
    area: "skin",
    metric: "discoloration",
    label: "Even tone",
    focusLine: "Colour is reading patchy. Daily sunscreen matters more than any serum here.",
    habit: "Reapply sunscreen every two hours outdoors. Marks fade faster when protected.",
  },
  porosity: {
    area: "hair",
    metric: "porosity",
    label: "Porosity",
    focusLine: "Strands are reading rough and open, so they lose moisture fast.",
    habit: "Rinse conditioner out with cool water to help the cuticle lie flat.",
  },
  dullness: {
    area: "hair",
    metric: "shine",
    label: "Shine",
    focusLine: "Hair is reading dull. Sealing moisture in brings the shine back.",
    habit: "Finish with a few drops of oil on the lengths, not the roots.",
  },
  thinning: {
    area: "hair",
    metric: "density",
    label: "Even coverage",
    focusLine: "Coverage is reading patchy. Scalp care and less tension can help.",
    habit: "Loosen tight styles and avoid pulling on the same spot every day.",
  },
  staining: {
    area: "nails",
    metric: "yellowness",
    label: "Staining",
    focusLine: "Nails are reading yellowed, often from dark polish without a base coat.",
    habit: "Always wear a base coat under coloured polish.",
  },
  spots: {
    area: "nails",
    metric: "spots",
    label: "Spots",
    focusLine: "Marks are standing out on the nail. Most are knocks and grow out.",
    habit: "Wear gloves for cleaning and treat nails as jewels, not tools.",
  },
  ridges: {
    area: "nails",
    metric: "ridges",
    label: "Ridges",
    focusLine: "Ridges are showing. That usually means a dry nail plate.",
    habit: "Massage cuticle oil in every night. It takes about six weeks to see a change.",
  },
};

export type Active =
  "retinoid" | "aha" | "bha" | "vitamin-c" | "niacinamide" | "azelaic" | "spf" | "oil" | "protein";

export type ProductProfile = {
  area: ScanCategory;
  addresses: Concern[];
  actives: Active[];
  when: "am" | "pm" | "any";
  /** Suitable while skin is red or sensitive. */
  gentle: boolean;
  /** One sentence: how to use it. */
  howTo: string;
};

/** Profiles for the catalogue's products, keyed by product id. */
export const PRODUCT_PROFILES: Record<string, ProductProfile> = {
  p_centella: {
    area: "skin",
    addresses: ["redness"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "Two or three drops after cleansing, morning and night.",
  },
  p_hydrab5: {
    area: "skin",
    addresses: ["dryness", "redness"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "Last step at night, and under sunscreen in the morning.",
  },
  p_bha: {
    area: "skin",
    addresses: ["texture"],
    actives: ["bha"],
    when: "pm",
    gentle: false,
    howTo: "Swipe over clean skin two evenings a week. Not on retinoid nights.",
  },
  p_vitc: {
    area: "skin",
    addresses: ["tone"],
    actives: ["vitamin-c"],
    when: "am",
    gentle: false,
    howTo: "Three drops in the morning, before sunscreen.",
  },
  p_gentlecleanse: {
    area: "skin",
    addresses: ["redness", "dryness"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "Massage onto dry skin, then rinse with lukewarm water.",
  },
  p_niacinamide: {
    area: "skin",
    addresses: ["tone", "texture"],
    actives: ["niacinamide"],
    when: "any",
    gentle: true,
    howTo: "A few drops after cleansing. Pairs well with almost everything.",
  },
  p_azelaic: {
    area: "skin",
    addresses: ["redness", "tone"],
    actives: ["azelaic"],
    when: "any",
    gentle: true,
    howTo: "A thin layer once a day to start, then twice if comfortable.",
  },
  p_retinal: {
    area: "skin",
    addresses: ["texture", "tone"],
    actives: ["retinoid"],
    when: "pm",
    gentle: false,
    howTo: "A pea-sized amount two nights a week, building up slowly.",
  },
  p_spf50: {
    area: "skin",
    addresses: ["protection", "tone"],
    actives: ["spf"],
    when: "am",
    gentle: true,
    howTo: "Two finger-lengths as the last morning step, every day.",
  },
  p_bond: {
    area: "hair",
    addresses: ["porosity"],
    actives: ["protein"],
    when: "any",
    gentle: true,
    howTo: "Once a week on damp hair before shampoo, for 10 minutes.",
  },
  p_leavein: {
    area: "hair",
    addresses: ["porosity", "dullness"],
    actives: ["protein"],
    when: "any",
    gentle: true,
    howTo: "Work through damp lengths after every wash.",
  },
  p_glossoil: {
    area: "hair",
    addresses: ["dullness"],
    actives: ["oil"],
    when: "any",
    gentle: true,
    howTo: "Two drops warmed in your palms, smoothed over the ends.",
  },
  p_heatshield: {
    area: "hair",
    addresses: ["porosity", "dullness"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "Mist through every section before heat styling.",
  },
  p_scalp: {
    area: "hair",
    addresses: ["thinning"],
    actives: ["niacinamide"],
    when: "pm",
    gentle: true,
    howTo: "A dropper on the scalp at night, massaged in for a minute.",
  },
  p_nailoil: {
    area: "nails",
    addresses: ["ridges", "spots"],
    actives: ["oil"],
    when: "pm",
    gentle: true,
    howTo: "One drop per nail at night, massaged into the cuticle.",
  },
  p_basecoat: {
    area: "nails",
    addresses: ["staining"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "One thin coat under every colour.",
  },
  p_nailstrength: {
    area: "nails",
    addresses: ["ridges", "spots"],
    actives: ["protein"],
    when: "any",
    gentle: true,
    howTo: "Two coats, topped up every second day for two weeks.",
  },
  p_stainlift: {
    area: "nails",
    addresses: ["staining"],
    actives: ["aha"],
    when: "any",
    gentle: true,
    howTo: "Buff in once a week on bare nails, then rinse.",
  },
  p_ridgefill: {
    area: "nails",
    addresses: ["ridges"],
    actives: [],
    when: "any",
    gentle: true,
    howTo: "One coat as a smooth base, alone or under colour.",
  },
};

/** Active pairs that should not share a routine, and what to do instead. */
export const CONFLICTS: { pair: [Active, Active]; advice: string }[] = [
  {
    pair: ["retinoid", "aha"],
    advice: "Use the retinoid and the acid on different nights.",
  },
  {
    pair: ["retinoid", "bha"],
    advice: "Use the retinoid and the BHA on different nights.",
  },
  {
    pair: ["vitamin-c", "bha"],
    advice: "Vitamin C in the morning, BHA in the evening.",
  },
  {
    pair: ["vitamin-c", "aha"],
    advice: "Vitamin C in the morning, acids in the evening.",
  },
  {
    pair: ["aha", "bha"],
    advice: "Two exfoliants is too much at once. Alternate them.",
  },
];

/** Concerns that point to a DIY recipe in the catalogue. */
export const DIY_FOR: Partial<Record<Concern, string>> = {
  redness: "p_diy_aloe",
  dryness: "p_diy_avocado",
  texture: "p_diy_turmeric",
  tone: "p_diy_turmeric",
  porosity: "p_diy_rice",
  dullness: "p_diy_rice",
  ridges: "p_diy_avocado",
};
