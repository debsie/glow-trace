import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock, Gift, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { formatZar, maxYearlySavingPct, PLAN_ORDER, PLANS, yearlySavingZar } from "@/lib/plans";
import { REFERRAL_PROGRAM } from "@/lib/referrals";
import {
  breadcrumbSchema,
  faqSchema,
  pageHead,
  PRICING_FAQS,
  softwareApplicationSchema,
} from "@/lib/seo";

const searchSchema = z.object({
  ref: z.string().max(20).optional(),
  aff: z.string().max(20).optional(),
});

export const Route = createFileRoute("/pricing")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () =>
    pageHead({
      title: "Glowtrace Pricing in Rands — Free, Glow Pro R59, MUA Studio R149",
      description:
        "Simple South African pricing for the Glowtrace beauty app. Start free with 2 check-ins a month, go unlimited with Glow Pro for R59, or run your makeup clients with MUA Studio for R149.",
      path: "/pricing",
      schema: [
        softwareApplicationSchema(),
        faqSchema(PRICING_FAQS),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ]),
      ],
    }),
  component: PricingPage,
});

type Billing = "monthly" | "yearly";

const REASONS = [
  {
    title: "R59 is a small yes",
    body: "Glow Pro costs less than a takeaway lunch. It's a decision you can make on your own, on the spot, without checking the budget first.",
  },
  {
    title: "R149 pays for itself on one booking",
    body: "MUA Studio costs less than most artists charge for a single trial. Five active clients is a full month of bridal weekends, and archiving a finished booking opens the spot again.",
  },
  {
    title: "Limits you can see coming",
    body: "Every plan says exactly where it stops. When you get there you'll see a short, friendly note — never an error, and never a surprise charge.",
  },
];

function PricingPage() {
  const { tier, setTier, applyReferralCode, referredBy } = useAppState();
  const search = Route.useSearch();
  const [billing, setBilling] = useState<Billing>("monthly");
  const handledInvite = useRef(false);

  // Arriving on an invite or partner link: remember who sent this person.
  useEffect(() => {
    const code = search.ref ?? search.aff;
    if (!code || handledInvite.current) return;
    handledInvite.current = true;
    const result = applyReferralCode(code);
    if (result.ok) {
      toast.success(`Invite ${result.code} applied`, {
        description: `Your first ${REFERRAL_PROGRAM.friendFreeProDays} days of Glow Pro are free.`,
      });
    }
  }, [search.ref, search.aff, applyReferralCode]);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-4 text-center">
        <Badge tone="primary">Launch pricing · South Africa</Badge>
        <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          Know your skin. <span className="ai-text">Pay in rands.</span> Start free.
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">
          Three plans, no dollar conversions and no small print. Check your skin, hair and nails
          from a photo, get a routine built from what's already in your bathroom, and upgrade only
          if you want more.
        </p>
        {referredBy && (
          <p className="text-sm font-semibold text-success" role="status">
            <Gift className="mr-1 inline h-4 w-4" aria-hidden="true" />
            Invite {referredBy} applied — your first {REFERRAL_PROGRAM.friendFreeProDays} days of
            Glow Pro are free.
          </p>
        )}
      </header>

      <div
        className="mx-auto flex w-fit rounded-full border border-border bg-secondary/60 p-1"
        role="group"
        aria-label="Billing period"
      >
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={billing === option}
            onClick={() => setBilling(option)}
            className={`min-h-[50px] rounded-full px-6 text-sm font-bold transition-colors ${
              billing === option
                ? "ai-gradient text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option === "monthly" ? "Monthly" : `Yearly · save up to ${maxYearlySavingPct()}%`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const yearly = billing === "yearly" && plan.yearlyZar !== null;
          const price = yearly ? (plan.yearlyZar ?? 0) : plan.monthlyZar;
          const saving = yearlySavingZar(plan);
          const current = tier === id;
          const featured = id === "pro";
          return (
            <section
              key={id}
              aria-labelledby={`plan-${id}`}
              className={`glass flex flex-col p-6 ${featured ? "glow-border" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id={`plan-${id}`} className="font-display text-2xl font-bold">
                  {plan.name}
                </h2>
                {featured && <Badge tone="primary">Most popular</Badge>}
                {current && !featured && <Badge tone="success">Your plan</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.audience}</p>

              <p className="mt-5">
                <span className="font-display text-5xl font-extrabold text-foreground">
                  {formatZar(price)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.monthlyZar === 0 ? " forever" : yearly ? " / year" : " / month"}
                </span>
              </p>
              <p className="mt-1 min-h-[20px] text-sm text-muted-foreground">
                {plan.monthlyZar === 0
                  ? plan.priceNote
                  : yearly
                    ? `Save ${formatZar(saving)} a year`
                    : `${plan.priceNote} · or ${formatZar(plan.yearlyZar ?? 0)} a year`}
              </p>

              <p className="mt-4 text-sm font-semibold text-foreground">{plan.tagline}</p>

              <ul className="mt-4 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2">
                    {feature.status === "live" ? (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    ) : (
                      <Clock
                        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-foreground">
                      {feature.label}
                      {feature.status === "soon" && (
                        <span className="ml-2 text-xs font-semibold text-muted-foreground">
                          (coming soon)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="label-tracking mt-5 text-xs font-bold text-muted-foreground uppercase">
                Where it stops
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {plan.boundaries.map((boundary) => (
                  <li key={boundary} className="flex items-start gap-2">
                    <Minus className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {boundary}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={current}
                onClick={() => {
                  setTier(id);
                  toast.success(`You're now previewing ${plan.name}`, {
                    description: "Payments aren't switched on yet, so nothing was charged.",
                  });
                }}
                className={`mt-6 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold transition-transform hover:scale-[1.02] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100 ${
                  featured || id === "studio"
                    ? "ai-gradient text-white"
                    : "border border-border bg-secondary/60 text-secondary-foreground"
                }`}
              >
                {current
                  ? "Your current plan"
                  : plan.monthlyZar === 0
                    ? "Start free"
                    : `Choose ${plan.name}`}
              </button>
            </section>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground" role="note">
        Early-access preview: card payments aren't switched on yet. Choosing a plan here unlocks it
        on this device so you can try everything — you won't be charged.
      </p>

      <section aria-labelledby="why" className="space-y-4">
        <h2 id="why" className="font-display text-2xl font-bold">
          Why the plans look like this
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {REASONS.map((reason) => (
            <SectionCard key={reason.title}>
              <h3 className="font-display text-lg font-bold text-foreground">{reason.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{reason.body}</p>
            </SectionCard>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="earn"
        className="glass glow-violet flex flex-wrap items-center justify-between gap-4 p-6"
      >
        <div className="max-w-xl">
          <h2 id="earn" className="font-display text-2xl font-bold">
            Rather not pay at all?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite friends and earn free months — up to a full year. Or become a partner and earn
            30% of every payment from the people you bring in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/refer"
            className="ai-gradient inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white"
          >
            <Gift className="h-4 w-4" aria-hidden="true" /> Invite friends
          </Link>
          <Link
            to="/affiliates"
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-6 text-base font-semibold text-secondary-foreground"
          >
            Become a partner <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="faq" className="space-y-4">
        <h2 id="faq" className="font-display text-2xl font-bold">
          Questions people ask
        </h2>
        <div className="space-y-3">
          {PRICING_FAQS.map((faq) => (
            <SectionCard key={faq.question}>
              <h3 className="font-display text-lg font-bold text-foreground">{faq.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
            </SectionCard>
          ))}
        </div>
      </section>
    </div>
  );
}
