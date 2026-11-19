import { PLANS } from "./plans";

/**
 * Referral ("invite a friend") and affiliate ("partner") programme rules.
 * Pure maths and string helpers only — tracking and payouts need a backend.
 */

/* ---------- Referral programme: for every user ---------- */

export const REFERRAL_PROGRAM = {
  /** Bonus check-ins the inviter gets, in the month a friend joins (even on the free plan). */
  bonusScansPerFriend: 2,
  /** Bonus check-ins can't pile up past this in one month. */
  maxBonusScansPerMonth: 10,
  /** What the invited friend gets. */
  friendFreeProDays: 30,
  /** Free months of your current paid plan for each friend who becomes a paying subscriber. */
  freeMonthsPerSubscriber: 1,
  /** Extra free months the moment your 5th friend subscribes. */
  milestoneAt: 5,
  milestoneBonusMonths: 2,
  /** Free months are capped at a full year. */
  maxFreeMonths: 12,
} as const;

/* ---------- Streak rewards: for every user ---------- */

export const STREAK_PROGRAM = {
  /** A week counts when at least one real scan was taken in it (Monday to Sunday, local time). */
  rewardAtWeeks: 4,
  /** Bonus check-ins in the month the streak reaches `rewardAtWeeks` or more. */
  bonusScans: 2,
} as const;

/** Bonus check-ins earned this month from a weekly streak. */
export const streakBonusScans = (weeklyStreak: number): number =>
  weeklyStreak >= STREAK_PROGRAM.rewardAtWeeks ? STREAK_PROGRAM.bonusScans : 0;

export type ReferralStats = {
  /** Friends who signed up with your code this month. */
  joinedThisMonth: number;
  /** Friends who became paying subscribers, all time. */
  subscribed: number;
};

export type ReferralRewards = {
  bonusScans: number;
  freeMonths: number;
  /** Paying friends still needed for the next reward step, or null when maxed out. */
  nextMilestone: { friendsNeeded: number; reward: string } | null;
};

const clampCount = (value: number): number => Math.max(0, Math.floor(value));

export const freeMonthsFor = (subscribedFriends: number): number => {
  const friends = clampCount(subscribedFriends);
  const base = friends * REFERRAL_PROGRAM.freeMonthsPerSubscriber;
  const bonus = friends >= REFERRAL_PROGRAM.milestoneAt ? REFERRAL_PROGRAM.milestoneBonusMonths : 0;
  return Math.min(REFERRAL_PROGRAM.maxFreeMonths, base + bonus);
};

export const referralRewards = (stats: ReferralStats): ReferralRewards => {
  const subscribed = clampCount(stats.subscribed);
  const bonusScans = Math.min(
    REFERRAL_PROGRAM.maxBonusScansPerMonth,
    clampCount(stats.joinedThisMonth) * REFERRAL_PROGRAM.bonusScansPerFriend,
  );
  const freeMonths = freeMonthsFor(subscribed);

  let nextMilestone: ReferralRewards["nextMilestone"] = null;
  if (freeMonths < REFERRAL_PROGRAM.maxFreeMonths) {
    nextMilestone =
      subscribed < REFERRAL_PROGRAM.milestoneAt
        ? {
            friendsNeeded: REFERRAL_PROGRAM.milestoneAt - subscribed,
            reward: `${REFERRAL_PROGRAM.milestoneBonusMonths} bonus months free`,
          }
        : { friendsNeeded: 1, reward: "another month free" };
  }
  return { bonusScans, freeMonths, nextMilestone };
};

/* ---------- Codes and share links ---------- */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I mix-ups
const CODE_PATTERN = /^[A-Z]{2,8}-[A-HJ-NP-Z2-9]{4}$/;

/** Deterministic, friendly code such as "AVA-7K2Q" from a display name and a stable user id. */
export const makeReferralCode = (displayName: string, userId: string): string => {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  const prefix =
    first
      .normalize("NFD")
      .replace(/[^A-Za-z]/g, "")
      .toUpperCase()
      .slice(0, 8) || "GLOW";
  const safePrefix = prefix.length < 2 ? "GLOW" : prefix;

  // FNV-1a hash of the user id → 4 characters from the unambiguous alphabet.
  let hash = 0x811c9dc5;
  for (let index = 0; index < userId.length; index += 1) {
    hash ^= userId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let suffix = "";
  for (let index = 0; index < 4; index += 1) {
    suffix += CODE_ALPHABET[hash % CODE_ALPHABET.length] ?? "A";
    hash = Math.floor(hash / CODE_ALPHABET.length);
  }
  return `${safePrefix}-${suffix}`;
};

export const normalizeCode = (input: string): string => input.trim().toUpperCase();

export const isValidCode = (input: string): boolean => CODE_PATTERN.test(normalizeCode(input));

export type RedeemResult = { ok: true; code: string } | { ok: false; reason: string };

/** A code can be redeemed once, must be well-formed, and can't be your own. */
export const redeemCode = (
  input: string,
  ownCode: string,
  alreadyReferredBy: string | null,
): RedeemResult => {
  const code = normalizeCode(input);
  if (alreadyReferredBy)
    return { ok: false, reason: "You've already used an invite code on this account." };
  if (!isValidCode(code))
    return { ok: false, reason: "That code doesn't look right — check the spelling." };
  if (code === normalizeCode(ownCode))
    return { ok: false, reason: "That's your own code — share it with a friend instead." };
  return { ok: true, code };
};

export type LinkKind = "ref" | "aff";

export const shareLink = (origin: string, code: string, kind: LinkKind = "ref"): string =>
  `${origin.replace(/\/+$/, "")}/pricing?${kind}=${encodeURIComponent(normalizeCode(code))}`;

export const referralShareText = (link: string): string =>
  `I'm using Glowtrace to track my skin, hair and nails. Join with my link and your first month of Glow Pro is free: ${link}`;

/** wa.me link — WhatsApp is how most South Africans will actually pass this on. */
export const whatsappShareUrl = (text: string): string =>
  `https://wa.me/?text=${encodeURIComponent(text)}`;

/* ---------- Affiliate programme: for artists, creators and salons ---------- */

export const AFFILIATE_PROGRAM = {
  /** Share of every payment a referred subscriber makes. */
  commissionRate: 0.3,
  /** Rate once you have this many active subscribers. */
  boostedRate: 0.4,
  boostAtActiveSubscribers: 25,
  /** Commission is paid on each subscriber's payments for this many months. */
  commissionMonths: 12,
  /** A click is credited to you if the person subscribes within this many days. */
  attributionDays: 60,
  minPayoutZar: 250,
  /** Active subscribers needed for a free MUA Studio plan. */
  freeStudioAtActiveSubscribers: 5,
} as const;

export type AffiliateAudience = { proSubscribers: number; studioSubscribers: number };

export type AffiliateEarnings = {
  activeSubscribers: number;
  rate: number;
  monthlyZar: number;
  /** Total over the full commission window if every subscriber stays. */
  windowZar: number;
  freeStudio: boolean;
};

export const affiliateRate = (activeSubscribers: number): number =>
  clampCount(activeSubscribers) >= AFFILIATE_PROGRAM.boostAtActiveSubscribers
    ? AFFILIATE_PROGRAM.boostedRate
    : AFFILIATE_PROGRAM.commissionRate;

export const affiliateEarnings = (audience: AffiliateAudience): AffiliateEarnings => {
  const pro = clampCount(audience.proSubscribers);
  const studio = clampCount(audience.studioSubscribers);
  const activeSubscribers = pro + studio;
  const rate = affiliateRate(activeSubscribers);
  const revenue = pro * PLANS.pro.monthlyZar + studio * PLANS.studio.monthlyZar;
  const monthlyZar = Math.round(revenue * rate * 100) / 100;
  return {
    activeSubscribers,
    rate,
    monthlyZar,
    windowZar: Math.round(monthlyZar * AFFILIATE_PROGRAM.commissionMonths * 100) / 100,
    freeStudio: activeSubscribers >= AFFILIATE_PROGRAM.freeStudioAtActiveSubscribers,
  };
};
