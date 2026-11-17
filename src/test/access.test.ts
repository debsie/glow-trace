import { describe, expect, it } from "vitest";

import { checkEmail, displayNameFor, gateFor, isPublicPath, safeNext } from "@/lib/access";

describe("Beta access", () => {
  it("keeps marketing pages public and the app behind sign-in", () => {
    for (const path of ["/", "/pricing", "/refer", "/affiliates", "/login", "/privacy"]) {
      expect(isPublicPath(path)).toBe(true);
    }
    for (const path of ["/app", "/scan", "/agent", "/routine", "/progress", "/pro/clients"]) {
      expect(isPublicPath(path)).toBe(false);
    }
  });

  it("decides what an app page shows for each access state", () => {
    expect(gateFor("/scan", { kind: "demo" })).toBe("show");
    expect(gateFor("/scan", { kind: "checking" })).toBe("wait");
    expect(gateFor("/scan", { kind: "signed-out" })).toBe("sign-in");
    expect(gateFor("/scan", { kind: "waitlisted", email: "a@b.co" })).toBe("waitlist");
    expect(
      gateFor("/scan", { kind: "member", userId: "u", email: "a@b.co", displayName: "A" }),
    ).toBe("show");
    expect(gateFor("/pricing", { kind: "signed-out" })).toBe("show");
  });

  it("normalises and validates email addresses", () => {
    expect(checkEmail("  Thandi@Example.CO.ZA ")).toEqual({
      ok: true,
      email: "thandi@example.co.za",
    });
    expect(checkEmail("not-an-email").ok).toBe(false);
    expect(checkEmail("").ok).toBe(false);
  });

  it("names people from their profile, else their email", () => {
    expect(displayNameFor("Thandi Mokoena", "t@x.co")).toBe("Thandi Mokoena");
    expect(displayNameFor("  ", "lebo.k@x.co")).toBe("lebo.k");
    expect(displayNameFor(null, "@x.co")).toBe("Glowtrace member");
  });

  it("only redirects to same-site paths after sign-in", () => {
    expect(safeNext("/agent")).toBe("/agent");
    expect(safeNext("https://evil.example")).toBe("/app");
    expect(safeNext("//evil.example")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });
});
