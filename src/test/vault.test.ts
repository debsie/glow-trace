import { describe, expect, it } from "vitest";

import { MOCK_CLIENTS, MOCK_INVENTORY, MOCK_LOOKS, MOCK_SCANS } from "@/lib/mock-data";
import { buildExport, fromVault, parseVault, toVault, VAULT_VERSION } from "@/lib/vault";
import type { SamplePhotos } from "@/lib/vault";

const SAMPLES: SamplePhotos = {
  skin: "/assets/skin-abc.jpg",
  hair: "/assets/hair-abc.jpg",
  nails: "/assets/nails-abc.jpg",
};
const NOW = new Date("2026-11-17T10:00:00Z");

const userScan = {
  id: "s_user",
  user_id: "u_ava",
  category: "skin" as const,
  biomarkers: { redness: 30, dryness: 30, texture: 50, porosity: 0, discoloration: 6 },
  image_url: "blob:http://localhost/123",
  created_at: "2026-11-17T09:00:00.000Z",
};

describe("On-device vault", () => {
  it("round-trips app data through save and load", () => {
    const scans = MOCK_SCANS.map((scan, index) => ({
      ...scan,
      image_url: Object.values(SAMPLES)[index % 3] ?? SAMPLES.skin,
    }));
    const data = {
      scans: [userScan, ...scans],
      clients: MOCK_CLIENTS,
      looks: MOCK_LOOKS,
      inventory: MOCK_INVENTORY,
    };
    const vault = toVault(data, SAMPLES, NOW);
    expect(vault.version).toBe(VAULT_VERSION);
    // JSON round trip mimics what IndexedDB stores and gives back.
    const parsed = parseVault(JSON.parse(JSON.stringify(vault)));
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    const restored = fromVault(parsed, SAMPLES, new Map([["s_user", "blob:http://localhost/new"]]));
    expect(restored.clients).toEqual(MOCK_CLIENTS);
    expect(restored.looks).toEqual(MOCK_LOOKS);
    expect(restored.scans[0]?.image_url).toBe("blob:http://localhost/new");
    expect(restored.scans.slice(1).map((scan) => scan.image_url)).toEqual(
      scans.map((scan) => scan.image_url),
    );
  });

  it("never stores blob URLs, and re-resolves sample photos from the current build", () => {
    const vault = toVault(
      { scans: [{ ...userScan, image_url: SAMPLES.hair }], clients: [], looks: [], inventory: [] },
      SAMPLES,
      NOW,
    );
    expect(JSON.stringify(vault)).not.toContain("blob:");
    expect(vault.scans[0]?.sample_photo).toBe("hair");
    const renamed = { ...SAMPLES, hair: "/assets/hair-NEW.jpg" };
    expect(fromVault(vault, renamed, new Map()).scans[0]?.image_url).toBe("/assets/hair-NEW.jpg");
  });

  it("falls back to the category's sample photo when a stored photo is missing", () => {
    const vault = toVault(
      { scans: [userScan], clients: [], looks: [], inventory: [] },
      SAMPLES,
      NOW,
    );
    expect(fromVault(vault, SAMPLES, new Map()).scans[0]?.image_url).toBe(SAMPLES.skin);
  });

  it("rejects tampered or foreign data", () => {
    const vault = toVault(
      { scans: [userScan], clients: [], looks: [], inventory: [] },
      SAMPLES,
      NOW,
    );
    expect(parseVault({ ...vault, version: 99 })).toBeNull();
    expect(
      parseVault({
        ...vault,
        scans: [{ ...vault.scans[0], biomarkers: { ...userScan.biomarkers, redness: 500 } }],
      }),
    ).toBeNull();
    expect(parseVault("hello")).toBeNull();
    expect(parseVault(undefined)).toBeNull();
  });

  it("accepts an emptied vault, so deleted data stays deleted", () => {
    const empty = toVault({ scans: [], clients: [], looks: [], inventory: [] }, SAMPLES, NOW);
    expect(parseVault(empty)).toEqual(empty);
  });

  it("builds a readable export with photos", () => {
    const vault = toVault(
      { scans: [userScan], clients: [], looks: [], inventory: [] },
      SAMPLES,
      NOW,
    );
    const exported = buildExport(vault, { s_user: "data:image/jpeg;base64,AAA" });
    expect(exported.exported_from).toBe("Glowtrace");
    expect(exported.data.scans).toHaveLength(1);
    expect(exported.photos["s_user"]).toMatch(/^data:image\/jpeg/);
  });
});
