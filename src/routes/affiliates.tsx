import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCopy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, GhostButton, PageHeader, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { useOrigin } from "@/hooks/use-origin";
import { formatZar, PLANS } from "@/lib/plans";
import {
  AFFILIATE_PROGRAM,
  affiliateEarnings,
  referralShareText,
  shareLink,
  whatsappShareUrl,
} from "@/lib/referrals";
import { breadcrumbSchema, faqSchema, pageHead } from "@/lib/seo";
import type { Faq } from "@/lib/seo";

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

const AFFILIATE_FAQS: readonly Faq[] = [
  {
    question: "How much do Glowtrace partners earn?",
    answer: `${pct(AFFILIATE_PROGRAM.commissionRate)} of every payment made by each subscriber you bring in, for their first ${AFFILIATE_PROGRAM.commissionMonths} months. Once you have ${AFFILIATE_PROGRAM.boostAtActiveSubscribers} active subscribers, your rate goes up to ${pct(AFFILIATE_PROGRAM.boostedRate)}.`,
  },
  {
    question: "Who can join?",
    answer:
      "Makeup artists, salons, beauty therapists, content creators and anyone in South Africa whose clients or followers ask them for beauty advice.",
  },
  {
    question: "How and when am I paid?",
    answer: `Monthly, in rands, by EFT to your South African bank account, once your balance reaches ${formatZar(AFFILIATE_PROGRAM.minPayoutZar)}.`,
  },
  {
    question: "What do the people I send get?",
    answer:
      "Their first 30 days of Glow Pro free, so recommending Glowtrace costs your audience nothing to try.",
  },
  {
    question: "How long does my link count for?",
    answer: `${AFFILIATE_PROGRAM.attributionDays} days. If someone taps your link and subscribes within ${AFFILIATE_PROGRAM.attributionDays} days, they're credited to you.`,
  },
];

export const Route = createFileRoute("/affiliates")({
  head: () =>
    pageHead({
      title: "Glowtrace Partner Programme — Earn 30% in Rands for 12 Months",
      description:
        "South African makeup artists, salons and beauty creators earn 30% of every Glowtrace payment from the people they refer, for 12 months per subscriber. Paid monthly by EFT.",
      path: "/affiliates",
      schema: [
        faqSchema(AFFILIATE_FAQS),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Partner programme", path: "/affiliates" },
        ]),
      ],
    }),
  component: AffiliatesPage,
});

const PERKS = [
  {
    title: `${pct(AFFILIATE_PROGRAM.commissionRate)} of every payment`,
    body: `Not a once-off. You earn on each subscriber's payments for ${AFFILIATE_PROGRAM.commissionMonths} months.`,
  },
  {
    title: `${pct(AFFILIATE_PROGRAM.boostedRate)} when you grow`,
    body: `Reach ${AFFILIATE_PROGRAM.boostAtActiveSubscribers} active subscribers and your rate goes up on all of them.`,
  },
  {
    title: "MUA Studio on us",
    body: `Keep ${AFFILIATE_PROGRAM.freeStudioAtActiveSubscribers} active subscribers and your own ${PLANS.studio.name} plan is free.`,
  },
  {
    title: "Paid in rands",
    body: `Monthly EFT to your bank from ${formatZar(AFFILIATE_PROGRAM.minPayoutZar)}. No PayPal, no dollars.`,
  },
];

const Stepper = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <label className="block">
    <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold text-muted-foreground">
      {label}
      <span className="font-display text-lg font-semibold text-foreground">{value}</span>
    </span>
    <input
      type="range"
      min={0}
      max={100}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-[50px] w-full accent-primary"
    />
  </label>
);

function AffiliatesPage() {
  const { affiliateCode, activateAffiliate } = useAppState();
  const [pro, setPro] = useState(20);
  const [studio, setStudio] = useState(3);
  const earnings = affiliateEarnings({ proSubscribers: pro, studioSubscribers: studio });

  const origin = useOrigin();
  const link = affiliateCode ? shareLink(origin, affiliateCode, "aff") : "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Get paid for the advice you already give"
        subtitle={`Recommend Glowtrace to your clients and followers. Earn ${pct(AFFILIATE_PROGRAM.commissionRate)} of every payment they make, for ${AFFILIATE_PROGRAM.commissionMonths} months.`}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {PERKS.map((perk) => (
          <SectionCard key={perk.title}>
            <h2 className="font-display text-lg font-semibold text-foreground">{perk.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{perk.body}</p>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="What could you earn?" className="">
        <div className="grid gap-4 sm:grid-cols-2">
          <Stepper
            label={`${PLANS.pro.name} subscribers (${formatZar(PLANS.pro.monthlyZar)}/mo)`}
            value={pro}
            onChange={setPro}
          />
          <Stepper
            label={`${PLANS.studio.name} subscribers (${formatZar(PLANS.studio.monthlyZar)}/mo)`}
            value={studio}
            onChange={setStudio}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3" aria-live="polite">
          <div>
            <p className="text-primary font-display text-4xl font-semibold">
              {formatZar(earnings.monthlyZar)}
            </p>
            <p className="text-sm text-muted-foreground">a month</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-foreground">
              {formatZar(earnings.windowZar)}
            </p>
            <p className="text-sm text-muted-foreground">
              over {AFFILIATE_PROGRAM.commissionMonths} months
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <Badge tone="primary">{pct(earnings.rate)} rate</Badge>
            {earnings.freeStudio && <Badge tone="success">Free {PLANS.studio.name}</Badge>}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          An estimate, assuming every subscriber pays monthly and stays. Actual earnings depend on
          who subscribes and for how long.
        </p>
      </SectionCard>

      <SectionCard title="Your partner link">
        {affiliateCode ? (
          <>
            <p className="break-all text-sm text-foreground">{link}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={whatsappShareUrl(referralShareText(link))}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold text-primary-foreground"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" /> Share on WhatsApp
              </a>
              <GhostButton
                onClick={() => {
                  navigator.clipboard
                    .writeText(link)
                    .then(() => toast.success("Partner link copied."))
                    .catch(() => toast.error("Couldn't copy — press and hold the link instead."));
                }}
              >
                <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy link
              </GhostButton>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Get a personal link to put in your bio, your booking confirmations and your WhatsApp
              status.
            </p>
            <PrimaryButton
              className="mt-3"
              onClick={() => {
                activateAffiliate();
                toast.success("Your partner link is ready.");
              }}
            >
              Get my partner link
            </PrimaryButton>
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Early-access preview: commission tracking and payouts switch on with accounts and
          payments.
        </p>
      </SectionCard>

      <section aria-labelledby="partner-faq" className="space-y-3">
        <h2 id="partner-faq" className="font-display text-2xl font-semibold">
          Partner questions
        </h2>
        {AFFILIATE_FAQS.map((faq) => (
          <SectionCard key={faq.question}>
            <h3 className="font-display text-lg font-semibold text-foreground">{faq.question}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
          </SectionCard>
        ))}
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Just want free months for yourself?{" "}
        <Link to="/refer" className="font-semibold text-primary hover:underline">
          Invite friends instead
        </Link>
        .
      </p>
    </div>
  );
}
