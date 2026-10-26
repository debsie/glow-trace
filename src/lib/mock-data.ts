import type {
  Biomarkers,
  Client,
  DiagnosticScan,
  EventLook,
  InventoryItem,
  LightingPreset,
  Product,
  Profile,
  ScanCategory,
} from "./types";

import scanSkin from "@/assets/scan-skin.jpg";
import scanHair from "@/assets/scan-hair.jpg";
import scanNails from "@/assets/scan-nails.jpg";

export const OCCASIONS = ["Wedding", "Red Carpet", "Editorial", "HD Film"] as const;

export const LIGHTING_PRESETS: LightingPreset[] = ["Daylight 5000K", "Studio Flash", "Warm Candlelight"];

export const MOCK_PROFILE: Profile = {
  id: "u_ava",
  email: "ava.reyes@glowtrace.ai",
  display_name: "Ava Reyes",
  role: "mua",
  subscription_tier: "enterprise",
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: "c_sophia",
    mua_id: "u_ava",
    client_name: "Sophia Vance",
    contact_info: "sophia.vance@mail.com · +1 415 220 8841",
    skin_type: "Combination · Sensitive",
    notes: "Met Gala fitting on the 12th. Prefers minimal fragrance. Sensitive to alcohol-based toners.",
  },
  {
    id: "c_maya",
    mua_id: "u_ava",
    client_name: "Maya Chen",
    contact_info: "maya.chen@mail.com · +1 310 555 0172",
    skin_type: "Oily",
    notes: "Shoots weekly editorial campaigns. Loves glossy lid looks.",
  },
  {
    id: "c_imani",
    mua_id: "u_ava",
    client_name: "Imani Okafor",
    contact_info: "imani.o@mail.com · +1 646 555 9033",
    skin_type: "Dry · Dehydrated",
    notes: "Bridal client for June. Needs barrier-friendly prep, no retinoids within 5 days of the event.",
  },
  {
    id: "c_lena",
    mua_id: "u_ava",
    client_name: "Lena Kovač",
    contact_info: "lena.kovac@mail.com · +1 718 555 2244",
    skin_type: "Normal",
    notes: "Film actress — HD camera work. Avoids SPF flash-back ingredients on set.",
  },
  {
    id: "c_priya",
    mua_id: "u_ava",
    client_name: "Priya Nair",
    contact_info: "priya.nair@mail.com · +1 408 555 6190",
    skin_type: "Combination",
    notes: "Wig collector; prefers glueless install for quick changes backstage.",
  },
];

export const MOCK_CATALOG: Product[] = [
  { id: "p_centella", name: "Centella Calm Serum", brand: "Dew Lab", category: "skincare", ingredients: "Centella Asiatica 8%, Panthenol, Madecassoside", is_diy: false },
  { id: "p_hydrab5", name: "Hydra-B5 Barrier Cream", brand: "Dew Lab", category: "skincare", ingredients: "Hyaluronic Acid, Vitamin B5, Ceramide NP", is_diy: false },
  { id: "p_bha", name: "2% BHA Polish Toner", brand: "Clearline", category: "skincare", ingredients: "Salicylic Acid 2%, Willow Bark, Green Tea", is_diy: false },
  { id: "p_vitc", name: "Vitamin C Glow Concentrate", brand: "Lumea", category: "skincare", ingredients: "THD Ascorbate 12%, Ferulic Acid, Squalane", is_diy: false },
  { id: "p_bond", name: "Bond Repair Treatment", brand: "Strand Theory", category: "haircare", ingredients: "Bis-aminopropyl diglycol dimaleate, Hydrolyzed keratin", is_diy: false },
  { id: "p_nailoil", name: "Hydrating Nail & Cuticle Oil", brand: "Lacquer Lab", category: "nailcare", ingredients: "Jojoba oil, Vitamin E, Squalane", is_diy: false },
  { id: "p_basecoat", name: "Flex Gel Base Coat", brand: "Lacquer Lab", category: "nailcare", ingredients: "HEMA-free gel polymer, Biotin", is_diy: false },
  { id: "p_satinbase", name: "Satin Finish Foundation N4", brand: "Vellum Pro", category: "makeup", ingredients: "Water, Glycerin, Dimethicone, Iron oxides (neutral cool)", is_diy: false },
  { id: "p_diy_avocado", name: "Avocado Hydration Mask", brand: "Home Kitchen", category: "skincare", ingredients: "Avocado, honey, colloidal oats", is_diy: true, recipe_instructions: "1. Mash half a ripe avocado with 1 tbsp honey and 2 tbsp colloidal oats.\n2. Apply a thick layer to clean skin.\n3. Rest for 15 minutes, rinse with lukewarm water.\n4. Follow with barrier cream. Use up to 2× per week." },
  { id: "p_diy_rice", name: "Fermented Rice Water Rinse", brand: "Home Kitchen", category: "haircare", ingredients: "Rice water, fermented 24–48h", is_diy: true, recipe_instructions: "1. Rinse ½ cup rice, soak in 2 cups water for 24–48h until slightly sour.\n2. After shampooing, pour over mid-lengths and ends.\n3. Leave 5 minutes, then condition.\n4. Use weekly for protein rebuilding." },
  { id: "p_diy_aloe", name: "Aloe & Oat Calm Mask", brand: "Home Kitchen", category: "skincare", ingredients: "Aloe vera gel, colloidal oats, cucumber", is_diy: true, recipe_instructions: "1. Blend 3 tbsp aloe gel with 1 tbsp colloidal oats and chilled cucumber pulp.\n2. Apply to flushed areas for 10 minutes.\n3. Rinse cool and pat dry. Safe for daily use during flare-ups." },
  { id: "p_diy_turmeric", name: "Turmeric & Yogurt Brightening Mask", brand: "Home Kitchen", category: "skincare", ingredients: "Greek yogurt, turmeric, lemon-free", is_diy: true, recipe_instructions: "1. Mix 2 tbsp Greek yogurt with ¼ tsp turmeric.\n2. Apply thin layer for 10 minutes (no longer — turmeric stains).\n3. Rinse and moisturize. Use 1–2× per week." },
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: "inv_1", user_id: "u_ava", product_id: "p_centella", in_stock: true },
  { id: "inv_2", user_id: "u_ava", product_id: "p_hydrab5", in_stock: true },
  { id: "inv_3", user_id: "u_ava", product_id: "p_bha", in_stock: false },
  { id: "inv_4", user_id: "u_ava", product_id: "p_bond", in_stock: true },
  { id: "inv_5", user_id: "u_ava", product_id: "p_vitc", in_stock: false },
  { id: "inv_6", user_id: "u_ava", product_id: "p_nailoil", in_stock: true },
];

export const MOCK_SCANS: DiagnosticScan[] = [
  {
    id: "s_skin_1",
    user_id: "u_ava",
    client_id: "c_sophia",
    category: "skin",
    biomarkers: { redness: 42, dryness: 28, texture: 35, porosity: 18, discoloration: 30 },
    image_url: scanSkin,
    created_at: "2026-10-25T09:14:00Z",
  },
  {
    id: "s_hair_1",
    user_id: "u_ava",
    category: "hair",
    biomarkers: { redness: 5, dryness: 46, texture: 30, porosity: 55, discoloration: 12 },
    image_url: scanHair,
    created_at: "2026-10-24T18:40:00Z",
  },
  {
    id: "s_nails_1",
    user_id: "u_ava",
    category: "nails",
    biomarkers: { redness: 8, dryness: 38, texture: 22, porosity: 15, discoloration: 26 },
    image_url: scanNails,
    created_at: "2026-10-23T08:05:00Z",
  },
  {
    id: "s_skin_2",
    user_id: "u_ava",
    client_id: "c_imani",
    category: "skin",
    biomarkers: { redness: 55, dryness: 62, texture: 28, porosity: 20, discoloration: 35 },
    image_url: scanSkin,
    created_at: "2026-10-21T11:20:00Z",
  },
];

export const MOCK_LOOKS: EventLook[] = [
  {
    id: "look_sophia",
    client_id: "c_sophia",
    occasion: "HD Film",
    lighting: ["Studio Flash"],
    skin_prep: [
      "Gentle enzyme cleanse (no alcohol toners)",
      "Centella Calm Serum — 3 drops, pressed in",
      "Hydra-B5 Barrier Cream, 10-minute melt",
      "Hydrating primer, silicone-free on T-zone",
    ],
    makeup_base: "Neutral Cool — Satin Finish, buildable medium coverage",
    hair_wig_style: "Silk-top lace wig, deep wave 22\" · heat protectant pass at 180°C, matte styling cream finish",
    nail_design: "Chrome Velvet Almond Finish — rose quartz chrome over soft-gel almond tips",
    status: "drafting",
    approved: false,
  },
];

/** Deterministic mock analysis result per category — keeps previews and tests stable. */
export const MOCK_BIOMARKERS: Record<ScanCategory, Biomarkers> = {
  skin: { redness: 38, dryness: 26, texture: 34, porosity: 20, discoloration: 29 },
  hair: { redness: 6, dryness: 44, texture: 28, porosity: 52, discoloration: 10 },
  nails: { redness: 7, dryness: 41, texture: 20, porosity: 16, discoloration: 24 },
};
