import { describe, expect, it } from "vitest";

import {
  clientGate,
  coachGate,
  currentUsage,
  formatZar,
  maxYearlySavingPct,
  monthKey,
  PLANS,
  routineModeGate,
  scanGate,
  scansLeft,
  shelfGate,
  studioAccessGate,
  yearlySavingZar,
} from "@/lib/plans";
import { parseAccount } from "@/lib/storage";

describe("Launch pricing", () => {
  it("prices the three plans in rands", () => {
    expect(PLANS.free.monthlyZar).toBe(0);
    expect(PLANS.pro.monthlyZar).toBe(59);
    expect(PLANS.pro.yearlyZar).toBe(490);
    expect(PLANS.studio.monthlyZar).toBe(149);
    expect(PLANS.studio.yearlyZar).toBe(1290);
  });

  it("formats rands and works out the yearly saving", () => {
    expect(formatZar(59)).toBe("R59");
    expect(formatZar(1290)).toBe("R1,290");
    expect(yearlySavingZar(PLANS.pro)).toBe(218);
    expect(yearlySavingZar(PLANS.studio)).toBe(498);
    expect(yearlySavingZar(PLANS.free)).toBe(0);
    expect(maxYearlySavingPct()).toBe(31);
  });
});

describe("Check-in limit", () => {
  it("lets a free user do 2 check-ins, then blocks the 3rd with the upgrade message", () => {
    expect(scanGate("free", 0).allowed).toBe(true);
    expect(scanGate("free", 1).allowed).toBe(true);
    const third = scanGate("free", 2);
    expect(third.allowed).toBe(false);
    if (third.allowed) throw new Error("expected a block");
    expect(third.upgradeTo).toBe("pro");
    expect(third.message).toContain("You've used your 2 free check-ins this month.");
    expect(third.message).toContain("R59/month");
  });

  it("never blocks paid plans", () => {
    expect(scanGate("pro", 500).allowed).toBe(true);
    expect(scanGate("studio", 500).allowed).toBe(true);
    expect(scansLeft("pro", 500)).toBeNull();
  });

  it("adds referral bonus check-ins on top of the free allowance", () => {
    expect(scanGate("free", 2, 2).allowed).toBe(true);
    expect(scansLeft("free", 3, 2)).toBe(1);
    expect(scanGate("free", 4, 2).allowed).toBe(false);
  });

  it("resets usage when the calendar month rolls over", () => {
    const october = { month: "2026-10", scans: 2, coach: 0 };
    expect(monthKey(new Date("2026-11-16T10:00:00Z"))).toBe("2026-11");
    expect(currentUsage(october, new Date("2026-10-31T23:00:00Z")).scans).toBe(2);
    expect(currentUsage(october, new Date("2026-11-01T00:00:00Z"))).toEqual({
      month: "2026-11",
      scans: 0,
      coach: 0,
    });
  });
});

describe("Routine, shelf and coach limits", () => {
  it("keeps Pre-Makeup Prep and Barrier Reset for paid plans", () => {
    expect(routineModeGate("free", "am").allowed).toBe(true);
    expect(routineModeGate("free", "pm").allowed).toBe(true);
    expect(routineModeGate("free", "premakeup").allowed).toBe(false);
    expect(routineModeGate("free", "reset").allowed).toBe(false);
    expect(routineModeGate("pro", "premakeup").allowed).toBe(true);
    expect(routineModeGate("studio", "reset").allowed).toBe(true);
  });

  it("caps the shelf at 5 products on Free and 25 on Glow Pro", () => {
    expect(shelfGate("free", 4).allowed).toBe(true);
    const full = shelfGate("free", 5);
    expect(full.allowed).toBe(false);
    if (full.allowed) throw new Error("expected a block");
    expect(full.upgradeTo).toBe("pro");
    expect(shelfGate("pro", 24).allowed).toBe(true);
    const proFull = shelfGate("pro", 25);
    expect(proFull.allowed).toBe(false);
    if (proFull.allowed) throw new Error("expected a block");
    expect(proFull.upgradeTo).toBeNull();
  });

  it("gives Free no Coach consults and Glow Pro 10 a month", () => {
    expect(coachGate("free", 0).allowed).toBe(false);
    expect(coachGate("pro", 9).allowed).toBe(true);
    expect(coachGate("pro", 10).allowed).toBe(false);
  });
});

describe("MUA Studio limits", () => {
  it("opens client tools only on MUA Studio", () => {
    expect(studioAccessGate("free").allowed).toBe(false);
    expect(studioAccessGate("pro").allowed).toBe(false);
    expect(studioAccessGate("studio").allowed).toBe(true);
    const gate = clientGate("pro", 0);
    if (gate.allowed) throw new Error("expected a block");
    expect(gate.upgradeTo).toBe("studio");
  });

  it("allows 5 active clients and blocks the 6th with the archive message", () => {
    expect(clientGate("studio", 4).allowed).toBe(true);
    const sixth = clientGate("studio", 5);
    expect(sixth.allowed).toBe(false);
    if (sixth.allowed) throw new Error("expected a block");
    expect(sixth.upgradeTo).toBeNull();
    expect(sixth.message).toBe(
      "You've reached your 5 active clients on the Artist Launch tier. Archive past clients to make space, or get in touch for studio expansion.",
    );
  });
});

describe("Saved account state", () => {
  const now = new Date("2026-11-16T10:00:00Z");

  it("accepts a valid saved account", () => {
    const saved = {
      tier: "pro",
      usage: { month: "2026-11", scans: 3, coach: 1 },
      referredBy: "THANDI-7K2Q",
      affiliateCode: null,
    };
    expect(parseAccount(saved, now)).toEqual(saved);
  });

  it("falls back to a fresh free account when the saved data is tampered with or malformed", () => {
    const fresh = {
      tier: "free",
      usage: { month: "2026-11", scans: 0, coach: 0 },
      referredBy: null,
      affiliateCode: null,
    };
    expect(parseAccount({ tier: "enterprise" }, now)).toEqual(fresh);
    expect(
      parseAccount(
        { tier: "free", usage: { month: "2026-11", scans: -5, coach: 0 }, referredBy: null },
        now,
      ),
    ).toEqual(fresh);
    expect(parseAccount("not an object", now)).toEqual(fresh);
  });
});
