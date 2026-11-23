import { describe, expect, it } from "vitest";

import { TOPICS } from "@/lib/agent/knowledge";
import { GUIDE_AREAS, GUIDES, guideById, guideOfTheDay, relatedGuides } from "@/lib/guides";

describe("Glow Guides", () => {
  it("gives every knowledge topic a guide with an area and a motif", () => {
    expect(GUIDES).toHaveLength(TOPICS.length);
    for (const area of GUIDE_AREAS) {
      expect(GUIDES.some((guide) => guide.area === area.id)).toBe(true);
    }
  });

  it("finds related guides in the same area", () => {
    const braids = guideById("protective-styles");
    expect(braids).not.toBeNull();
    const related = braids ? relatedGuides(braids) : [];
    expect(related).toHaveLength(3);
    expect(related.every((guide) => guide.area === "hair")).toBe(true);
  });

  it("returns null for an unknown guide", () => {
    expect(guideById("nope")).toBeNull();
  });
});

describe("Guide of the day", () => {
  it("picks the guide for the weakest indicator that needs care", () => {
    const pick = guideOfTheDay(
      [
        { label: "Redness", severity: "watch", health: 55 },
        { label: "Hydration", severity: "focus", health: 30 },
      ],
      "2026-11-23",
    );
    expect(pick).toMatchObject({ guide: { id: "ashy" }, why: "reading" });
  });

  it("rotates daily when all is well", () => {
    const a = guideOfTheDay([], "2026-11-23");
    expect(a.why).toBe("daily");
    expect(guideOfTheDay([], "2026-11-23").guide.id).toBe(a.guide.id);
  });
});
