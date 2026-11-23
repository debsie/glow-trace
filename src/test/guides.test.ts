import { describe, expect, it } from "vitest";

import { TOPICS } from "@/lib/agent/knowledge";
import { GUIDE_AREAS, GUIDES, guideById, relatedGuides } from "@/lib/guides";

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
