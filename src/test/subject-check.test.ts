import { describe, expect, it } from "vitest";

import { subjectHint, subjectKind } from "@/lib/cv/subject-check";

const face = (share: number, centreX = 0.5, found = true) =>
  ({ kind: "face", found, share, centreX, centreY: 0.5 }) as const;

describe("Live subject check", () => {
  it("maps each area to its guide", () => {
    expect([subjectKind("skin"), subjectKind("nails"), subjectKind("hair")]).toEqual([
      "face",
      "hand",
      "hair",
    ]);
  });

  it("coaches the face into the outline", () => {
    expect(subjectHint("face", face(0, 0.5, false))).toMatch(/into the frame/);
    expect(subjectHint("face", face(0.05))).toMatch(/closer/);
    expect(subjectHint("face", face(0.8))).toMatch(/back/);
    expect(subjectHint("face", face(0.3, 0.9))).toMatch(/Centre/);
    expect(subjectHint("face", face(0.3))).toBeUndefined();
  });

  it("wants four fingertips for the flat hand and the thumb for the thumb shot", () => {
    const hand = (fingertips: number, thumb: boolean) =>
      ({ kind: "hand", found: true, fingertips, thumb }) as const;
    expect(
      subjectHint("hand", { kind: "hand", found: false, fingertips: 0, thumb: false }),
    ).toMatch(/Show your hand/);
    expect(subjectHint("hand", hand(2, true))).toMatch(/Spread/);
    expect(subjectHint("hand", hand(4, false))).toBeUndefined();
    expect(subjectHint("thumb", hand(4, false))).toMatch(/thumb/);
    expect(subjectHint("thumb", hand(0, true))).toBeUndefined();
  });

  it("asks for more hair until it fills the frame", () => {
    expect(subjectHint("lengths", { kind: "hair", share: 0.1 })).toMatch(/Fill the frame/);
    expect(subjectHint("crown", { kind: "hair", share: 0.1 })).toMatch(/crown/);
    expect(subjectHint("ends", { kind: "hair", share: 0.5 })).toBeUndefined();
  });
});
