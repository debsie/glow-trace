import type { SubscriptionTier } from "./types";

/**
 * Launch pricing and plan limits. Every price, cap and gate message lives here so the
 * pricing page, the in-app gates and the tests can never drift apart.
 */

export type RoutineMode = "am" | "pm" | "premakeup" | "reset";

export type PlanFeature = {
  label: string;
  /** "soon" = promised on the plan but not built yet; shown with a badge, never as live. */
  status: "live" | "soon";
};

export type PlanLimits = {
  /** null = unlimited */
  scansPerMonth: number | null;
  shelfProducts: number;
  routineModes: readonly RoutineMode[];
  coachPerMonth: number;
  activeClients: number;
};

export type Plan = {
  id: SubscriptionTier;
  name: string;
  tagline: string;
  audience: string;
  monthlyZar: number;
  /** null = no yearly option (the free plan) */
  yearlyZar: number | null;
  priceNote: string;
  limits: PlanLimits;
  features: readonly PlanFeature[];
  /** Plain-language "where it stops", shown on the pricing card. */
  boundaries: readonly string[];
};

export const PLAN_ORDER: readonly SubscriptionTier[] = ["free", "pro", "studio"];

const ALL_MODES: readonly RoutineMode[] = ["am", "pm", "premakeup", "reset"];

export const PLANS: Record<SubscriptionTier, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Try it. No card, no catch.",
    audience: "First-timers and casual self-care",
    monthlyZar: 0,
    yearlyZar: null,
    priceNote: "Free forever",
    limits: {
      scansPerMonth: 2,
      shelfProducts: 5,
      routineModes: ["am", "pm"],
      coachPerMonth: 0,
      activeClients: 0,
    },
    features: [
      { label: "2 check-ins a month for skin, hair or nails", status: "live" },
      { label: "Morning and evening routines", status: "live" },
      { label: "Up to 5 products on your shelf", status: "live" },
      { label: "DIY home remedies when you're missing a product", status: "live" },
    ],
    boundaries: [
      "Check-ins pause after 2 a month",
      "No Pre-Makeup Prep or Barrier Reset routines",
      "No Routine Coach",
      "No client profiles",
    ],
  },
  pro: {
    id: "pro",
    name: "Glow Pro",
    tagline: "Your everyday skin, hair and nail tracker.",
    audience: "Anyone who takes their routine seriously",
    monthlyZar: 59,
    yearlyZar: 490,
    priceNote: "Less than a takeaway lunch",
    limits: {
      scansPerMonth: null,
      shelfProducts: 25,
      routineModes: ALL_MODES,
      coachPerMonth: 10,
      activeClients: 0,
    },
    features: [
      { label: "Unlimited skin, hair and nail check-ins", status: "live" },
      { label: "All 4 routines: AM, PM, Pre-Makeup Prep, Barrier Reset", status: "live" },
      { label: "Makeup Day: foundation match, removal and recovery", status: "live" },
      { label: "Up to 25 products on your shelf", status: "live" },
      { label: "Ingredient conflict checks", status: "live" },
      { label: "10 Routine Coach consults a month", status: "soon" },
    ],
    boundaries: [
      "For personal use — one person, one account",
      "No client roster or artist tools",
      "Routine Coach is capped at 10 consults a month",
    ],
  },
  studio: {
    id: "studio",
    name: "MUA Studio",
    tagline: "Run your bridal and event bookings from your phone.",
    audience: "Freelance bridal and event makeup artists",
    monthlyZar: 149,
    yearlyZar: 1290,
    priceNote: "Less than you'd charge for one trial",
    limits: {
      scansPerMonth: null,
      shelfProducts: 25,
      routineModes: ALL_MODES,
      coachPerMonth: 10,
      activeClients: 5,
    },
    features: [
      { label: "Everything in Glow Pro", status: "live" },
      { label: "Up to 5 active clients at a time", status: "live" },
      { label: "Client lookbooks with sign-off", status: "live" },
      { label: "Shareable guest links and codes", status: "soon" },
      { label: "7-day pre-event prep planner", status: "live" },
      { label: "Client check-in photo storage", status: "soon" },
      { label: "Printable PDF client briefs", status: "live" },
    ],
    boundaries: [
      "5 active clients at once — archive finished bookings to free a spot",
      "One artist login (salon teams come later)",
      'PDF briefs carry a small "Powered by Glowtrace Pro" note',
    ],
  },
};

/* ---------- Money ---------- */

/** "R59", "R1,290" — South African rand, no cents (all launch prices are whole rands). */
export const formatZar = (amount: number): string =>
  `R${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

/** Rands saved by paying yearly instead of 12 monthly payments; 0 when there is no yearly price. */
export const yearlySavingZar = (plan: Plan): number =>
  plan.yearlyZar === null ? 0 : Math.max(0, plan.monthlyZar * 12 - plan.yearlyZar);

/** Biggest yearly discount across plans as a whole percentage, for "save up to X%" copy. */
export const maxYearlySavingPct = (): number =>
  Math.max(
    ...PLAN_ORDER.map((id) => {
      const plan = PLANS[id];
      return plan.monthlyZar === 0
        ? 0
        : Math.round((yearlySavingZar(plan) / (plan.monthlyZar * 12)) * 100);
    }),
  );

export const tierRank = (tier: SubscriptionTier): number => PLAN_ORDER.indexOf(tier);

/* ---------- Monthly usage ---------- */

export type Usage = { month: string; scans: number; coach: number };

/** Calendar-month key in UTC, e.g. "2026-11". Limits reset on the 1st. */
export const monthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export const emptyUsage = (now: Date): Usage => ({ month: monthKey(now), scans: 0, coach: 0 });

/** Returns the same usage inside the month it was recorded, or a fresh one after rollover. */
export const currentUsage = (usage: Usage, now: Date): Usage =>
  usage.month === monthKey(now) ? usage : emptyUsage(now);

/** Monthly check-in allowance including referral bonus check-ins; null = unlimited. */
export const scanAllowance = (tier: SubscriptionTier, bonusScans = 0): number | null => {
  const base = PLANS[tier].limits.scansPerMonth;
  return base === null ? null : base + Math.max(0, bonusScans);
};

export const scansLeft = (tier: SubscriptionTier, used: number, bonusScans = 0): number | null => {
  const allowance = scanAllowance(tier, bonusScans);
  return allowance === null ? null : Math.max(0, allowance - used);
};

/* ---------- Gates ---------- */

export type Gate =
  | { allowed: true }
  | {
      allowed: false;
      /** Short heading for the upgrade card. */
      title: string;
      /** The friendly explanation — never a raw error. */
      message: string;
      /** Plan that removes the block, or null when the answer is "archive" / "talk to us". */
      upgradeTo: SubscriptionTier | null;
    };

export type BlockedGate = Extract<Gate, { allowed: false }>;

const OPEN: Gate = { allowed: true };

const perMonth = (plan: Plan): string => `${formatZar(plan.monthlyZar)}/month`;

export const scanGate = (tier: SubscriptionTier, used: number, bonusScans = 0): Gate => {
  const allowance = scanAllowance(tier, bonusScans);
  if (allowance === null || used < allowance) return OPEN;
  return {
    allowed: false,
    title: "That's your free check-ins for this month",
    message: `You've used your ${allowance} free check-ins this month. Unlock unlimited tracking and all 4 routine modes for ${perMonth(PLANS.pro)} — or invite a friend for bonus check-ins.`,
    upgradeTo: "pro",
  };
};

export const routineModeGate = (tier: SubscriptionTier, mode: RoutineMode): Gate => {
  if (PLANS[tier].limits.routineModes.includes(mode)) return OPEN;
  return {
    allowed: false,
    title: "This routine is part of Glow Pro",
    message: `Pre-Makeup Prep and Barrier Reset come with Glow Pro, along with unlimited check-ins, for ${perMonth(PLANS.pro)}.`,
    upgradeTo: "pro",
  };
};

/** Makeup Day: the Before phase is free; removal and recovery come with Glow Pro. */
export const makeupDayGate = (tier: SubscriptionTier): Gate => {
  if (tier !== "free") return OPEN;
  return {
    allowed: false,
    title: "Removal and recovery come with Glow Pro",
    message: `Get the full Makeup Day routine, from prep to the night after, with unlimited check-ins, for ${perMonth(PLANS.pro)}.`,
    upgradeTo: "pro",
  };
};

export const shelfGate = (tier: SubscriptionTier, productCount: number): Gate => {
  const cap = PLANS[tier].limits.shelfProducts;
  if (productCount < cap) return OPEN;
  if (tier === "free") {
    return {
      allowed: false,
      title: "Your shelf is full",
      message: `The free plan holds ${cap} products. Glow Pro gives you room for ${PLANS.pro.limits.shelfProducts} for ${perMonth(PLANS.pro)}.`,
      upgradeTo: "pro",
    };
  }
  return {
    allowed: false,
    title: "Your shelf is full",
    message: `You've reached ${cap} products. Take one off your shelf to add another.`,
    upgradeTo: null,
  };
};

export const coachGate = (tier: SubscriptionTier, used: number): Gate => {
  const cap = PLANS[tier].limits.coachPerMonth;
  if (cap === 0) {
    return {
      allowed: false,
      title: "Routine Coach is part of Glow Pro",
      message: `Ask the Routine Coach up to ${PLANS.pro.limits.coachPerMonth} times a month with Glow Pro for ${perMonth(PLANS.pro)}.`,
      upgradeTo: "pro",
    };
  }
  if (used < cap) return OPEN;
  return {
    allowed: false,
    title: "You've used this month's Coach consults",
    message: `That's all ${cap} Routine Coach consults for this month. They refresh on the 1st.`,
    upgradeTo: null,
  };
};

/** Can this plan open the artist workspace at all? */
export const studioAccessGate = (tier: SubscriptionTier): Gate => {
  if (PLANS[tier].limits.activeClients > 0) return OPEN;
  return {
    allowed: false,
    title: "Client tools live in MUA Studio",
    message: `Keep up to ${PLANS.studio.limits.activeClients} active clients, build lookbooks and get sign-off for ${perMonth(PLANS.studio)}.`,
    upgradeTo: "studio",
  };
};

export const ingredientGate = (tier: SubscriptionTier): Gate => {
  if (tier !== "free") return OPEN;
  return {
    allowed: false,
    title: "Ingredient checks come with Glow Pro",
    message: `Paste any ingredient list and see which products should not share a routine, for ${perMonth(PLANS.pro)}.`,
    upgradeTo: "pro",
  };
};

/** Can this artist add one more active client? */
export const clientGate = (tier: SubscriptionTier, activeClients: number): Gate => {
  const access = studioAccessGate(tier);
  if (!access.allowed) return access;
  const cap = PLANS[tier].limits.activeClients;
  if (activeClients < cap) return OPEN;
  return {
    allowed: false,
    title: "Your client list is full",
    message: `You've reached your ${cap} active clients on the Artist Launch tier. Archive past clients to make space, or get in touch for studio expansion.`,
    upgradeTo: null,
  };
};
