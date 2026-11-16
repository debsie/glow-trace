import { AFFILIATE_PROGRAM, REFERRAL_PROGRAM } from "./referrals";
import { formatZar, PLAN_ORDER, PLANS } from "./plans";

/**
 * Search, answer-engine and AI-assistant metadata: titles, descriptions, Open Graph,
 * canonical URLs and schema.org JSON-LD. One place, so every page stays consistent.
 */

const rawSiteUrl: unknown = import.meta.env["VITE_SITE_URL"];

/** Public origin, e.g. "https://glowtrace.co.za". Set VITE_SITE_URL; empty means "not launched yet". */
export const SITE_URL: string =
  typeof rawSiteUrl === "string" ? rawSiteUrl.trim().replace(/\/+$/, "") : "";

export const SITE = {
  name: "Glowtrace",
  tagline: "Skin, hair and nail diagnostics from a photo",
  description:
    "Glowtrace is a South African beauty app that checks your skin, hair and nails from a photo, builds a routine around the products you already own, and gives makeup artists a simple way to prep clients. Free to start, Glow Pro from R59 a month.",
  locale: "en_ZA",
  language: "en-ZA",
  country: "ZA",
  currency: "ZAR",
} as const;

export const absoluteUrl = (path: string): string => `${SITE_URL}${path}`;

type MetaTag = Record<string, string>;
type HeadScript = { type: string; children: string };

export type PageHead = {
  meta: MetaTag[];
  links: { rel: string; href: string }[];
  scripts: HeadScript[];
};

export const jsonLd = (data: Record<string, unknown>): HeadScript => ({
  type: "application/ld+json",
  // "<" is escaped so user-visible strings can never close the script tag.
  children: JSON.stringify(data).replace(/</g, "\\u003c"),
});

export const pageHead = (page: {
  title: string;
  description: string;
  path: string;
  /** Private app screens (client data) must stay out of search results. */
  noindex?: boolean;
  schema?: Record<string, unknown>[];
}): PageHead => {
  const url = absoluteUrl(page.path);
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { name: "robots", content: page.noindex ? "noindex, nofollow" : "index, follow" },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE.name },
      { property: "og:locale", content: SITE.locale },
      { property: "og:image", content: absoluteUrl("/og.png") },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${SITE.name} — ${SITE.tagline}` },
      ...(SITE_URL ? [{ property: "og:url", content: url }] : []),
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.title },
      { name: "twitter:description", content: page.description },
      { name: "twitter:image", content: absoluteUrl("/og.png") },
    ],
    links: SITE_URL && !page.noindex ? [{ rel: "canonical", href: url }] : [],
    scripts: (page.schema ?? []).map(jsonLd),
  };
};

/* ---------- schema.org builders ---------- */

export const organizationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.name,
  description: SITE.description,
  areaServed: { "@type": "Country", name: "South Africa" },
  ...(SITE_URL ? { url: SITE_URL, logo: absoluteUrl("/og.png") } : {}),
});

export const websiteSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE.name,
  inLanguage: SITE.language,
  ...(SITE_URL ? { url: SITE_URL } : {}),
});

/** The app plus its three plans as priced offers, so engines can quote rand prices directly. */
export const softwareApplicationSchema = (): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE.name,
  description: SITE.description,
  applicationCategory: "HealthApplication",
  applicationSubCategory: "Beauty and personal care",
  operatingSystem: "Web, iOS, Android",
  inLanguage: SITE.language,
  ...(SITE_URL ? { url: SITE_URL } : {}),
  offers: PLAN_ORDER.map((id) => {
    const plan = PLANS[id];
    return {
      "@type": "Offer",
      name: plan.name,
      description: plan.tagline,
      price: plan.monthlyZar.toFixed(2),
      priceCurrency: SITE.currency,
      category: plan.monthlyZar === 0 ? "free" : "subscription",
      eligibleRegion: { "@type": "Country", name: "South Africa" },
      ...(SITE_URL ? { url: absoluteUrl("/pricing") } : {}),
    };
  }),
});

export type Faq = { question: string; answer: string };

export const faqSchema = (faqs: readonly Faq[]): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
});

export const breadcrumbSchema = (
  trail: readonly { name: string; path: string }[],
): Record<string, unknown> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: trail.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    ...(SITE_URL ? { item: absoluteUrl(item.path) } : {}),
  })),
});

/* ---------- Questions people actually ask (shown on the page and in FAQ markup) ---------- */

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

export const PRICING_FAQS: readonly Faq[] = [
  {
    question: "What is Glowtrace?",
    answer:
      "Glowtrace is a beauty app made for South Africa. You take a photo, it gives you a quick read on your skin, hair or nails, and it builds a morning and evening routine from the products already on your shelf. Makeup artists can also use it to prep clients for weddings and events.",
  },
  {
    question: "How much does Glowtrace cost in South Africa?",
    answer: `Glowtrace has three plans, all priced in rands. Free costs R0 forever. Glow Pro is ${formatZar(PLANS.pro.monthlyZar)} a month or ${formatZar(PLANS.pro.yearlyZar ?? 0)} a year. MUA Studio, for makeup artists, is ${formatZar(PLANS.studio.monthlyZar)} a month or ${formatZar(PLANS.studio.yearlyZar ?? 0)} a year.`,
  },
  {
    question: "Is the free plan really free?",
    answer: `Yes. The free plan has no time limit and doesn't ask for a card. You get ${PLANS.free.limits.scansPerMonth} check-ins a month, morning and evening routines, a shelf of up to ${PLANS.free.limits.shelfProducts} products and DIY home remedies.`,
  },
  {
    question: "What happens when I reach a limit?",
    answer:
      "Nothing breaks and nothing is deleted. You'll see a short note explaining the limit and what unlocks it. Free check-ins come back on the 1st of every month, and you can earn bonus check-ins by inviting friends.",
  },
  {
    question: "Are my photos uploaded anywhere?",
    answer:
      "No. Check-ins run on your own device and your photos stay there. We don't upload them to our servers.",
  },
  {
    question: "Who is MUA Studio for?",
    answer: `MUA Studio is for freelance bridal and event makeup artists. It keeps up to ${PLANS.studio.limits.activeClients} active clients at a time, with skin notes, lookbooks and client sign-off in one place. When a booking is done you archive the client and the spot opens up again.`,
  },
  {
    question: "How does inviting a friend work?",
    answer: `Share your invite link. Your friend gets their first ${REFERRAL_PROGRAM.friendFreeProDays} days of Glow Pro free. You get ${REFERRAL_PROGRAM.bonusScansPerFriend} bonus check-ins when they join, and a free month of your plan every time a friend becomes a paying subscriber, up to ${REFERRAL_PROGRAM.maxFreeMonths} months.`,
  },
  {
    question: "Can I earn money by recommending Glowtrace?",
    answer: `Yes. Glowtrace partners earn ${pct(AFFILIATE_PROGRAM.commissionRate)} of every payment from the people they bring in, for ${AFFILIATE_PROGRAM.commissionMonths} months per subscriber. That rises to ${pct(AFFILIATE_PROGRAM.boostedRate)} once you have ${AFFILIATE_PROGRAM.boostAtActiveSubscribers} active subscribers. Payouts are in rands.`,
  },
  {
    question: "Is Glowtrace a medical or diagnostic tool?",
    answer:
      "No. Glowtrace is a cosmetic self-care guide. It can't diagnose or treat skin, hair or nail conditions. If something worries you, see a doctor or dermatologist.",
  },
];
