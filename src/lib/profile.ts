import { z } from "zod";

/**
 * Profile settings kept on this device: which picture to show (a photo, stored in the on-device
 * photo store, or one of the illustrated faces), the artist's business details used in price lists,
 * briefs and reminders, and the early-access switch. The name lives in the account (profiles table).
 */

export const AVATAR_ARTS = [
  "afro",
  "braids",
  "locs",
  "bun",
  "straight",
  "curls",
  "headwrap",
  "crop",
  "waves",
  "knots",
  "ponytail",
  "fringe",
] as const;
export type AvatarArt = (typeof AVATAR_ARTS)[number];

export const avatarSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("initials") }),
  z.object({ kind: z.literal("photo") }),
  z.object({ kind: z.literal("art"), id: z.enum(AVATAR_ARTS) }),
]);
export type AvatarChoice = z.infer<typeof avatarSchema>;

export const businessSchema = z.object({
  name: z.string().trim().max(80).default(""),
  whatsapp: z.string().trim().max(30).default(""),
  instagram: z
    .string()
    .trim()
    .max(31)
    .transform((handle) => handle.replace(/^@/, ""))
    .default(""),
  area: z.string().trim().max(80).default(""),
  specialties: z.string().trim().max(200).default(""),
});
export type Business = z.infer<typeof businessSchema>;

export const profilePrefsSchema = z.object({
  avatar: avatarSchema.default({ kind: "initials" }),
  business: businessSchema.default(businessSchema.parse({})),
  earlyAccess: z.boolean().default(false),
});
export type ProfilePrefs = z.infer<typeof profilePrefsSchema>;

export const PROFILE_KEY = "glowtrace:profile:v1";
export const PROFILE_EVENT = "glowtrace:profile";

export const defaultPrefs = (): ProfilePrefs => profilePrefsSchema.parse({});

export const loadPrefs = (): ProfilePrefs => {
  try {
    const parsed = profilePrefsSchema.safeParse(
      JSON.parse(window.localStorage.getItem(PROFILE_KEY) ?? "{}"),
    );
    return parsed.success ? parsed.data : defaultPrefs();
  } catch {
    return defaultPrefs();
  }
};

/** Saves and tells every open screen (the menu avatar, Settings) to refresh. */
export const savePrefs = (prefs: ProfilePrefs): void => {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profilePrefsSchema.parse(prefs)));
  } catch {
    // Not saved; still shown for this visit.
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
};

/** "AR" from "Ava Reyes"; one letter for one name. */
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "G";

/** The name an artist's clients see: the business name when set, else their own. */
export const artistName = (prefs: ProfilePrefs, displayName: string): string =>
  prefs.business.name || displayName;

/** "Profile 60% complete" style nudge for artists: which business details are still missing. */
export const missingBusiness = (business: Business): string[] =>
  (
    [
      ["name", "business name"],
      ["whatsapp", "WhatsApp number"],
      ["area", "area you work in"],
    ] as const
  ).flatMap(([key, label]) => (business[key] ? [] : [label]));
