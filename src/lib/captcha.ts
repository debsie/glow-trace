import { TURNSTILE_ORIGIN } from "./security-headers";

/**
 * Bot check on email sign-in (Cloudflare Turnstile). The site key is public by design: it only
 * names the widget. The secret key lives in Supabase (Authentication, Attack Protection).
 */
export const TURNSTILE_SITE_KEY: string =
  import.meta.env["VITE_TURNSTILE_SITE_KEY"] ?? "0x4AAAAAAAGG_CI_7855MB04Z";

export const TURNSTILE_SCRIPT = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

/** Used on sign-in only when a real Supabase project is connected and not on a local address. */
export const captchaEnabled = (supabaseUrl: string | undefined, hostname: string): boolean =>
  Boolean(supabaseUrl) &&
  Boolean(TURNSTILE_SITE_KEY) &&
  hostname !== "localhost" &&
  hostname !== "127.0.0.1";
