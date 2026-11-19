import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { loadOnboarding } from "@/lib/onboarding";
import {
  ArrowRight,
  Droplets,
  FlaskConical,
  Gift,
  MessagesSquare,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";

import { Badge, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { useAuth } from "@/context/auth";
import { CheerCard } from "@/components/agent/cheer-card";
import { StreakCard } from "@/components/engagement/streak-card";
import { briefing } from "@/lib/agent/agent";
import { scanScore } from "@/lib/beauty";
import { shortDate } from "@/lib/progress";
import { formatZar, PLANS, scansLeft } from "@/lib/plans";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/app")({
  head: () =>
    pageHead({
      title: "Your Dashboard — Glowtrace",
      description: "Recent scans, daily routines and client work in one place.",
      path: "/app",
      noindex: true,
    }),
  component: Dashboard,
});

const CATEGORY_LABEL: Record<string, string> = { skin: "Skin", hair: "Hair", nails: "Nails" };

function Dashboard() {
  const { profile, scans, activeClients, looks, tier, usage, rewards, catalog, inventory } =
    useAppState();
  const navigate = useNavigate();
  // First visit: onboarding first. Answers live on the device, so a new device asks again.
  useEffect(() => {
    if (loadOnboarding() === null) void navigate({ to: "/welcome", replace: true });
  }, [navigate]);
  const { isAdmin } = useAuth();
  const brief = briefing(scans, catalog, inventory);
  const topPick = brief.suggestions.find((suggestion) => !suggestion.onShelf);
  const left = scansLeft(tier, usage.scans, rewards.bonusScans);
  const recent = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const pendingSignoff = looks.filter((look) => look.status === "sent").length;

  const actions = [
    {
      to: "/scan",
      label: "New scan",
      description: left === null ? "Skin, hair or nails" : `${left} free left this month`,
      icon: ScanLine,
    },
    {
      to: "/routine",
      label: "Daily routine",
      description: "Match products on your shelf",
      icon: Droplets,
    },
    {
      to: "/ingredients",
      label: "Ingredient check",
      description: "See which products clash",
      icon: FlaskConical,
    },
    {
      to: "/pro/clients",
      label: "MUA portal",
      description:
        tier === "studio"
          ? `${activeClients.length} of ${PLANS.studio.limits.activeClients} active clients`
          : `For makeup artists · ${formatZar(PLANS.studio.monthlyZar)}/month`,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${profile.display_name.split(" ")[0]}`}
        subtitle="Your latest readings and what to do next."
      />

      <Link to="/agent" className="surface-strong lift grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-4 sm:flex-col sm:items-start sm:justify-center">
          <p className="font-display text-6xl leading-none font-semibold text-foreground">
            {recent[0] ? scanScore(recent[0]) : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            {recent[0]
              ? `${CATEGORY_LABEL[recent[0].category]} score · ${shortDate(recent[0].created_at)}`
              : "No scans yet"}
          </p>
        </div>
        <div className="flex flex-col justify-center">
          <span className="flex items-center gap-2 text-xs font-bold tracking-[0.1em] text-muted-foreground uppercase">
            <MessagesSquare className="h-4 w-4 text-accent" aria-hidden="true" /> Your care agent
          </span>
          <span className="mt-2 block font-display text-xl leading-snug font-semibold text-foreground">
            {brief.headline}
          </span>
          {topPick && (
            <span className="mt-2 block text-sm text-muted-foreground">
              Suggested:{" "}
              <span className="font-semibold text-foreground">{topPick.product.name}</span> ·{" "}
              {topPick.match}% match
            </span>
          )}
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
            Open your agent <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </Link>

      {recent[0] && <CheerCard scans={scans} area={recent[0].category} />}

      <StreakCard scans={scans} />

      <section aria-label="Quick actions" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="surface lift flex min-h-[112px] flex-col justify-between p-5"
          >
            <action.icon className="h-6 w-6 text-accent" aria-hidden="true" />
            <span>
              <span className="font-display block text-lg font-semibold">{action.label}</span>
              <span className="block text-sm text-muted-foreground">{action.description}</span>
            </span>
          </Link>
        ))}
      </section>

      {tier === "free" && !isAdmin && (
        <section
          aria-labelledby="home-pitch"
          className="surface flex flex-wrap items-center justify-between gap-4 p-6"
        >
          <div className="max-w-xl">
            <h2 id="home-pitch" className="font-display text-xl font-semibold text-foreground">
              Unlimited check-ins for {formatZar(PLANS.pro.monthlyZar)} a month
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The free plan has {PLANS.free.limits.scansPerMonth} check-ins a month. Invite friends
              and earn Pro free.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/pricing"
              className="bg-primary inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold text-primary-foreground"
            >
              See plans in rands
            </Link>
            <Link
              to="/refer"
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-6 text-base font-semibold text-foreground"
            >
              <Gift className="h-4 w-4" aria-hidden="true" /> Earn free months
            </Link>
          </div>
        </section>
      )}

      <SectionCard title="Recent scans">
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
                <p className="font-display font-semibold">
                  {CATEGORY_LABEL[scan.category]} scan
                  {scan.client_id && (
                    <span className="ml-2 text-xs font-medium text-muted-foreground">
                      client scan
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{shortDate(scan.created_at)}</p>
              </div>
              <Badge tone={scanScore(scan) >= 65 ? "success" : "warning"}>
                Score {scanScore(scan)}
              </Badge>
            </li>
          ))}
        </ul>
        <Link
          to="/scan"
          className="mt-4 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          Run a new analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </SectionCard>

      <Link
        to="/privacy"
        className="surface lift flex min-h-[64px] items-center gap-3 px-5 text-sm text-muted-foreground"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
        <span>
          <span className="font-semibold text-foreground">Saved on this device only.</span> Download
          or delete your data any time.
        </span>
        <ArrowRight className="ml-auto h-5 w-5 shrink-0" aria-hidden="true" />
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard>
          <p className="font-display text-3xl font-semibold text-foreground">{scans.length}</p>
          <p className="text-sm text-muted-foreground">Total scans</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-semibold text-foreground">
            {activeClients.length}
          </p>
          <p className="text-sm text-muted-foreground">Active clients</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-semibold text-foreground">{pendingSignoff}</p>
          <p className="text-sm text-muted-foreground">Looks awaiting sign-off</p>
        </SectionCard>
      </div>
    </div>
  );
}
