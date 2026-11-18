import { describe, expect, it } from "vitest";

import {
  answer,
  briefing,
  conflictWith,
  findingsFor,
  intentFor,
  suggestProducts,
} from "@/lib/agent/agent";
import { PRODUCT_PROFILES } from "@/lib/agent/knowledge";
import { MOCK_CATALOG } from "@/lib/mock-data";
import type { ScanRecord, InventoryItem, ScanReport } from "@/lib/types";

type Metric = ScanReport["metrics"][number];

const metric = (key: string, value: number, higherMeans: "more" | "better" = "more"): Metric => ({
  key,
  label: key,
  value,
  higherMeans,
  description: "",
});

const skinScan = (
  id: string,
  date: string,
  values: { erythema: number; texture: number; hydration: number; discoloration: number },
): ScanRecord => ({
  id,
  user_id: "u",
  category: "skin",
  biomarkers: { redness: 0, dryness: 0, texture: 0, porosity: 0, discoloration: 0 },
  image_url: "",
  created_at: date,
  report: {
    kernelVersion: "test",
    category: "skin",
    quality: { width: 256, height: 256, sharpness: 50, usable: true },
    metrics: [
      metric("erythema", values.erythema),
      metric("texture", values.texture),
      metric("hydration", values.hydration, "better"),
      metric("discoloration", values.discoloration),
    ],
  },
});

const shelf = (...ids: string[]): InventoryItem[] =>
  ids.map((id, index) => ({ id: `i${index}`, user_id: "u", product_id: id, in_stock: true }));

const older = skinScan("a", "2026-11-01T08:00:00Z", {
  erythema: 55,
  texture: 50,
  hydration: 70,
  discoloration: 10,
});
const latest = skinScan("b", "2026-11-15T08:00:00Z", {
  erythema: 30,
  texture: 72,
  hydration: 40,
  discoloration: 10,
});

describe("Care agent findings", () => {
  it("ranks the latest scan's weakest indicators first, with trends", () => {
    const findings = findingsFor([older, latest]);
    expect(findings.map((finding) => finding.concern)).toEqual([
      "texture",
      "dryness",
      "redness",
      "tone",
    ]);
    const texture = findings[0];
    expect(texture?.severity).toBe("focus");
    expect(texture?.health).toBe(28);
    expect(texture?.trend).toBe("worsening");
    expect(findings.find((finding) => finding.concern === "redness")?.trend).toBe("improving");
    expect(findings.find((finding) => finding.concern === "tone")?.severity).toBe("good");
  });

  it("compares only scans from the same kernel version and face-guide setting", () => {
    const oldKernel = { ...older, report: { ...older.report!, kernelVersion: "older" } };
    expect(findingsFor([oldKernel, latest]).every((finding) => finding.trend === "new")).toBe(true);
    const guided = {
      ...older,
      report: { ...older.report!, quality: { ...older.report!.quality, faceGuide: true } },
    };
    expect(findingsFor([guided, latest]).every((finding) => finding.trend === "new")).toBe(true);
  });

  it("ignores scans that could not be scored", () => {
    expect(findingsFor([{ ...latest, demo: true }])).toEqual([]);
  });
});

describe("Product suggestions", () => {
  it("suggests products for what needs attention, owned products first", () => {
    const findings = findingsFor([latest]);
    const suggestions = suggestProducts(findings, MOCK_CATALOG, shelf("p_hydrab5"));
    expect(suggestions[0]?.product.id).toBe("p_hydrab5");
    expect(suggestions[0]?.onShelf).toBe(true);
    const ids = suggestions.map((suggestion) => suggestion.product.id);
    expect(ids).toContain("p_bha");
    expect(ids).toContain("p_spf50");
    // Hair and nail products are not suggested from a skin scan.
    expect(ids.every((id) => PRODUCT_PROFILES[id]?.area === "skin")).toBe(true);
    for (const suggestion of suggestions) {
      expect(suggestion.match).toBeGreaterThanOrEqual(40);
      expect(suggestion.match).toBeLessThanOrEqual(98);
    }
  });

  it("scores a product for a worse problem above one for a milder problem", () => {
    const findings = findingsFor([latest]);
    const suggestions = suggestProducts(findings, MOCK_CATALOG, []);
    const forTexture = suggestions.find((suggestion) => suggestion.product.id === "p_bha");
    // Texture reads 28/100 for health, hydration 40/100: the texture product should rank higher.
    const forHydration = suggestions.find((suggestion) => suggestion.product.id === "p_hydrab5");
    expect(forTexture?.match ?? 0).toBeGreaterThan(forHydration?.match ?? 100);
  });

  it("holds back strong actives while skin is red", () => {
    const red = skinScan("r", "2026-11-15T08:00:00Z", {
      erythema: 80,
      texture: 70,
      hydration: 60,
      discoloration: 10,
    });
    const ids = suggestProducts(findingsFor([red]), MOCK_CATALOG, []).map((s) => s.product.id);
    expect(ids).toContain("p_centella");
    expect(ids).not.toContain("p_bha");
    expect(ids).not.toContain("p_retinal");
  });

  it("warns when a suggestion clashes with the shelf", () => {
    expect(conflictWith("p_retinal", ["p_bha"], MOCK_CATALOG)).toMatch(/different nights/);
    expect(conflictWith("p_bha", ["p_vitc"], MOCK_CATALOG)).toMatch(/Vitamin C in the morning/);
    expect(conflictWith("p_centella", ["p_bha", "p_retinal"], MOCK_CATALOG)).toBeNull();
  });

  it("offers a DIY alternative where one exists", () => {
    const suggestions = suggestProducts(findingsFor([latest]), MOCK_CATALOG, []);
    const bha = suggestions.find((suggestion) => suggestion.product.id === "p_bha");
    expect(bha?.diy?.is_diy).toBe(true);
  });
});

describe("Questions", () => {
  const brief = briefing([older, latest], MOCK_CATALOG, shelf("p_bha", "p_retinal", "p_spf50"));

  it("matches plain questions to an intent", () => {
    expect(intentFor("Can I use these together?")).toBe("conflicts");
    expect(intentFor("what do I put on at night")).toBe("routine");
    expect(intentFor("am I getting better")).toBe("progress");
    expect(intentFor("which serum should I buy")).toBe("products");
    expect(intentFor("hello there")).toBeNull();
  });

  it("answers from the person's own results and shelf", () => {
    expect(answer("focus", brief, MOCK_CATALOG, []).paragraphs[0]).toMatch(/^Start with texture/);
    expect(
      answer("conflicts", brief, MOCK_CATALOG, shelf("p_bha", "p_retinal")).paragraphs[0],
    ).toMatch(/different nights/);
    const routine = answer("routine", brief, MOCK_CATALOG, shelf("p_spf50", "p_retinal"));
    expect(routine.paragraphs[0]).toContain("Invisible Fluid SPF 50");
    expect(routine.paragraphs[1]).toContain("Retinal Night Renew");
    expect(answer("progress", brief, MOCK_CATALOG, []).paragraphs[0]).toMatch(/Improving: redness/);
    expect(answer("products", brief, MOCK_CATALOG, []).productIds.length).toBeGreaterThan(0);
  });

  it("asks for a scan before giving advice", () => {
    const empty = briefing([], MOCK_CATALOG, []);
    expect(empty.headline).toMatch(/first scan/);
    expect(answer("focus", empty, MOCK_CATALOG, []).paragraphs[0]).toMatch(/Run a skin/);
  });
});
