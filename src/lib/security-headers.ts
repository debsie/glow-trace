/**
 * HTTP security headers for every response. Pure, so the policy is tested; applied by Nitro
 * route rules in vite.config.ts.
 */

/** Cloudflare Turnstile, the bot check on sign-in. Kept here so this file stays free of Vite-only code. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Origins of the Supabase project, for the content security policy (https and websocket). */
export const supabaseOrigins = (supabaseUrl: string | undefined): string[] => {
  if (!supabaseUrl) return [];
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== "https:" && url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      return [];
    }
    return [url.origin, `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}`];
  } catch {
    return [];
  }
};

/**
 * The content security policy: the page may only load code, styles, fonts and images from this
 * site, and may only talk to this site and the Supabase project.
 * 'unsafe-inline' is needed for scripts because server rendering inlines the data the page
 * hydrates from; everything else stays strict.
 */
export const contentSecurityPolicy = (supabaseUrl: string | undefined): string =>
  [
    "default-src 'self'",
    // Cloudflare Turnstile (bot check on sign-in) is the only third-party script and frame.
    // 'wasm-unsafe-eval' lets the on-device face guide (MediaPipe, served from this site) run.
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' ${TURNSTILE_ORIGIN}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${["'self'", ...supabaseOrigins(supabaseUrl)].join(" ")}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

export const securityHeaders = (supabaseUrl: string | undefined): Record<string, string> => ({
  "Content-Security-Policy": contentSecurityPolicy(supabaseUrl),
  // Two years of HTTPS-only, on every subdomain.
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // The camera is allowed for this site only (photo capture); everything else is off.
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), browsing-topics=(), interest-cohort=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
});
