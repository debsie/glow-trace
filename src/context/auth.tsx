import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { cloudConfigured, getSupabase } from "@/integrations/supabase/client";
import type { AccessState } from "@/lib/access";
import { checkEmail, displayNameFor, safeNext } from "@/lib/access";
import { requestAccess as sendAccessRequest } from "@/integrations/beta-api";
import { accessRequestSchema } from "@/lib/beta";

type Result = { ok: true } | { ok: false; reason: string };

type Auth = {
  access: AccessState;
  /** Send a one-time sign-in link to this email. */
  sendEmailLink: (email: string, next?: string) => Promise<Result>;
  signInWithGoogle: (next?: string) => Promise<Result>;
  signOut: () => Promise<void>;
  /** True for admin accounts (checked by the database; demo mode is always admin). */
  isAdmin: boolean;
  /** Ask for beta access, or for more time after it ends. */
  requestAccess: (name: string, note: string) => Promise<Result>;
  /** Permanently delete the signed-in account (profile included). */
  deleteAccount: () => Promise<Result>;
};

const AuthContext = createContext<Auth | null>(null);

const redirectUrl = (next?: string) =>
  `${window.location.origin}/login?next=${encodeURIComponent(safeNext(next))}`;

const friendly = (message: string | undefined): string =>
  message && /rate|too many/i.test(message)
    ? "Too many attempts. Wait a minute and try again."
    : "Something went wrong. Check your connection and try again.";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [access, setAccess] = useState<AccessState>(
    cloudConfigured ? { kind: "checking" } : { kind: "demo" },
  );
  const [isAdmin, setIsAdmin] = useState(!cloudConfigured);

  const resolve = useCallback(async (session: Session | null) => {
    const supabase = getSupabase();
    if (!supabase) return;
    const user = session?.user;
    if (!user?.email) {
      setAccess({ kind: "signed-out" });
      return;
    }
    const email = user.email.toLowerCase();
    const [{ data: allowed, error }, { data: profile }, window_, admin] = await Promise.all([
      supabase.rpc("has_beta_access"),
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.rpc("my_beta_access"),
      supabase.rpc("is_admin"),
    ]);
    setIsAdmin(admin.data === true);
    // my_beta_access returns at most one row: this person's own place on the invite list.
    const row: unknown = Array.isArray(window_.data) ? window_.data[0] : undefined;
    const listed = typeof row === "object" && row !== null;
    const expiresAt =
      listed && "expires_at" in row && typeof row.expires_at === "string" ? row.expires_at : null;
    if (error || allowed !== true) {
      // On the list but not allowed in: their window ended or was revoked.
      setAccess(listed ? { kind: "expired", email } : { kind: "waitlisted", email });
      return;
    }
    const name: unknown = profile?.display_name;
    setAccess({
      kind: "member",
      userId: user.id,
      email,
      displayName: displayNameFor(typeof name === "string" ? name : null, email),
      expiresAt,
    });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) void resolve(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Defer: calling Supabase inside this callback can deadlock the auth client.
      window.setTimeout(() => {
        if (active) void resolve(session);
      }, 0);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [resolve]);

  const sendEmailLink = useCallback(async (input: string, next?: string): Promise<Result> => {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, reason: "Sign-in isn't switched on yet." };
    const checked = checkEmail(input);
    if (!checked.ok) return checked;
    const { error } = await supabase.auth.signInWithOtp({
      email: checked.email,
      options: { emailRedirectTo: redirectUrl(next), shouldCreateUser: true },
    });
    return error ? { ok: false, reason: friendly(error.message) } : { ok: true };
  }, []);

  const signInWithGoogle = useCallback(async (next?: string): Promise<Result> => {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, reason: "Sign-in isn't switched on yet." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectUrl(next) },
    });
    return error ? { ok: false, reason: friendly(error.message) } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccess({ kind: "signed-out" });
    setIsAdmin(false);
  }, []);

  const requestAccess = useCallback(
    async (name: string, note: string): Promise<Result> => {
      if (access.kind !== "waitlisted" && access.kind !== "expired") {
        return { ok: false, reason: "Sign in first." };
      }
      const parsed = accessRequestSchema.safeParse({ name, note });
      if (!parsed.success) {
        return { ok: false, reason: parsed.error.issues[0]?.message ?? "Check the form." };
      }
      const result = await sendAccessRequest(access.email, parsed.data.name, parsed.data.note);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },
    [access],
  );

  const deleteAccount = useCallback(async (): Promise<Result> => {
    const supabase = getSupabase();
    if (!supabase) return { ok: true };
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return { ok: false, reason: friendly(error.message) };
    await supabase.auth.signOut();
    setAccess({ kind: "signed-out" });
    return { ok: true };
  }, []);

  const value = useMemo<Auth>(
    () => ({
      access,
      isAdmin,
      sendEmailLink,
      signInWithGoogle,
      signOut,
      requestAccess,
      deleteAccount,
    }),
    [access, isAdmin, sendEmailLink, signInWithGoogle, signOut, requestAccess, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): Auth => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
