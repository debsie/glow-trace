import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, ScanLine, Sparkles, Users } from "lucide-react";

import { Badge, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { wellnessScore } from "@/lib/beauty";
import { formatZar, PLANS, scansLeft } from "@/lib/plans";
import { pageHead, SITE, softwareApplicationSchema } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead({
      title: "Glowtrace AI — Skin, Hair & Nail Check-Ins for South Africa, From R0",
      description: SITE.description,
      path: "/",
      schema: [softwareApplicationSchema()],
    }),
  component: Dashboard,
});

const CATEGORY_LABEL: Record<string, string> = { skin: "Skin", hair: "Hair", nails: "Nails" };

function Dashboard() {
  const { profile, scans, activeClients, looks, tier, usage, rewards } = useAppState();
  const left = scansLeft(tier, usage.scans, rewards.bonusScans);
  const recent = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const pendingSignoff = looks.filter((look) => look.status === "sent").length;

  const actions = [
    {
      to: "/scan",
      label: "New Check-In",
      description: left === null ? "Skin, hair or nails" : `${left} free left this month`,
      icon: ScanLine,
    },
    {
      to: "/routine",
      label: "Daily Routine",
      description: "Match products on your shelf",
      icon: Sparkles,
    },
    {
      to: "/pro/clients",
      label: "MUA Studio",
      description:
        tier === "studio"
          ? `${activeClients.length} of ${PLANS.studio.limits.activeClients} active clients`
          : `For makeup artists · ${formatZar(PLANS.studio.monthlyZar)}/month`,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile.display_name.split(" ")[0]}`}
        subtitle="See how your skin, hair and nails are doing, and what to do about it today."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="glass group flex min-h-[96px] items-center gap-4 p-5 transition-transform hover:scale-[1.015]"
          >
            <span className="ai-gradient flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white">
              <action.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="font-display block text-lg font-bold">{action.label}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {action.description}
              </span>
            </span>
            <ArrowRight
              className="ml-auto h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
        ))}
      </div>

      {tier === "free" && (
        <section
          aria-labelledby="home-pitch"
          className="glass glow-border flex flex-wrap items-center justify-between gap-4 p-6"
        >
          <div className="max-w-xl">
            <h2 id="home-pitch" className="font-display text-2xl font-bold text-foreground">
              Your skin, hair and nails, <span className="ai-text">checked from a photo</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You're on the free plan: {PLANS.free.limits.scansPerMonth} check-ins a month, morning
              and evening routines, and DIY remedies. Go unlimited for{" "}
              {formatZar(PLANS.pro.monthlyZar)} a month — or invite friends and earn it free.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pricing"
              className="ai-gradient inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white"
            >
              See plans in rands
            </Link>
            <Link
              to="/refer"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-border bg-secondary/60 px-6 text-base font-semibold text-secondary-foreground"
            >
              <Gift className="h-4 w-4" aria-hidden="true" /> Earn free months
            </Link>
          </div>
        </section>
      )}

      <SectionCard title="Recent check-ins">
        <ul className="space-y-3">
          {recent.map((scan) => (
            <li
              key={scan.id}
              className="flex min-h-[72px] items-center gap-4 rounded-2xl border border-border bg-card/60 p-3"
            >
              <img
                src={scan.image_url}
                alt={`${CATEGORY_LABEL[scan.category]} scan`}
                width={56}
                height={56}
                loading="lazy"
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">
                  {CATEGORY_LABEL[scan.category]} scan
                  {scan.client_id && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      client scan
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(scan.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <Badge tone={wellnessScore(scan.biomarkers) >= 65 ? "success" : "warning"}>
                Score {wellnessScore(scan.biomarkers)}
              </Badge>
            </li>
          ))}
        </ul>
        <Link
          to="/scan"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Start a new check-in <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{scans.length}</p>
          <p className="text-sm text-muted-foreground">Total check-ins</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{activeClients.length}</p>
          <p className="text-sm text-muted-foreground">Active clients</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{pendingSignoff}</p>
          <p className="text-sm text-muted-foreground">Looks awaiting sign-off</p>
        </SectionCard>
      </div>
    </div>
  );
}
