import { describe, expect, it } from "vitest";

import {
  affiliateEarnings,
  affiliateRate,
  freeMonthsFor,
  isValidCode,
  makeReferralCode,
  redeemCode,
  referralRewards,
  shareLink,
  whatsappShareUrl,
} from "@/lib/referrals";

describe("Referral rewards", () => {
  it("gives one free month per paying friend, 2 bonus months at 5, capped at a year", () => {
    expect(freeMonthsFor(0)).toBe(0);
    expect(freeMonthsFor(1)).toBe(1);
    expect(freeMonthsFor(3)).toBe(3);
    expect(freeMonthsFor(5)).toBe(7);
    expect(freeMonthsFor(10)).toBe(12);
    expect(freeMonthsFor(40)).toBe(12);
    expect(freeMonthsFor(-3)).toBe(0);
  });

  it("gives 2 bonus check-ins per friend who joins, up to 10 a month", () => {
    expect(referralRewards({ joinedThisMonth: 1, subscribed: 0 }).bonusScans).toBe(2);
    expect(referralRewards({ joinedThisMonth: 3, subscribed: 0 }).bonusScans).toBe(6);
    expect(referralRewards({ joinedThisMonth: 50, subscribed: 0 }).bonusScans).toBe(10);
  });

  it("points at the next reward until the year cap is reached", () => {
    expect(referralRewards({ joinedThisMonth: 0, subscribed: 2 }).nextMilestone).toEqual({
      friendsNeeded: 3,
      reward: "2 bonus months free",
    });
    expect(referralRewards({ joinedThisMonth: 0, subscribed: 6 }).nextMilestone).toEqual({
      friendsNeeded: 1,
      reward: "another month free",
    });
    expect(referralRewards({ joinedThisMonth: 0, subscribed: 10 }).nextMilestone).toBeNull();
  });
});

describe("Invite codes", () => {
  it("makes the same readable code every time for the same person", () => {
    const code = makeReferralCode("Ava Reyes", "u_ava");
    expect(code).toBe(makeReferralCode("Ava Reyes", "u_ava"));
    expect(code).toMatch(/^AVA-[A-HJ-NP-Z2-9]{4}$/);
    expect(isValidCode(code)).toBe(true);
    expect(makeReferralCode("Ava Reyes", "u_other")).not.toBe(code);
  });

  it("falls back to a GLOW prefix when the name has no usable letters", () => {
    expect(makeReferralCode("  ", "u_1")).toMatch(/^GLOW-/);
    expect(makeReferralCode("X", "u_1")).toMatch(/^GLOW-/);
    expect(makeReferralCode("Zoë", "u_1")).toMatch(/^ZOE-/);
  });

  it("rejects your own code, malformed codes and a second redemption", () => {
    const own = makeReferralCode("Ava Reyes", "u_ava");
    expect(redeemCode(own.toLowerCase(), own, null).ok).toBe(false);
    expect(redeemCode("hello", own, null).ok).toBe(false);
    expect(redeemCode("<script>-AAAA", own, null).ok).toBe(false);
    expect(redeemCode("THANDI-7K2Q", own, "LEBO-ABCD").ok).toBe(false);
    expect(redeemCode(" thandi-7k2q ", own, null)).toEqual({ ok: true, code: "THANDI-7K2Q" });
  });

  it("builds share links for invites, partners and WhatsApp", () => {
    expect(shareLink("https://example.co.za/", "ava-7k2q")).toBe(
      "https://example.co.za/pricing?ref=AVA-7K2Q",
    );
    expect(shareLink("https://example.co.za", "AVA-7K2Q", "aff")).toBe(
      "https://example.co.za/pricing?aff=AVA-7K2Q",
    );
    expect(whatsappShareUrl("Hi there & welcome")).toBe(
      "https://wa.me/?text=Hi%20there%20%26%20welcome",
    );
  });
});

describe("Partner earnings", () => {
  it("pays 30% of monthly revenue, in rands", () => {
    const earnings = affiliateEarnings({ proSubscribers: 20, studioSubscribers: 0 });
    expect(earnings.rate).toBe(0.3);
    expect(earnings.monthlyZar).toBe(354);
    expect(earnings.windowZar).toBe(4248);
  });

  it("moves to 40% at 25 active subscribers", () => {
    expect(affiliateRate(24)).toBe(0.3);
    expect(affiliateRate(25)).toBe(0.4);
    const earnings = affiliateEarnings({ proSubscribers: 20, studioSubscribers: 5 });
    expect(earnings.rate).toBe(0.4);
    expect(earnings.monthlyZar).toBe(770);
  });

  it("unlocks a free MUA Studio plan at 5 active subscribers and ignores bad input", () => {
    expect(affiliateEarnings({ proSubscribers: 4, studioSubscribers: 0 }).freeStudio).toBe(false);
    expect(affiliateEarnings({ proSubscribers: 3, studioSubscribers: 2 }).freeStudio).toBe(true);
    expect(affiliateEarnings({ proSubscribers: -10, studioSubscribers: 0 }).monthlyZar).toBe(0);
  });
});
