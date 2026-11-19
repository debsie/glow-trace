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

/* ---------- Topics: what people ask, answered in plain words ---------- */

/** What a topic's personal line can read: the person's latest results, never photos. */
export type TopicContext = {
  /** Latest finding per indicator label (lower case), health 0-100 and trend. */
  findings: ReadonlyMap<string, { health: number; trend: string; area: ScanCategory }>;
  face: { noseRedness: number; darkCircles: number; skinType: string } | null;
  zones: { forehead: number; leftCheek: number; rightCheek: number; chin: number } | null;
  hairLength: { band: string; state: string } | null;
  shelf: readonly string[];
};

export type Topic = {
  id: string;
  title: string;
  /** Words and phrases people use for it; matched loosely (see agent/retrieve.ts). */
  keys: readonly string[];
  /** The general answer: short, plain, wellness only. */
  body: readonly string[];
  /** One line built from the person's own results, or null when there is nothing to add. */
  personal?: (context: TopicContext) => string | null;
};

const reading = (context: TopicContext, label: string) => context.findings.get(label) ?? null;
const trendWord = (trend: string) =>
  trend === "improving" ? "and improving" : trend === "worsening" ? "and slipping" : "and steady";

export const TOPICS: readonly Topic[] = [
  {
    id: "pigmentation",
    title: "Dark marks and pigmentation",
    keys: [
      "dark spot",
      "dark mark",
      "pigment",
      "hyperpigmentation",
      "melasma",
      "uneven tone",
      "patchy",
      "marks after pimples",
      "acne marks",
      "discolouration",
      "discoloration",
      "brown patch",
    ],
    body: [
      "Dark marks fade with time and protection. Daily sunscreen matters more than any serum: without it, marks keep darkening.",
      "Gentle brighteners help on top: niacinamide, azelaic acid or vitamin C. Go slowly, because irritation can leave new marks on deeper skin tones.",
      "Expect weeks, not days. Your trend will show it once it's real.",
    ],
    personal: (c) => {
      const tone = reading(c, "even tone");
      return tone
        ? `Your even tone reads ${tone.health.toFixed(1)} ${trendWord(tone.trend)}.`
        : null;
    },
  },
  {
    id: "sunscreen",
    title: "Sunscreen, including on deeper skin",
    keys: [
      "sunscreen",
      "spf",
      "sun block",
      "sunblock",
      "white cast",
      "sun protection",
      "uv",
      "do i need sunscreen",
      "dark skin sunscreen",
    ],
    body: [
      "Every skin tone needs daily sunscreen: it protects against dark marks and uneven tone as well as burning.",
      "On deeper skin, choose a tinted or chemical-filter SPF 30 or higher to avoid a white cast.",
      "Use about two finger-lengths for face and neck, as the last step of your morning routine, and top up every two hours outdoors.",
    ],
  },
  {
    id: "dark-circles",
    title: "Dark circles",
    keys: [
      "dark circle",
      "under eye",
      "under-eye",
      "eye bags",
      "panda eyes",
      "tired eyes",
      "darkness under my eyes",
    ],
    body: [
      "Dark circles come from thin skin, shadows, pigment and tiredness, so they move with sleep, salt and screens.",
      "What helps: steady sleep, sunscreen right up to the eye area, and a gentle eye cream with caffeine or niacinamide.",
      "Glowtrace compares the skin under your eyes with your own cheekbone, so every skin tone is read the same way. Take scans in similar light to compare.",
    ],
    personal: (c) =>
      c.face
        ? `Your latest dark-circles reading is ${c.face.darkCircles.toFixed(1)}. Watch the trend rather than one number.`
        : null,
  },
  {
    id: "nose-redness",
    title: "Redness on the nose and cheeks",
    keys: [
      "red nose",
      "nose redness",
      "redness on my nose",
      "red cheeks",
      "flushing",
      "flush",
      "rosy",
      "redness",
    ],
    body: [
      "Redness on the nose and cheeks often follows heat, sun, spicy food, alcohol, hot showers and harsh products.",
      "Calm first: lukewarm water, a gentle cleanser, a plain moisturiser and daily sunscreen. Pause scrubs and strong acids until it settles.",
      "If redness comes with bumps, burning or stinging that won't settle, have a doctor or dermatologist take a look.",
    ],
    personal: (c) =>
      c.face
        ? `Redness on your nose reads ${c.face.noseRedness.toFixed(1)}.${c.zones ? ` Your cheeks read ${((c.zones.leftCheek + c.zones.rightCheek) / 2).toFixed(1)} and your forehead ${c.zones.forehead.toFixed(1)}.` : ""}`
        : null,
  },
  {
    id: "skin-type",
    title: "Your skin type",
    keys: [
      "skin type",
      "oily",
      "combination",
      "dry skin",
      "normal skin",
      "shiny",
      "t-zone",
      "t zone",
      "greasy",
    ],
    body: [
      "Skin type changes with weather, hormones and products. Glowtrace reads it from shine on your nose against your cheeks.",
      "Oily: a gel moisturiser and a matte sunscreen. Combination: lighter on the T-zone, richer on the cheeks. Dry: a richer cream on damp skin.",
    ],
    personal: (c) => (c.face ? `Today you read as ${c.face.skinType} skin.` : null),
  },
  {
    id: "breakouts",
    title: "Breakouts",
    keys: [
      "pimple",
      "breakout",
      "acne",
      "spot",
      "zit",
      "blemish",
      "break out",
      "breaking out",
      "chin breakout",
      "hormonal",
    ],
    body: [
      "Breakouts calm with consistency: a gentle cleanser twice a day, a non-comedogenic moisturiser and a BHA (salicylic acid) a few evenings a week.",
      "Don't pick: it leaves marks that last longer than the spot, especially on deeper skin.",
      "Chin and jaw breakouts often follow your cycle. Painful, deep or scarring breakouts deserve a doctor's visit.",
    ],
    personal: (c) =>
      c.zones
        ? `Your chin and jaw redness reads ${c.zones.chin.toFixed(1)}, your forehead ${c.zones.forehead.toFixed(1)}.`
        : null,
  },
  {
    id: "makeup-skin",
    title: "Makeup and your skin",
    keys: [
      "makeup",
      "make up",
      "foundation",
      "concealer",
      "primer",
      "remove makeup",
      "makeup remover",
      "sleep in makeup",
      "makeup breakout",
    ],
    body: [
      "Prep well, wear what suits your skin type, and take it all off the same night: an oil or balm first, then your usual cleanser.",
      "Plan a Makeup day in Routine, and Glowtrace asks for a scan the day before and the day after, so you can see what your makeup does to your skin.",
    ],
  },
  {
    id: "ashy",
    title: "Ashy, dry-looking skin",
    keys: ["ashy", "ash", "grey skin", "dull skin", "dry patches", "flaky", "rough skin", "dull"],
    body: [
      "Ashiness is dry skin catching the light. Moisturise straight after washing, while skin is damp, and seal with a richer cream or a few drops of oil.",
      "Short, lukewarm showers and a gentle exfoliant once or twice a week help too.",
    ],
    personal: (c) => {
      const hydration = reading(c, "hydration");
      return hydration
        ? `Your hydration reads ${hydration.health.toFixed(1)} ${trendWord(hydration.trend)}.`
        : null;
    },
  },
  {
    id: "texture-pores",
    title: "Texture and pores",
    keys: [
      "texture",
      "pores",
      "bumpy",
      "rough",
      "uneven texture",
      "big pores",
      "large pores",
      "smooth",
    ],
    body: [
      "Pores don't open and close, but they look smaller when clean and moisturised.",
      "An exfoliating acid (AHA or BHA) two or three evenings a week smooths texture. More often roughens skin instead.",
    ],
    personal: (c) => {
      const texture = reading(c, "texture");
      return texture
        ? `Your skin texture reads ${texture.health.toFixed(1)} ${trendWord(texture.trend)}.`
        : null;
    },
  },
  {
    id: "retinol",
    title: "Retinol and retinoids",
    keys: [
      "retinol",
      "retinoid",
      "retinal",
      "tretinoin",
      "vitamin a",
      "anti-aging",
      "anti ageing",
      "wrinkles",
      "fine lines",
    ],
    body: [
      "Start retinol two evenings a week, a pea-sized amount on dry skin, then build up. Some dryness at first is normal.",
      "Keep it apart from acids on the same night, always wear sunscreen in the morning, and skip it during pregnancy or breastfeeding: ask your doctor first.",
    ],
  },
  {
    id: "niacinamide",
    title: "Niacinamide",
    keys: ["niacinamide", "vitamin b3", "b3"],
    body: [
      "Niacinamide is gentle and works morning or night: it helps redness, oiliness, marks and the skin barrier.",
      "It pairs well with most things, including retinol and sunscreen. Start around 5%.",
    ],
  },
  {
    id: "vitamin-c",
    title: "Vitamin C",
    keys: ["vitamin c", "vit c", "ascorbic", "brightening serum"],
    body: [
      "Vitamin C works best in the morning, under sunscreen: it brightens and helps fade marks.",
      "Keep it away from acids on the same routine, and store it closed and cool, because it spoils in light and air.",
    ],
  },
  {
    id: "acids",
    title: "Exfoliating acids (AHA and BHA)",
    keys: [
      "aha",
      "bha",
      "acid",
      "glycolic",
      "lactic",
      "salicylic",
      "exfoliant",
      "exfoliate",
      "peel",
      "chemical exfoliant",
    ],
    body: [
      "BHA (salicylic acid) clears pores and suits oily or breakout-prone skin. AHA (glycolic or lactic) smooths texture and dullness.",
      "Use them in the evening, two or three times a week, never on the same night as retinol, and wear sunscreen every morning.",
    ],
  },
  {
    id: "pregnancy",
    title: "Skincare in pregnancy",
    keys: ["pregnant", "pregnancy", "breastfeeding", "expecting", "baby"],
    body: [
      "Many people skip retinoids and high-strength salicylic acid while pregnant or breastfeeding. Check every product with your doctor or midwife.",
      "Usually considered gentle: a mild cleanser, moisturiser, sunscreen, niacinamide and azelaic acid. Confirm with your doctor first.",
    ],
  },
  {
    id: "hair-length",
    title: "Hair length and growth",
    keys: [
      "hair length",
      "length",
      "grow",
      "growth",
      "longer",
      "length retention",
      "retention",
      "how long",
      "bra strap",
      "apl",
      "bsl",
      "waist length",
      "my hair isn't growing",
      "not growing",
    ],
    body: [
      "Most hair grows 1 to 1.5 cm a month. The real question is keeping it: length is lost to breakage at the ends.",
      "Protect the ends: moisturise and seal them, trim only split ends, sleep on satin or silk, and go easy on heat and tight styles.",
      "Take a length photo each month, stretched against stretched or natural against natural, and Glowtrace shows your growth.",
    ],
    personal: (c) =>
      c.hairLength ? `Your latest length is ${c.hairLength.band} (${c.hairLength.state}).` : null,
  },
  {
    id: "shrinkage",
    title: "Shrinkage",
    keys: [
      "shrinkage",
      "shrink",
      "coily",
      "4c",
      "4b",
      "4a",
      "type 4",
      "stretched",
      "natural hair",
      "wash and go",
    ],
    body: [
      "Shrinkage is a sign of healthy, elastic coils, not lost length: type 4 hair can look up to 75% shorter than its stretched length.",
      "To compare fairly, Glowtrace asks whether your hair is stretched or natural, and only compares like with like.",
    ],
  },
  {
    id: "protective-styles",
    title: "Braids, wigs and protective styles",
    keys: [
      "braid",
      "braids",
      "box braids",
      "cornrows",
      "wig",
      "weave",
      "locs",
      "twists",
      "protective style",
      "extensions",
      "frontal",
    ],
    body: [
      "Protective styles rest your ends, but tension is the risk: if it hurts, or you see bumps at the hairline, it's too tight.",
      "Keep styles to six to eight weeks, moisturise your scalp and lengths, and give your edges a break between installs.",
      "While your hair is in a style, Glowtrace only reads your scalp, and picks up lengths and ends when it's out.",
    ],
  },
  {
    id: "edges",
    title: "Edges and hairline",
    keys: ["edges", "hairline", "thinning edges", "traction", "bald patch", "receding", "temples"],
    body: [
      "Thinning edges are most often from tension: tight braids, ponytails, wigs glued or clipped at the hairline.",
      "Loosen styles, avoid glue and heavy edge control, and massage the hairline gently. Early tension thinning often recovers when the pulling stops.",
      "If a patch is smooth, sore, scaly or spreading, have a doctor or dermatologist look at it.",
    ],
  },
  {
    id: "relaxer-heat",
    title: "Relaxers, colour and heat",
    keys: [
      "relaxer",
      "relax",
      "perm",
      "colour",
      "color",
      "dye",
      "bleach",
      "heat damage",
      "flat iron",
      "straightener",
      "blow dry",
      "silk press",
    ],
    body: [
      "Chemical and heat treatments change texture and readings, so log them: then a jump in your trend has a reason.",
      "Relax only new growth, every eight to twelve weeks. Always use heat protectant, and keep irons at the lowest heat that works.",
      "Add a protein treatment now and then, balanced with moisture.",
    ],
  },
  {
    id: "hair-dry",
    title: "Dry, frizzy or rough hair",
    keys: [
      "dry hair",
      "frizz",
      "frizzy",
      "rough hair",
      "porosity",
      "high porosity",
      "low porosity",
      "brittle",
      "breakage",
      "breaking",
      "split ends",
      "ends",
    ],
    body: [
      "Dry or rough hair is losing moisture through a lifted cuticle. Use a leave-in, then seal with an oil or butter, and rinse conditioner out with cool water.",
      "Cut back on heat and sulphate shampoos. Trim split ends: they keep splitting upwards.",
    ],
    personal: (c) => {
      const porosity = reading(c, "porosity");
      return porosity
        ? `Your hair texture reads ${porosity.health.toFixed(1)} ${trendWord(porosity.trend)}.`
        : null;
    },
  },
  {
    id: "shine",
    title: "Hair shine",
    keys: ["shine", "shiny", "shiny hair", "dull hair", "lustre", "gloss"],
    body: [
      "Shine comes from a smooth cuticle reflecting light: moisture, a light oil on the lengths, gentle detangling and less heat all help.",
      "A cool rinse after conditioning helps the cuticle lie flat.",
    ],
  },
  {
    id: "scalp",
    title: "Scalp, flakes and itch",
    keys: [
      "scalp",
      "dandruff",
      "flakes",
      "flaky scalp",
      "itchy scalp",
      "itch",
      "build up",
      "buildup",
      "oily scalp",
      "dry scalp",
    ],
    body: [
      "White flakes can be dry scalp or dandruff. A gentle wash every week or two, and scalp care with zinc pyrithione or salicylic acid, helps most people.",
      "Rinse out heavy oils and products that build up. If the itch, redness or scaling doesn't settle, see a doctor or dermatologist.",
    ],
  },
  {
    id: "grey-hair",
    title: "Grey hair",
    keys: ["grey", "gray", "white hair", "silver", "greys"],
    body: [
      "Grey hair is often drier and coarser, so it loves moisture and a gentle purple shampoo now and then to keep it bright.",
      "Sun can yellow it: a hat or UV hair mist helps.",
    ],
  },
  {
    id: "thinning",
    title: "Thinning hair and shedding",
    keys: [
      "thinning",
      "shedding",
      "hair loss",
      "losing hair",
      "hair falling out",
      "fall out",
      "crown",
      "parting",
      "density",
      "bald",
    ],
    body: [
      "Losing 50 to 100 hairs a day is normal. Sudden heavy shedding often follows stress, illness, a new baby or diet changes, two to three months later.",
      "Gentle styling, enough protein and iron, and no tight styles help. Sudden, patchy or worsening loss is worth a doctor's visit.",
    ],
    personal: (c) => {
      const thinning = reading(c, "density variance") ?? reading(c, "thinning");
      return thinning
        ? `Your coverage reading is ${thinning.health.toFixed(1)} ${trendWord(thinning.trend)}.`
        : null;
    },
  },
  {
    id: "nail-yellow",
    title: "Yellow or stained nails",
    keys: [
      "yellow nails",
      "yellow",
      "stained",
      "stain",
      "discoloured nails",
      "nail colour",
      "polish stain",
    ],
    body: [
      "Dark polish without a base coat is the usual cause of yellow nails. It fades as the nail grows out, over three to six months.",
      "Always use a base coat, and take polish breaks. Yellowing with thickening or crumbling should be checked by a doctor.",
    ],
    personal: (c) => {
      const stain = reading(c, "yellowness") ?? reading(c, "staining");
      return stain
        ? `Your nail yellowing reads ${stain.health.toFixed(1)} ${trendWord(stain.trend)}.`
        : null;
    },
  },
  {
    id: "nail-ridges",
    title: "Ridges and weak nails",
    keys: [
      "ridges",
      "ridge",
      "lines on nails",
      "weak nails",
      "brittle nails",
      "peeling nails",
      "splitting nails",
      "soft nails",
    ],
    body: [
      "Fine lengthwise ridges are common and grow more noticeable with age and dryness.",
      "Massage cuticle oil in every evening, wear gloves for washing up, and file gently in one direction. Sudden deep ridges across the nail are worth showing a doctor.",
    ],
  },
  {
    id: "cuticles",
    title: "Cuticles",
    keys: ["cuticle", "cuticles", "hangnail", "hangnails", "dry cuticles"],
    body: [
      "Don't cut cuticles: they protect the nail. Push them back gently after a shower, and oil them every evening.",
      "Hangnails: clip the loose bit cleanly, never pull.",
    ],
  },
  {
    id: "gel-acrylic",
    title: "Gel, acrylics and manicures",
    keys: [
      "gel",
      "acrylic",
      "acrylics",
      "manicure",
      "nail art",
      "press on",
      "nail polish",
      "polish",
      "gel polish",
    ],
    body: [
      "Gel and acrylics are fine with good removal: soak off properly and never pry. Thin, peeling nails afterwards come from removal, not the colour.",
      "Plan breaks between sets, and use cuticle oil daily. Glowtrace reads nails best bare: plan a manicure check-in to see the before and after.",
    ],
  },
  {
    id: "scan-tips",
    title: "Taking a good scan",
    keys: [
      "how to scan",
      "scan tips",
      "photo tips",
      "lighting",
      "light",
      "accurate",
      "accuracy",
      "different reading",
      "why did my score change",
      "inconsistent",
      "filter",
    ],
    body: [
      "Face a window in daylight, no flash, no filters or beauty mode, and keep the same spot and time of day.",
      "Readings move a little between photos: that's why Glowtrace only calls a change real when it's 95% sure across several scans.",
    ],
  },
  {
    id: "scores",
    title: "What the scores mean",
    keys: [
      "what does the score mean",
      "score",
      "scores",
      "meaning",
      "what is a good score",
      "out of 100",
      "numbers",
      "indicator",
    ],
    body: [
      "Each indicator is 0 to 100. On the health view, higher is healthier. They're wellness indicators for tracking your own change, not a diagnosis or a comparison with anyone else.",
      "Watch the direction over weeks rather than any single number.",
    ],
  },
  {
    id: "privacy",
    title: "Privacy and your photos",
    keys: ["privacy", "private", "photos", "data", "upload", "who sees", "safe", "delete my data"],
    body: [
      "Your photos and scans are analysed and kept on this phone. They're never uploaded unless you choose to share a photo for training.",
      "You can download or delete everything from the Privacy page at any time.",
    ],
  },
  {
    id: "water-diet",
    title: "Water, food and sleep",
    keys: [
      "water",
      "drink",
      "diet",
      "food",
      "sugar",
      "dairy",
      "sleep",
      "stress",
      "vitamins",
      "supplements",
    ],
    body: [
      "Steady sleep, enough water, protein and colourful food support skin, hair and nails. No single food fixes or causes everything.",
      "If you suspect a trigger, such as dairy or sugar for breakouts, change one thing for four weeks and watch your trend.",
    ],
  },
];
