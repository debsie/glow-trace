import { describe, expect, it } from "vitest";

import { artistName, initialsOf, missingBusiness, profilePrefsSchema } from "@/lib/profile";

describe("profile settings", () => {
  it("fills safe defaults and refuses unknown avatars", () => {
    const prefs = profilePrefsSchema.parse({});
    expect(prefs.avatar).toEqual({ kind: "initials" });
    expect(prefs.earlyAccess).toBe(false);
    expect(profilePrefsSchema.safeParse({ avatar: { kind: "art", id: "nope" } }).success).toBe(
      false,
    );
  });

  it("cleans business details", () => {
    const prefs = profilePrefsSchema.parse({
      business: { instagram: "@glow.by.thandi", name: " Thandi Beauty " },
    });
    expect(prefs.business.instagram).toBe("glow.by.thandi");
    expect(prefs.business.name).toBe("Thandi Beauty");
    expect(missingBusiness(prefs.business)).toEqual(["WhatsApp number", "area you work in"]);
    expect(artistName(prefs, "Thandi Nkosi")).toBe("Thandi Beauty");
  });

  it("makes initials", () => {
    expect(initialsOf("Ava Reyes")).toBe("AR");
    expect(initialsOf("debbie")).toBe("D");
    expect(initialsOf("  ")).toBe("G");
  });
});
