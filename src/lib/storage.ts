import { z } from "zod";

import { emptyUsage } from "./plans";

/**
 * Device-local persistence for plan, monthly usage and referral state.
 * Everything read back is Zod-validated; anything malformed falls back to defaults.
 */

const STORAGE_KEY = "glowtrace:account:v1";

export const accountSchema = z.object({
  tier: z.enum(["free", "pro", "studio"]),
  usage: z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    scans: z.number().int().min(0),
    coach: z.number().int().min(0),
  }),
  referredBy: z.string().nullable(),
  affiliateCode: z.string().nullable(),
});

export type AccountState = z.infer<typeof accountSchema>;

export const defaultAccount = (now: Date): AccountState => ({
  tier: "free",
  usage: emptyUsage(now),
  referredBy: null,
  affiliateCode: null,
});

export const parseAccount = (input: unknown, now: Date): AccountState => {
  const parsed = accountSchema.safeParse(input);
  return parsed.success ? parsed.data : defaultAccount(now);
};

export const loadAccount = (now: Date): AccountState => {
  if (typeof window === "undefined") return defaultAccount(now);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseAccount(JSON.parse(raw), now) : defaultAccount(now);
  } catch {
    return defaultAccount(now);
  }
};

export const clearAccount = (): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
};

export const saveAccount = (account: AccountState): void => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Storage full or blocked (private mode): the session still works, it just won't persist.
  }
};
