import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders, supabaseOrigins } from "@/lib/security-headers";

describe("Security headers", () => {
  const supabase = "https://ysbruktqgqpbkhbshthi.supabase.co";

  it("lets the page talk only to itself and the Supabase project", () => {
    const csp = contentSecurityPolicy(supabase);
    expect(csp).toContain(
      "connect-src 'self' https://ysbruktqgqpbkhbshthi.supabase.co wss://ysbruktqgqpbkhbshthi.supabase.co",
    );
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("googleapis");
  });

  it("allows Cloudflare Turnstile for scripts and frames, and nothing else third-party", () => {
    const csp = contentSecurityPolicy(supabase);
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp.match(/https:\/\/(?!ysbruktqgqpbkhbshthi)[a-z.]+/g)).toEqual([
      "https://challenges.cloudflare.com",
      "https://challenges.cloudflare.com",
    ]);
  });

  it("allows no other origins when Supabase is not configured or the URL is unsafe", () => {
    expect(supabaseOrigins(undefined)).toEqual([]);
    expect(supabaseOrigins("not a url")).toEqual([]);
    expect(supabaseOrigins("http://evil.example")).toEqual([]);
    expect(contentSecurityPolicy(undefined)).toContain("connect-src 'self';");
  });

  it("forces HTTPS, blocks framing and sniffing, and limits device features", () => {
    const headers = securityHeaders(supabase);
    expect(headers["Strict-Transport-Security"]).toMatch(/max-age=63072000/);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Permissions-Policy"]).toContain("camera=(self)");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
  });
});
