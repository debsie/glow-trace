import { z } from "zod";

import { makeupPrep } from "./makeup";
import type { MakeupPrep } from "./makeup";
import type { ScanReport } from "./types";

/**
 * Makeup Day: one routine in three phases (before, after, recovery) from the latest skin scan
 * plus a short profile of what a photo cannot show. Pure rules, every line traceable to a reading
 * or an answer. Cosmetic guidance only.
 */

export const makeupProfileSchema = z.object({
  feel: z.enum(["oily", "combination", "normal", "dry"]),
  sensitive: z.boolean(),
  coverage: z.enum(["sheer", "light", "medium", "full"]),
  wear: z.enum(["short", "day", "long"]),
  waterproof: z.boolean(),
  climate: z.enum(["humid", "dry", "mild"]),
});

export type MakeupProfile = z.infer<typeof makeupProfileSchema>;

export const DEFAULT_PROFILE: MakeupProfile = {
  feel: "normal",
  sensitive: false,
  coverage: "medium",
  wear: "day",
  waterproof: false,
  climate: "mild",
};

export type Foundation = {
  base:
    | "Water-based"
    | "Oil-free, water-based"
    | "Hydrating (oil or glycerin rich)"
    | "Silicone-based"
    | "Mineral powder";
  why: string;
  finish: "Matte" | "Soft matte" | "Satin" | "Dewy";
  coverage: "Sheer" | "Light" | "Medium" | "Full";
  avoid: string[];
};

export type MakeupDay = {
  before: { prep: MakeupPrep | null; foundation: Foundation; setting: string };
  after: string[];
  recovery: string[];
};

const metric = (report: ScanReport | null, key: string): number | null =>
  report?.metrics.find((item) => item.key === key)?.value ?? null;

/** Oiliness: what the person feels, nudged by the shine reading when there is one. */
const oiliness = (report: ScanReport | null, profile: MakeupProfile): number => {
  const felt = { oily: 80, combination: 60, normal: 40, dry: 15 }[profile.feel];
  const shine = metric(report, "shine");
  return shine === null ? felt : Math.round(felt * 0.7 + shine * 0.3);
};

export const foundationFor = (report: ScanReport | null, profile: MakeupProfile): Foundation => {
  const hydration = metric(report, "hydration");
  const texture = metric(report, "texture") ?? 0;
  const redness = metric(report, "erythema") ?? 0;
  const evenness = metric(report, "discoloration") ?? 0;
  const oil = oiliness(report, profile);
  const dry = profile.feel === "dry" || (hydration !== null && hydration < 50);

  let base: Foundation["base"];
  let why: string;
  if (profile.sensitive || redness >= 65) {
    base = "Mineral powder";
    why = "Your skin reads reactive, and mineral formulas have the fewest common irritants.";
  } else if (dry) {
    base = "Hydrating (oil or glycerin rich)";
    why =
      "Your skin reads dry, so a hydrating base sits smoothly instead of clinging to dry patches.";
  } else if (oil >= 65) {
    base = "Oil-free, water-based";
    why =
      "Your skin runs oily, so an oil-free, water-based formula stays put without adding shine.";
  } else if (texture >= 55) {
    base = "Silicone-based";
    why = "Your texture reads uneven, and silicone bases blur and smooth the surface.";
  } else {
    base = "Water-based";
    why = "Your skin reads balanced, so a light water-based formula looks most like skin.";
  }

  const finish: Foundation["finish"] =
    oil >= 70
      ? "Matte"
      : oil >= 55 || profile.climate === "humid"
        ? "Soft matte"
        : dry
          ? "Dewy"
          : "Satin";

  const wanted = { sheer: 0, light: 1, medium: 2, full: 3 }[profile.coverage];
  const needed = evenness >= 50 ? 2 : evenness >= 30 ? 1 : 0;
  const coverage =
    (["Sheer", "Light", "Medium", "Full"] as const)[Math.max(wanted, needed)] ?? "Medium";

  const avoid: string[] = [];
  if (profile.sensitive || redness >= 55) avoid.push("Fragrance and essential oils");
  if (oil >= 65) avoid.push("Heavy oils and balms on the T-zone");
  if (dry) avoid.push("Powder foundations and long-wear mattifying formulas");
  if (texture >= 55) avoid.push("Shimmer or glitter on textured areas");

  return { base, why, finish, coverage, avoid };
};

export const removalSteps = (report: ScanReport | null, profile: MakeupProfile): string[] => {
  const redness = metric(report, "erythema") ?? 0;
  const gentle = profile.sensitive || redness >= 55;
  const steps: string[] = [];
  if (profile.waterproof || profile.wear === "long") {
    steps.push(
      "Massage a cleansing oil or balm onto dry skin for a minute, then emulsify with water and rinse.",
    );
  } else {
    steps.push(
      gentle
        ? "Press fragrance-free micellar water on with a soft pad, hold for 10 seconds, then lift. No rubbing."
        : "Remove most of the makeup with micellar water or a cleansing balm.",
    );
  }
  steps.push(
    "Eyes and lips: hold a remover-soaked pad on them for 15 seconds, then wipe downwards once.",
  );
  steps.push(
    gentle || profile.feel === "dry"
      ? "Second cleanse with a cream or milky, fragrance-free cleanser in lukewarm water."
      : "Second cleanse with your usual gentle gel or foam cleanser in lukewarm water.",
  );
  steps.push("Pat dry with a clean towel, never rub.");
  return steps;
};

export const recoverySteps = (report: ScanReport | null, profile: MakeupProfile): string[] => {
  const redness = metric(report, "erythema") ?? 0;
  const hydration = metric(report, "hydration");
  const steps = ["Hydrating serum on damp skin (hyaluronic acid or glycerin)."];
  steps.push(
    profile.feel === "oily"
      ? "Light gel moisturiser."
      : "Barrier moisturiser with ceramides, a little more on dry areas.",
  );
  if (redness >= 55 || profile.sensitive) {
    steps.push("Skip retinoids and acids tonight; skin that reads red needs a calm night.");
  } else if (profile.wear === "long") {
    steps.push("After long wear, skip strong actives tonight and go back to them tomorrow.");
  }
  if (hydration !== null && hydration < 50)
    steps.push("Optional: a hydrating sheet or overnight mask.");
  steps.push("Scan again tomorrow morning to see how your skin recovered.");
  return steps;
};

export const makeupDay = (report: ScanReport | null, profile: MakeupProfile): MakeupDay => {
  const oil = oiliness(report, profile);
  return {
    before: {
      prep: report ? makeupPrep(report) : null,
      foundation: foundationFor(report, profile),
      setting:
        oil >= 65 || profile.climate === "humid"
          ? "Translucent powder on the T-zone, then a setting spray."
          : profile.feel === "dry"
            ? "A hydrating setting spray instead of powder."
            : "A light dusting of powder only where you shine.",
    },
    after: removalSteps(report, profile),
    recovery: recoverySteps(report, profile),
  };
};

export const PROFILE_KEY = "glowtrace:makeup-profile:v1";

export const loadProfile = (): MakeupProfile | null => {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const parsed = makeupProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveProfile = (profile: MakeupProfile): void => {
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(makeupProfileSchema.parse(profile)));
  } catch {
    // Not saved: still used for this visit.
  }
};
