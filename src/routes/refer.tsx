import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ClipboardCopy, Gift, MessageCircle, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge, GhostButton, PageHeader, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { FaqList } from "@/components/common/faq-list";
import { Reveal } from "@/components/motion/reveal";
import { useAppState } from "@/context/app-state";
import { useOrigin } from "@/hooks/use-origin";
import { PLANS } from "@/lib/plans";
import { REFERRAL_PROGRAM, referralShareText, shareLink, whatsappShareUrl } from "@/lib/referrals";
import { breadcrumbSchema, faqSchema, pageHead } from "@/lib/seo";
import type { Faq } from "@/lib/seo";

const REFER_FAQS: readonly Faq[] = [
  {
    question: "What does my friend get?",
    answer: `Their first ${REFERRAL_PROGRAM.friendFreeProDays} days of Glow Pro free: unlimited check-ins and all four routines.`,
  },
  {
    question: "What do I get?",
    answer: `${REFERRAL_PROGRAM.bonusScansPerFriend} bonus check-ins for every friend who joins, even on the free plan. And one free month of your plan for every friend who becomes a paying subscriber.`,
  },
  {
    question: "Is there a limit?",
    answer: `You can earn up to ${REFERRAL_PROGRAM.maxFreeMonths} free months — a full year — and up to ${REFERRAL_PROGRAM.maxBonusScansPerMonth} bonus check-ins a month. Your ${REFERRAL_PROGRAM.milestoneAt}th paying friend adds ${REFERRAL_PROGRAM.milestoneBonusMonths} bonus months on top.`,
  },
];

export const Route = createFileRoute("/refer")({
  head: () =>
    pageHead({
      title: "Invite Friends to Glowtrace — Earn Free Months, Up to a Full Year",
      description:
        "Share your Glowtrace invite link on WhatsApp. Your friend gets 30 days of Glow Pro free; you get bonus check-ins and a free month for every friend who subscribes.",
      path: "/refer",
      schema: [
        faqSchema(REFER_FAQS),
        breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Invite friends", path: "/refer" },
        ]),
      ],
    }),
  component: ReferPage,
});

const STEPS = [
  {
    title: "Share your link",
    body: "Send it on WhatsApp, drop it in your stories, or just read out your code.",
  },
  {
    title: "Your friend joins",
    body: `They get ${REFERRAL_PROGRAM.friendFreeProDays} days of Glow Pro free. You get ${REFERRAL_PROGRAM.bonusScansPerFriend} bonus check-ins straight away.`,
  },
  {
    title: "You get a free month",
    body: "Every friend who stays on as a paying subscriber earns you a month on the house.",
  },
];

const LADDER = [
  { friends: 1, reward: "1 month free" },
  { friends: 3, reward: "3 months free" },
  { friends: 5, reward: "7 months free (5 + 2 bonus)" },
  { friends: 10, reward: "A full year free" },
];

function ReferPage() {
  const { referralCode, referredBy, referralStats, rewards, applyReferralCode, tier } =
    useAppState();
  const [friendCode, setFriendCode] = useState("");

  const origin = useOrigin();
  const link = shareLink(origin, referralCode);
  const text = referralShareText(link);

  const copy = (value: string, label: string) => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied.`))
      .catch(() => toast.error("Couldn't copy — press and hold the text to copy it."));
  };

  const nativeShare = () => {
    if (typeof navigator.share === "function") {
      navigator.share({ title: "Glowtrace", text, url: link }).catch(() => undefined);
    } else {
      copy(text, "Invite message");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Give a month, get a month"
        subtitle="Your friends get Glow Pro free for 30 days. You earn free months — up to a full year."
      />

      <SectionCard className="">
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Your invite code
        </p>
        <p className="readout mt-1 text-4xl text-primary">{referralCode}</p>
        <p className="mt-2 break-all text-sm text-muted-foreground">{link}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={whatsappShareUrl(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-primary inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Share on WhatsApp
          </a>
          <GhostButton onClick={() => copy(link, "Invite link")}>
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copy link
          </GhostButton>
          <GhostButton onClick={nativeShare}>
            <Share2 className="h-4 w-4" aria-hidden="true" /> More ways to share
          </GhostButton>
        </div>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} delay={index * 90} className="surface lift p-5">
            <span className="readout flex h-10 w-10 items-center justify-center rounded-full border border-primary text-sm text-primary">
              0{index + 1}
            </span>
            <h2 className="mt-3 font-display text-lg font-semibold text-foreground">
              {step.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          </Reveal>
        ))}
      </div>

      <SectionCard title="Your rewards so far">
        <div className="grid gap-3 sm:grid-cols-3" aria-live="polite">
          <div>
            <p className="font-display text-3xl font-semibold text-foreground">
              {referralStats.subscribed}
            </p>
            <p className="text-sm text-muted-foreground">Friends subscribed</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-foreground">
              {rewards.freeMonths}
            </p>
            <p className="text-sm text-muted-foreground">Free months earned</p>
          </div>
          <div>
            <p className="font-display text-3xl font-semibold text-foreground">
              {rewards.bonusScans}
            </p>
            <p className="text-sm text-muted-foreground">Bonus check-ins this month</p>
          </div>
        </div>
        {rewards.nextMilestone && (
          <p className="mt-4 text-sm text-muted-foreground">
            <Gift className="mr-1 inline h-4 w-4 text-primary" aria-hidden="true" />
            {rewards.nextMilestone.friendsNeeded} more paying{" "}
            {rewards.nextMilestone.friendsNeeded === 1 ? "friend" : "friends"} unlocks{" "}
            <span className="font-semibold text-foreground">{rewards.nextMilestone.reward}</span>.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Early-access preview: invite tracking switches on with accounts, so these counts start at
          zero.
        </p>
      </SectionCard>

      <SectionCard title="What your invites are worth">
        <ul className="space-y-2">
          {LADDER.map((rung) => (
            <li
              key={rung.friends}
              className="flex min-h-[50px] items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4"
            >
              <span className="text-sm text-muted-foreground">
                {rung.friends} paying {rung.friends === 1 ? "friend" : "friends"}
              </span>
              <Badge tone="success">{rung.reward}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          Free months apply to the plan you're on
          {tier === "free" ? ` — on the free plan, that's ${PLANS.pro.name}.` : "."}
        </p>
      </SectionCard>

      <SectionCard title="Got a friend's code?">
        {referredBy ? (
          <p className="text-sm font-semibold text-success" role="status">
            Invite {referredBy} is applied to your account.
          </p>
        ) : (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const result = applyReferralCode(friendCode);
              if (result.ok) {
                toast.success(`Invite ${result.code} applied.`);
                setFriendCode("");
              } else {
                toast.error(result.reason);
              }
            }}
          >
            <input
              value={friendCode}
              onChange={(event) => setFriendCode(event.target.value)}
              placeholder="e.g. THANDI-7K2Q"
              aria-label="Friend's invite code"
              autoCapitalize="characters"
              className="min-h-[50px] min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base text-foreground uppercase placeholder:text-muted-foreground placeholder:normal-case"
            />
            <PrimaryButton type="submit">Apply code</PrimaryButton>
          </form>
        )}
      </SectionCard>

      <section aria-labelledby="refer-faq" className="space-y-3">
        <h2 id="refer-faq" className="font-display text-2xl font-semibold">
          How invites work
        </h2>
        <FaqList faqs={REFER_FAQS} />
      </section>

      <Link
        to="/affiliates"
        className="surface-strong flex min-h-[72px] items-center justify-between gap-3 p-5"
      >
        <span>
          <span className="font-display block text-lg font-semibold text-foreground">
            Have an audience or a client list?
          </span>
          <span className="block text-sm text-muted-foreground">
            Partners earn 30% in rands on every payment. See the partner programme.
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      </Link>
    </div>
  );
}
