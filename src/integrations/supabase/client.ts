import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase client. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (in .env.local for
 * development, and in the Vercel project's environment variables for production); both are
 * public by design (the publishable key only allows what row-level security allows).
 * Without them the app runs in demo mode: no sign-in, one sample profile.
 */
const url: unknown = import.meta.env["VITE_SUPABASE_URL"];
const key: unknown = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

export const cloudConfigured: boolean =
  typeof url === "string" && url.length > 0 && typeof key === "string" && key.length > 0;

let client: SupabaseClient | null = null;

/** The shared client in the browser; null on the server and in demo mode. */
export const getSupabase = (): SupabaseClient | null => {
  if (!cloudConfigured || typeof window === "undefined") return null;
  if (!client) {
    client = createClient(String(url), String(key), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });
  }
  return client;
};
