import { z } from "zod";

/**
 * Beta access rules, as pure functions. The real check is the has_beta_access() database
 * function; these decide what the app shows while it waits and what it accepts as input.
 */

export type AccessState =
  /** No Lovable Cloud configured: the app runs as a local demo. */
  | { kind: "demo" }
  /** Still reading the session or the access check. */
  | { kind: "checking" }
  | { kind: "signed-out" }
  /** Signed in but not on the invite list yet. */
  | { kind: "waitlisted"; email: string }
  /** Was a tester, but the access window ended or was revoked. */
  | { kind: "expired"; email: string }
  | {
      kind: "member";
      userId: string;
      email: string;
      displayName: string;
      /** ISO end of access; null when it has no end date. */
      expiresAt: string | null;
    };

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254, "That email is too long");

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: string };

export const checkEmail = (input: string): EmailCheck => {
  const parsed = emailSchema.safeParse(input);
  return parsed.success
    ? { ok: true, email: parsed.data }
    : { ok: false, reason: parsed.error.issues[0]?.message ?? "Enter a valid email address" };
};

/** Routes anyone can open. Everything else is the app and needs beta access. */
const PUBLIC_PATHS = ["/", "/pricing", "/refer", "/affiliates", "/login", "/privacy"];

export const isPublicPath = (pathname: string): boolean =>
  PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/sitemap");

/** What a page should do for the current access state. */
export const gateFor = (
  pathname: string,
  state: AccessState,
): "show" | "wait" | "sign-in" | "waitlist" | "expired" => {
  if (isPublicPath(pathname) || state.kind === "demo" || state.kind === "member") return "show";
  if (state.kind === "checking") return "wait";
  if (state.kind === "signed-out") return "sign-in";
  if (state.kind === "expired") return "expired";
  return "waitlist";
};

/** Name to show: the profile's name, else the part of the email before the @. */
export const displayNameFor = (profileName: string | null | undefined, email: string): string => {
  const name = profileName?.trim();
  if (name) return name.slice(0, 60);
  return email.split("@")[0]?.slice(0, 60) || "Glowtrace member";
};

/** Only same-site paths are allowed as a post-sign-in destination (no open redirects). */
export const safeNext = (next: unknown): string =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
