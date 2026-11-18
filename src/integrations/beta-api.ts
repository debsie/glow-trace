import type {
  AccessDuration,
  AccessRequest,
  Feedback,
  FeedbackInput,
  FeedbackStatus,
  Tester,
} from "@/lib/beta";
import { addFeedbackToStore, demoStore, grantInStore } from "@/lib/beta-demo";

import { getSupabase } from "./supabase/client";

/**
 * Beta administration and feedback, against Supabase when it is configured and the
 * in-memory sample store otherwise. Every write is also enforced by row-level security and
 * the admin_* database functions; the app never decides who is an admin.
 */

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; reason: string };

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = (message?: string): Result<never> => ({
  ok: false,
  reason:
    message && /admins only/i.test(message)
      ? "Only admins can do that."
      : (message ?? "Something went wrong. Try again."),
});

export type AdminData = { requests: AccessRequest[]; testers: Tester[]; feedback: Feedback[] };

export const isDemo = (): boolean => getSupabase() === null;

export const loadAdminData = async (): Promise<Result<AdminData>> => {
  const supabase = getSupabase();
  if (!supabase) {
    const store = demoStore();
    return ok({
      requests: [...store.requests],
      testers: [...store.testers],
      feedback: [...store.feedback],
    });
  }
  const [requests, testers, feedback] = await Promise.all([
    supabase
      .from("waitlist")
      .select("email, name, note, status, requested_at, decided_at")
      .order("requested_at", { ascending: false }),
    supabase
      .from("beta_allowlist")
      .select("email, expires_at, duration_days, revoked_at, added_at")
      .order("added_at", { ascending: false }),
    supabase
      .from("feedback")
      .select("id, email, rating, category, message, page, status, thanked_at, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  const error = requests.error ?? testers.error ?? feedback.error;
  if (error) return fail(error.message);
  return ok({
    requests: (requests.data ?? []) as AccessRequest[],
    testers: (testers.data ?? []) as Tester[],
    feedback: (feedback.data ?? []) as Feedback[],
  });
};

export const grantAccess = async (email: string, days: AccessDuration): Promise<Result<string>> => {
  const supabase = getSupabase();
  if (!supabase) return ok(grantInStore(demoStore(), email, days, new Date()));
  const { data, error } = await supabase.rpc("admin_grant_access", {
    p_email: email,
    p_days: days,
  });
  return error ? fail(error.message) : ok(String(data));
};

export const revokeAccess = async (email: string): Promise<Result> => {
  const supabase = getSupabase();
  if (!supabase) {
    const tester = demoStore().testers.find((item) => item.email === email);
    if (tester) tester.revoked_at = new Date().toISOString();
    return ok(undefined);
  }
  const { error } = await supabase.rpc("admin_revoke_access", { p_email: email });
  return error ? fail(error.message) : ok(undefined);
};

export const declineRequest = async (email: string): Promise<Result> => {
  const supabase = getSupabase();
  if (!supabase) {
    const request = demoStore().requests.find((item) => item.email === email);
    if (request) {
      request.status = "declined";
      request.decided_at = new Date().toISOString();
    }
    return ok(undefined);
  }
  const { error } = await supabase.rpc("admin_decline_request", { p_email: email });
  return error ? fail(error.message) : ok(undefined);
};

export const updateFeedback = async (
  id: string,
  patch: { status?: FeedbackStatus; thanked_at?: string },
): Promise<Result> => {
  const supabase = getSupabase();
  if (!supabase) {
    const entry = demoStore().feedback.find((item) => item.id === id);
    if (entry) Object.assign(entry, patch);
    return ok(undefined);
  }
  const { error } = await supabase.from("feedback").update(patch).eq("id", id);
  return error ? fail(error.message) : ok(undefined);
};

export const sendFeedback = async (email: string, input: FeedbackInput): Promise<Result> => {
  const supabase = getSupabase();
  if (!supabase) {
    addFeedbackToStore(demoStore(), email, input, new Date());
    return ok(undefined);
  }
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("feedback").insert({
    user_id: auth.user?.id,
    email,
    rating: input.rating,
    category: input.category,
    message: input.message,
    page: input.page,
  });
  return error ? fail() : ok(undefined);
};

/** Ask for access (or ask again after it ends). */
export const requestAccess = async (email: string, name: string, note: string): Promise<Result> => {
  const supabase = getSupabase();
  if (!supabase) return ok(undefined);
  const { error } = await supabase.from("waitlist").upsert(
    {
      email,
      name,
      note,
      status: "pending",
      decided_at: null,
      requested_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
  return error ? fail() : ok(undefined);
};
