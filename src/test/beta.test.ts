import { describe, expect, it } from "vitest";

import {
  accessRequestSchema,
  daysLeft,
  extendedExpiry,
  feedbackSchema,
  feedbackSummary,
  firstNameFrom,
  grantSchema,
  sentimentFor,
  testerStatus,
  thankYouMailto,
  triageOrder,
} from "@/lib/beta";
import type { Feedback } from "@/lib/beta";

const NOW = new Date("2026-11-18T10:00:00Z");

describe("Access windows", () => {
  it("grants 14, 30 or 60 days from now, or extends what is left", () => {
    expect(extendedExpiry(null, 14, NOW)).toBe("2026-12-02T10:00:00.000Z");
    // 5 days left + 30 more = 35 days from now.
    expect(extendedExpiry("2026-11-23T10:00:00Z", 30, NOW)).toBe("2026-12-23T10:00:00.000Z");
    // Already expired: starts again from now.
    expect(extendedExpiry("2026-10-01T10:00:00Z", 60, NOW)).toBe("2027-01-17T10:00:00.000Z");
  });

  it("counts days left and tells active, ending-soon, expired and revoked apart", () => {
    expect(daysLeft("2026-12-02T10:00:00Z", NOW)).toBe(14);
    expect(daysLeft("2026-11-18T11:00:00Z", NOW)).toBe(1);
    expect(daysLeft("2026-11-01T10:00:00Z", NOW)).toBe(0);
    expect(daysLeft(null, NOW)).toBeNull();
    expect(testerStatus({ expires_at: "2026-12-02T10:00:00Z", revoked_at: null }, NOW)).toBe(
      "active",
    );
    expect(testerStatus({ expires_at: "2026-11-20T10:00:00Z", revoked_at: null }, NOW)).toBe(
      "ending-soon",
    );
    expect(testerStatus({ expires_at: "2026-11-01T10:00:00Z", revoked_at: null }, NOW)).toBe(
      "expired",
    );
    expect(testerStatus({ expires_at: null, revoked_at: "2026-11-10T10:00:00Z" }, NOW)).toBe(
      "revoked",
    );
    expect(testerStatus({ expires_at: null, revoked_at: null }, NOW)).toBe("active");
  });

  it("accepts only 14, 30 or 60 days and a real email", () => {
    expect(grantSchema.safeParse({ email: " Lebo@Mail.co.za ", days: 30 }).data).toEqual({
      email: "lebo@mail.co.za",
      days: 30,
    });
    expect(grantSchema.safeParse({ email: "lebo@mail.co.za", days: 7 }).success).toBe(false);
    expect(grantSchema.safeParse({ email: "nope", days: 14 }).success).toBe(false);
  });
});

describe("Requests and feedback input", () => {
  it("needs a name for a request and caps the note", () => {
    expect(accessRequestSchema.safeParse({ name: " ", note: "" }).success).toBe(false);
    expect(accessRequestSchema.safeParse({ name: "Thandi", note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(accessRequestSchema.safeParse({ name: "Thandi", note: "" }).success).toBe(true);
  });

  it("validates feedback", () => {
    expect(
      feedbackSchema.safeParse({ rating: 6, category: "bug", message: "broken", page: "/" })
        .success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({ rating: 4, category: "rant", message: "hmm", page: "/" }).success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({ rating: 4, category: "idea", message: "ok", page: "/" }).success,
    ).toBe(false);
    expect(
      feedbackSchema.safeParse({
        rating: 4,
        category: "idea",
        message: "Add sunscreen reminders",
        page: "/agent",
      }).success,
    ).toBe(true);
  });
});

const item = (overrides: Partial<Feedback>): Feedback => ({
  id: Math.random().toString(36),
  email: "lebo.k@mail.co.za",
  rating: 3,
  category: "other",
  message: "Fine",
  page: "/app",
  status: "new",
  thanked_at: null,
  created_at: "2026-11-17T10:00:00Z",
  ...overrides,
});

describe("Feedback triage", () => {
  it("treats bug reports and 1-2 stars as negative, 4-5 as positive", () => {
    expect(sentimentFor({ rating: 5, category: "bug" })).toBe("negative");
    expect(sentimentFor({ rating: 2, category: "idea" })).toBe("negative");
    expect(sentimentFor({ rating: 3, category: "idea" })).toBe("neutral");
    expect(sentimentFor({ rating: 4, category: "praise" })).toBe("positive");
  });

  it("puts open problems first and closed praise last", () => {
    const ordered = triageOrder([
      item({ id: "praise", rating: 5, category: "praise" }),
      item({ id: "closed-bug", category: "bug", status: "resolved" }),
      item({ id: "old-bug", category: "bug", created_at: "2026-11-10T10:00:00Z" }),
      item({ id: "new-bug", category: "bug", created_at: "2026-11-18T09:00:00Z" }),
      item({ id: "meh", rating: 3 }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual([
      "new-bug",
      "old-bug",
      "meh",
      "praise",
      "closed-bug",
    ]);
  });

  it("summarises what needs attention", () => {
    const summary = feedbackSummary([
      item({ category: "bug", rating: 1 }),
      item({ rating: 5, category: "praise" }),
      item({
        rating: 5,
        category: "praise",
        thanked_at: "2026-11-18T08:00:00Z",
        status: "resolved",
      }),
    ]);
    expect(summary).toEqual({ total: 3, open: 2, urgent: 1, toThank: 1, averageRating: 3.7 });
    expect(feedbackSummary([]).averageRating).toBeNull();
  });

  it("writes a thank-you email that quotes the person", () => {
    const url = thankYouMailto(
      { email: "lebo.k@mail.co.za", message: "The agent is brilliant" },
      "Lebo",
    );
    expect(url.startsWith("mailto:lebo.k%40mail.co.za?subject=")).toBe(true);
    expect(decodeURIComponent(url)).toContain('"The agent is brilliant"');
    expect(decodeURIComponent(url)).toContain("Hi Lebo,");
  });

  it("finds a first name to greet people by", () => {
    expect(firstNameFrom("x@y.co", "Thandi Mokoena")).toBe("Thandi");
    expect(firstNameFrom("lebo.k@mail.co.za")).toBe("Lebo");
    expect(firstNameFrom("@mail.co.za")).toBe("there");
  });
});
