import { z } from "zod";

import { biomarkerReportSchema } from "./cv/schemas";
import type { Client, DiagnosticScan, EventLook, InventoryItem } from "./types";

/**
 * The "vault": everything a person creates in Glowtrace, saved in their own browser.
 * Pure schema and transform code; the IndexedDB plumbing lives in vault-store.ts.
 */

export const VAULT_VERSION = 1;

const biomarkersSchema = z.object({
  redness: z.number().min(0).max(100),
  dryness: z.number().min(0).max(100),
  texture: z.number().min(0).max(100),
  porosity: z.number().min(0).max(100),
  discoloration: z.number().min(0).max(100),
});

/** Scans are stored without image_url: photos live in their own store, keyed by scan id. */
const storedScanSchema = z.object({
  id: z.string().min(1),
  user_id: z.string(),
  client_id: z.string().optional(),
  category: z.enum(["skin", "hair", "nails"]),
  biomarkers: biomarkersSchema,
  created_at: z.string().datetime(),
  report: biomarkerReportSchema.optional(),
  demo: z.boolean().optional(),
  /** Bundled sample photo for seed scans; null when the photo is in the photo store. */
  sample_photo: z.enum(["skin", "hair", "nails"]).nullable(),
});

const clientSchema = z.object({
  id: z.string().min(1),
  mua_id: z.string(),
  client_name: z.string(),
  contact_info: z.string(),
  skin_type: z.string(),
  notes: z.string(),
  archived: z.boolean().optional(),
});

const lookSchema = z.object({
  id: z.string().min(1),
  client_id: z.string().min(1),
  occasion: z.string(),
  lighting: z.array(z.enum(["Daylight 5000K", "Studio Flash", "Warm Candlelight"])),
  skin_prep: z.array(z.string()),
  makeup_base: z.string(),
  hair_wig_style: z.string(),
  nail_design: z.string(),
  status: z.enum(["drafting", "sent", "approved"]),
  approved: z.boolean(),
  client_notes: z.string().optional(),
  saved_to_history: z.boolean().optional(),
});

const inventorySchema = z.object({
  id: z.string().min(1),
  user_id: z.string(),
  product_id: z.string().min(1),
  in_stock: z.boolean(),
});

export const vaultSchema = z.object({
  version: z.literal(VAULT_VERSION),
  saved_at: z.string().datetime(),
  scans: z.array(storedScanSchema),
  clients: z.array(clientSchema),
  looks: z.array(lookSchema),
  inventory: z.array(inventorySchema),
});

export type StoredScan = z.infer<typeof storedScanSchema>;
export type Vault = z.infer<typeof vaultSchema>;

/** Returns the vault, or null when the saved data is missing, from another version or malformed. */
export const parseVault = (input: unknown): Vault | null => {
  const parsed = vaultSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
};

export type AppData = {
  scans: DiagnosticScan[];
  clients: Client[];
  looks: EventLook[];
  inventory: InventoryItem[];
};

/** Which bundled sample photo a scan uses, if any. */
export type SamplePhotos = Record<"skin" | "hair" | "nails", string>;

const sampleFor = (scan: DiagnosticScan, samples: SamplePhotos) =>
  (Object.keys(samples) as (keyof SamplePhotos)[]).find((key) => samples[key] === scan.image_url) ??
  null;

export const toVault = (data: AppData, samples: SamplePhotos, now: Date): Vault => ({
  version: VAULT_VERSION,
  saved_at: now.toISOString(),
  scans: data.scans.map((scan) => {
    const { image_url: _imageUrl, ...rest } = scan;
    return { ...rest, sample_photo: sampleFor(scan, samples) };
  }),
  clients: data.clients,
  looks: data.looks,
  inventory: data.inventory,
});

/**
 * Rebuild app data from a vault. `photoUrls` maps scan id → object URL for stored photos.
 * Sample photos are re-resolved from the current build, so asset renames can't break them.
 */
export const fromVault = (
  vault: Vault,
  samples: SamplePhotos,
  photoUrls: ReadonlyMap<string, string>,
): AppData => ({
  scans: vault.scans.map(({ sample_photo, ...scan }) => ({
    ...scan,
    image_url: sample_photo
      ? samples[sample_photo]
      : (photoUrls.get(scan.id) ?? samples[scan.category]),
  })),
  clients: vault.clients,
  looks: vault.looks,
  inventory: vault.inventory,
});

/** A portable, human-readable copy of everything, for "Download my data". */
export const buildExport = (vault: Vault, photos: Record<string, string>) => ({
  exported_from: "Glowtrace",
  exported_at: vault.saved_at,
  note: "Everything Glowtrace stores about you on this device. Photos are included as data URLs.",
  data: {
    scans: vault.scans,
    clients: vault.clients,
    looks: vault.looks,
    inventory: vault.inventory,
  },
  photos,
});
