import type { AccessRequest, AuditEntry, Feedback, FeedbackInput, Tester } from "./beta";
import { extendedExpiry } from "./beta";
import type { AccessDuration } from "./beta";

/**
 * Sample beta data for demo mode (no Supabase configured), so the admin dashboard and
 * feedback flow can be tried end to end. Lives in memory only; a reload resets it.
 */

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, now: Date) => new Date(now.getTime() - days * DAY).toISOString();
const ahead = (days: number, now: Date) => new Date(now.getTime() + days * DAY).toISOString();

export type DemoStore = {
  requests: AccessRequest[];
  testers: Tester[];
  feedback: Feedback[];
  audit: AuditEntry[];
};

const audit = (
  id: number,
  daysAgo: number,
  now: Date,
  table: string,
  action: AuditEntry["action"],
  key: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditEntry => ({
  id,
  at: ago(daysAgo, now),
  actor_email: table === "waitlist" && action === "INSERT" ? key : "admin@glowtrace.app",
  action,
  table_name: table,
  record_key: key,
  old_data: before,
  new_data: after,
});

export const seedDemoStore = (now: Date): DemoStore => ({
  audit: [
    audit(6, 3, now, "feedback", "UPDATE", "fb3", { status: "new" }, { status: "triaged" }),
    audit(5, 4, now, "feedback", "UPDATE", "fb5", {}, { status: "resolved", thanked_at: "x" }),
    audit(4, 12, now, "beta_allowlist", "INSERT", "thandi.m@mail.co.za", null, {
      duration_days: 14,
    }),
    audit(3, 17, now, "beta_allowlist", "INSERT", "pieter.v@mail.co.za", null, {
      duration_days: 14,
    }),
    audit(2, 19, now, "beta_allowlist", "INSERT", "lebo.k@mail.co.za", null, { duration_days: 30 }),
    audit(1, 20, now, "waitlist", "INSERT", "lebo.k@mail.co.za", null, { status: "pending" }),
  ],
  requests: [
    {
      email: "naledi.m@mail.co.za",
      name: "Naledi Mahlangu",
      note: "Bridal MUA in Pretoria. Would love to try the client lookbooks.",
      status: "pending",
      requested_at: ago(1, now),
      decided_at: null,
    },
    {
      email: "jason.p@mail.co.za",
      name: "Jason Pillay",
      note: "Dealing with redness after shaving.",
      status: "pending",
      requested_at: ago(2, now),
      decided_at: null,
    },
    {
      email: "amira.d@mail.co.za",
      name: "Amira Davids",
      note: "",
      status: "pending",
      requested_at: ago(4, now),
      decided_at: null,
    },
    {
      email: "lebo.k@mail.co.za",
      name: "Lebo Khumalo",
      note: "Curly hair, high porosity.",
      status: "approved",
      requested_at: ago(20, now),
      decided_at: ago(19, now),
    },
  ],
  testers: [
    {
      email: "lebo.k@mail.co.za",
      expires_at: ahead(11, now),
      duration_days: 30,
      revoked_at: null,
      added_at: ago(19, now),
    },
    {
      email: "thandi.m@mail.co.za",
      expires_at: ahead(2, now),
      duration_days: 14,
      revoked_at: null,
      added_at: ago(12, now),
    },
    {
      email: "pieter.v@mail.co.za",
      expires_at: ago(3, now),
      duration_days: 14,
      revoked_at: null,
      added_at: ago(17, now),
    },
  ],
  feedback: [
    {
      id: "fb1",
      email: "thandi.m@mail.co.za",
      rating: 2,
      category: "bug",
      message: "My scan photo turned sideways after I uploaded it from my phone.",
      page: "/scan",
      status: "new",
      thanked_at: null,
      created_at: ago(0.2, now),
    },
    {
      email: "lebo.k@mail.co.za",
      id: "fb2",
      rating: 5,
      category: "praise",
      message:
        "The agent told me to stop using my BHA and retinal on the same night. My skin has calmed down so much. Love this.",
      page: "/agent",
      status: "new",
      thanked_at: null,
      created_at: ago(0.6, now),
    },
    {
      id: "fb3",
      email: "pieter.v@mail.co.za",
      rating: 3,
      category: "idea",
      message: "Could the progress chart show my routine changes so I know what worked?",
      page: "/progress",
      status: "triaged",
      thanked_at: null,
      created_at: ago(3, now),
    },
    {
      id: "fb4",
      email: "lebo.k@mail.co.za",
      rating: 1,
      category: "other",
      message: "Hair scan said high porosity but my hairdresser says low. Confused.",
      page: "/scan",
      status: "new",
      thanked_at: null,
      created_at: ago(1.5, now),
    },
    {
      id: "fb5",
      email: "thandi.m@mail.co.za",
      rating: 4,
      category: "praise",
      message: "Offline mode is great on the taxi.",
      page: "/app",
      status: "resolved",
      thanked_at: ago(4, now),
      created_at: ago(6, now),
    },
  ],
});

let store: DemoStore | null = null;

export const demoStore = (): DemoStore => {
  store ??= seedDemoStore(new Date());
  return store;
};

/* Pure mutations on a store, shared by the demo API and tests. */

export const grantInStore = (
  data: DemoStore,
  email: string,
  days: AccessDuration,
  now: Date,
): string => {
  const existing = data.testers.find((tester) => tester.email === email);
  const expires = extendedExpiry(existing?.expires_at ?? null, days, now);
  if (existing) {
    existing.expires_at = expires;
    existing.duration_days = days;
    existing.revoked_at = null;
  } else {
    data.testers.unshift({
      email,
      expires_at: expires,
      duration_days: days,
      revoked_at: null,
      added_at: now.toISOString(),
    });
  }
  for (const request of data.requests) {
    if (request.email === email) {
      request.status = "approved";
      request.decided_at = now.toISOString();
    }
  }
  return expires;
};

export const addFeedbackToStore = (
  data: DemoStore,
  email: string,
  input: FeedbackInput,
  now: Date,
): Feedback => {
  const entry: Feedback = {
    id: `fb_${now.getTime()}_${data.feedback.length}`,
    email,
    rating: input.rating,
    category: input.category,
    message: input.message.trim(),
    page: input.page,
    status: "new",
    thanked_at: null,
    created_at: now.toISOString(),
  };
  data.feedback.unshift(entry);
  return entry;
};
