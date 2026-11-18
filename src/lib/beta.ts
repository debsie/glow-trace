import { z } from "zod";

import { longDate } from "./progress";

/**
 * Beta programme rules: access windows, request and feedback validation, and the order the
 * admin dashboard triages things in. Pure; the database enforces the same rules.
 */

export const ACCESS_DURATIONS = [14, 30, 60] as const;
export type AccessDuration = (typeof ACCESS_DURATIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** New expiry when access is granted or extended: days are added to whatever is left. */
export const extendedExpiry = (current: string | null, days: AccessDuration, now: Date): string => {
  const base = current ? Math.max(now.getTime(), new Date(current).getTime()) : now.getTime();
  return new Date(base + days * DAY_MS).toISOString();
};

/** Whole days left, rounded up; 0 once expired; null for access with no end date. */
export const daysLeft = (expiresAt: string | null, now: Date): number | null => {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS));
};

export type TesterStatus = "active" | "ending-soon" | "expired" | "revoked";

/** "Ending soon" gives a few days' warning before access stops. */
export const ENDING_SOON_DAYS = 3;

export const testerStatus = (
  tester: { expires_at: string | null; revoked_at: string | null },
  now: Date,
): TesterStatus => {
  if (tester.revoked_at) return "revoked";
  const left = daysLeft(tester.expires_at, now);
  if (left === null) return "active";
  if (left === 0) return "expired";
  return left <= ENDING_SOON_DAYS ? "ending-soon" : "active";
};

export const accessUntil = (expiresAt: string | null): string =>
  expiresAt ? `until ${longDate(expiresAt)}` : "with no end date";

/* ---------- Inputs ---------- */

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const grantSchema = z.object({
  email,
  days: z.union([z.literal(14), z.literal(30), z.literal(60)]),
});

export const accessRequestSchema = z.object({
  name: z.string().trim().min(1, "Tell us your name").max(80),
  note: z.string().trim().max(500, "Keep it under 500 characters"),
});

export const FEEDBACK_CATEGORIES = ["bug", "idea", "praise", "other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  bug: "Something's broken",
  idea: "An idea",
  praise: "Something I love",
  other: "Something else",
};

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(3, "Tell us a little more").max(2000),
  page: z.string().max(200),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

/* ---------- Records ---------- */

export type AccessRequest = {
  email: string;
  name: string | null;
  note: string | null;
  status: "pending" | "approved" | "declined";
  requested_at: string;
  decided_at: string | null;
};

export type Tester = {
  email: string;
  expires_at: string | null;
  duration_days: number | null;
  revoked_at: string | null;
  added_at: string;
};

export type FeedbackStatus = "new" | "triaged" | "resolved";

export type Feedback = {
  id: string;
  email: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  page: string | null;
  status: FeedbackStatus;
  thanked_at: string | null;
  created_at: string;
};

export type Sentiment = "negative" | "neutral" | "positive";

/** A bug report is a problem whatever the stars say; otherwise 1-2 negative, 4-5 positive. */
export const sentimentFor = (item: Pick<Feedback, "rating" | "category">): Sentiment =>
  item.category === "bug" || item.rating <= 2
    ? "negative"
    : item.rating >= 4
      ? "positive"
      : "neutral";

const STATUS_ORDER: Record<FeedbackStatus, number> = { new: 0, triaged: 1, resolved: 2 };
const SENTIMENT_ORDER: Record<Sentiment, number> = { negative: 0, neutral: 1, positive: 2 };

/** Triage order: open before closed, problems before praise, then newest first. */
export const triageOrder = (items: readonly Feedback[]): Feedback[] =>
  [...items].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      SENTIMENT_ORDER[sentimentFor(a)] - SENTIMENT_ORDER[sentimentFor(b)] ||
      b.created_at.localeCompare(a.created_at),
  );

export const feedbackSummary = (items: readonly Feedback[]) => ({
  total: items.length,
  open: items.filter((item) => item.status === "new").length,
  urgent: items.filter((item) => item.status === "new" && sentimentFor(item) === "negative").length,
  toThank: items.filter((item) => sentimentFor(item) === "positive" && !item.thanked_at).length,
  averageRating:
    items.length === 0
      ? null
      : Math.round((items.reduce((sum, item) => sum + item.rating, 0) / items.length) * 10) / 10,
});

/** A ready-to-send thank-you, quoting the person's own words. */
export const thankYouMailto = (item: Pick<Feedback, "email" | "message">, firstName: string) => {
  const quote = item.message.length > 240 ? `${item.message.slice(0, 237)}...` : item.message;
  const body = [
    `Hi ${firstName},`,
    "",
    "Thank you for taking the time to tell us what you think of Glowtrace. You wrote:",
    "",
    `"${quote}"`,
    "",
    "Feedback like this is exactly what shapes the beta. We read every word.",
    "",
    "Warmly,",
    "The Glowtrace team",
  ].join("\n");
  return `mailto:${encodeURIComponent(item.email)}?subject=${encodeURIComponent(
    "Thank you for your Glowtrace feedback",
  )}&body=${encodeURIComponent(body)}`;
};

export const firstNameFrom = (email: string, name?: string | null): string => {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const local = email.split("@")[0] ?? "";
  const word = local.split(/[._-]/)[0] ?? "";
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : "there";
};

/* ---------- Audit log ---------- */

export type AuditEntry = {
  id: number;
  at: string;
  actor_email: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  record_key: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
};

const field = (data: Record<string, unknown> | null, key: string): unknown => data?.[key];

/** One plain-language line per audit entry, for the admin dashboard. */
export const describeAudit = (entry: AuditEntry): string => {
  const who = entry.record_key ?? "a record";
  const { action, table_name: table, old_data: before, new_data: after } = entry;
  if (table === "beta_allowlist") {
    if (action === "DELETE") return `Removed ${who} from the invite list`;
    if (field(after, "revoked_at") && !field(before, "revoked_at"))
      return `Revoked access for ${who}`;
    const days = field(after, "duration_days");
    if (action === "INSERT") {
      return typeof days === "number"
        ? `Granted ${who} ${days} days of access`
        : `Added ${who} to the invite list`;
    }
    return typeof days === "number"
      ? `Extended ${who} by ${days} days`
      : `Updated access for ${who}`;
  }
  if (table === "waitlist") {
    if (action === "INSERT") return `${who} requested access`;
    if (action === "DELETE") return `Removed the access request from ${who}`;
    const status = field(after, "status");
    if (status === "declined") return `Declined the request from ${who}`;
    if (status === "approved") return `Approved the request from ${who}`;
    return `${who} asked for access again`;
  }
  if (table === "user_roles") {
    return action === "DELETE" ? `Removed admin rights from ${who}` : `Gave admin rights to ${who}`;
  }
  if (table === "feedback") {
    if (action === "DELETE") return "Deleted a feedback item";
    if (field(after, "thanked_at") && !field(before, "thanked_at"))
      return "Thanked a tester for feedback";
    const status = field(after, "status");
    return typeof status === "string" ? `Marked feedback ${status}` : "Updated a feedback item";
  }
  return `${action.toLowerCase()} on ${table}`;
};
