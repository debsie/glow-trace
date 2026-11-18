/** Core Glowtrace domain types. All schemas are TypeScript-first; mock-only state. */

export type Role = "consumer" | "mua";
/** free = Free, pro = Glow Pro, studio = MUA Studio. Prices and limits live in plans.ts. */
export type SubscriptionTier = "free" | "pro" | "studio";
export type Workspace = "personal" | "pro";

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  subscription_tier: SubscriptionTier;
};

export type Client = {
  id: string;
  mua_id: string;
  client_name: string;
  contact_info: string;
  skin_type: string;
  notes: string;
  /** Archived clients stay on file but no longer count towards the active-client cap. */
  archived?: boolean | undefined;
};

export type ScanCategory = "skin" | "hair" | "nails";

export type Biomarkers = {
  redness: number;
  dryness: number;
  texture: number;
  porosity: number;
  discoloration: number;
};

/** Kept structural here so types.ts has no imports; matches BiomarkerReport in lib/cv. */
export type ScanReport = {
  kernelVersion: string;
  category: ScanCategory;
  quality: {
    width: number;
    height: number;
    sharpness: number;
    usable: boolean;
    notice?: string | undefined;
    warning?: string | undefined;
    faceGuide?: boolean | undefined;
    hairGuide?: boolean | undefined;
    skinDetail?: number | undefined;
    filtered?: boolean | undefined;
  };
  tone?: { ita: number; hueAngle: number } | undefined;
  zones?: { forehead: number; leftCheek: number; rightCheek: number; chin: number } | undefined;
  metrics: {
    key: string;
    label: string;
    value: number;
    higherMeans: "more" | "better";
    description: string;
  }[];
};

export type ScanRecord = {
  id: string;
  user_id: string;
  client_id?: string | undefined;
  category: ScanCategory;
  biomarkers: Biomarkers;
  image_url: string;
  created_at: string;
  /** The on-device analysis report. Absent on older sample scans. */
  report?: ScanReport | undefined;
  /** True when the photo couldn't be scored and sample values were shown instead. */
  demo?: boolean | undefined;
};

export type ProductCategory = "skincare" | "haircare" | "nailcare" | "makeup";

export type Product = {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  ingredients: string;
  is_diy: boolean;
  recipe_instructions?: string;
};

export type InventoryItem = {
  id: string;
  user_id: string;
  product_id: string;
  in_stock: boolean;
};

export type LookStatus = "drafting" | "sent" | "approved";

export type LightingPreset = "Daylight 5000K" | "Studio Flash" | "Warm Candlelight";

export type EventLook = {
  id: string;
  client_id: string;
  occasion: string;
  lighting: LightingPreset[];
  skin_prep: string[];
  makeup_base: string;
  hair_wig_style: string;
  nail_design: string;
  status: LookStatus;
  approved: boolean;
  client_notes?: string | undefined;
  saved_to_history?: boolean | undefined;
};

export type NewClientInput = Pick<Client, "client_name" | "contact_info" | "skin_type" | "notes">;
