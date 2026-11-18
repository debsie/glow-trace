import { describe, expect, it } from "vitest";

import {
  activeNeeds,
  approveLook,
  DIY_ALTERNATIVES,
  gaugesFor,
  matchShelf,
  sendLook,
  wellnessScore,
} from "@/lib/beauty";
import { MOCK_BIOMARKERS, MOCK_CATALOG, MOCK_INVENTORY, MOCK_LOOKS } from "@/lib/mock-data";

describe("Scan gauges", () => {
  it("shows three labeled gauges per category, inverting hydration for skin", () => {
    const skin = gaugesFor("skin", MOCK_BIOMARKERS.skin);
    expect(skin).toHaveLength(3);
    expect(skin[0]?.label).toBe("Redness");
    expect(skin[0]?.value).toBe(38);
    // Dryness is inverted: higher gauge = better hydration.
    expect(skin[2]?.label).toBe("Hydration");
    expect(skin[2]?.value).toBe(100 - MOCK_BIOMARKERS.skin.dryness);

    const hair = gaugesFor("hair", MOCK_BIOMARKERS.hair);
    expect(hair[0]?.label).toBe("Hydration / Porosity");
    expect(hair[0]?.value).toBe(MOCK_BIOMARKERS.hair.porosity);
  });

  it("scores wellness as 100 minus the average biomarker load", () => {
    const b = MOCK_BIOMARKERS.skin;
    expect(wellnessScore(b)).toBe(
      Math.round(100 - (b.redness + b.dryness + b.texture + b.porosity + b.discoloration) / 5),
    );
  });
});

describe("Shelf matcher", () => {
  it("flags active needs for the scanned category only", () => {
    const skinNeeds = activeNeeds(MOCK_BIOMARKERS.skin, "skin");
    expect(skinNeeds.map((need) => need.id)).toEqual(["calm", "hydrate", "smooth"]);
    const hairNeeds = activeNeeds(MOCK_BIOMARKERS.hair, "hair");
    expect(hairNeeds.map((need) => need.id)).toEqual(["hydrate", "strength"]);
    const nailNeeds = activeNeeds(MOCK_BIOMARKERS.nails, "nails");
    expect(nailNeeds.map((need) => need.id)).toEqual(["hydrate", "nails"]);
  });

  it("matches in-stock products and surfaces DIY alternatives for missing ones", () => {
    const matches = matchShelf(
      activeNeeds(MOCK_BIOMARKERS.skin, "skin"),
      MOCK_INVENTORY,
      MOCK_CATALOG,
    );
    const calm = matches.find((match) => match.need.id === "calm");
    expect(calm?.inStock).toBe(true);
    expect(calm?.product.name).toBe("Centella Calm Serum");

    const smooth = matches.find((match) => match.need.id === "smooth");
    expect(smooth?.inStock).toBe(false);
    expect(smooth?.product.name).toBe("2% BHA Polish Toner");
    expect(smooth?.diy?.id).toBe(DIY_ALTERNATIVES["smooth"]);
    expect(smooth?.diy?.is_diy).toBe(true);
    expect(smooth?.diy?.recipe_instructions).toBeTruthy();
  });
});

describe("Lookbook approval flow", () => {
  it("moves a drafting look to sent and keeps sent looks sent", () => {
    const look = MOCK_LOOKS[0];
    if (!look) throw new Error("mock look missing");
    const sent = sendLook(look);
    expect(sent.status).toBe("sent");
    expect(sendLook(sent).status).toBe("sent");
  });

  it("approves with the client note and locks the status", () => {
    const look = MOCK_LOOKS[0];
    if (!look) throw new Error("mock look missing");
    const approved = approveLook(sendLook(look), "  Softer lip, please.  ");
    expect(approved.status).toBe("approved");
    expect(approved.approved).toBe(true);
    expect(approved.client_notes).toBe("Softer lip, please.");
  });
});
