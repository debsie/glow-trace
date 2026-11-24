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

import { LineArt } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import { SkinWeatherCard } from "@/components/weather/skin-weather-card";
import { LightingInvite } from "@/components/engagement/lighting-invite";
import { useEnrolments } from "@/components/programmes/use-enrolments";
import { WeekRibbon } from "@/components/programmes/week-ribbon";
import { Badge, BUTTON_GHOST, BUTTON_PRIMARY, SectionCard } from "@/components/ui/bits";
import { ScoreRing } from "@/components/ui/score-ring";
import { dayKey } from "@/lib/engagement";
import { guideOfTheDay } from "@/lib/guides";
import { currentWeek, programmeById, weeklyCheckIns } from "@/lib/programmes";
import { useAppState } from "@/context/app-state";
import { useAuth } from "@/context/auth";
import { CheerCard } from "@/components/agent/cheer-card";
import { StreakCard } from "@/components/engagement/streak-card";
import { TodayCard } from "@/components/engagement/today-card";
import { briefing } from "@/lib/agent/agent";
import { scanScore } from "@/lib/beauty";
import { longDate, shortDate } from "@/lib/progress";
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

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
};

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
  const real = scans.filter((scan) => !scan.demo);
  const today = dayKey(new Date());
  const tip = guideOfTheDay(brief.findings, today);
  const { enrolments } = useEnrolments();
  const activeProgramme = enrolments
    .map((enrolment) => {
      const programme = programmeById(enrolment.id);
      if (!programme) return null;
      const week = currentWeek(enrolment, today);
      const plan = programme.weeks[Math.min(week, 3)];
      const nextIndex = plan?.steps.findIndex(
        (_, index) => !enrolment.ticks.includes(`${Math.min(week, 3)}-${index}`),
      );
      return {
        programme,
        week,
        checkIns: weeklyCheckIns(programme, enrolment, scans),
        next: plan && nextIndex !== undefined && nextIndex >= 0 ? plan.steps[nextIndex] : null,
      };
    })
    .find((item) => item !== null && item.week < 4);

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
      <section className="surface-strong page-enter relative overflow-hidden p-6 sm:p-8">
        <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <ScoreRing
            value={recent[0] ? scanScore(recent[0]) : null}
            label={recent[0] ? `${CATEGORY_LABEL[recent[0].category]} score` : "No scans yet"}
          />
          <div>
            <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
              {longDate(new Date().toISOString())}
            </p>
            <h1 className="mt-2 font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">
              {greeting()}, {profile.display_name.split(" ")[0]}.
            </h1>
            <p className="mt-3 max-w-xl text-lg text-muted-foreground">{brief.headline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/scan" className={BUTTON_PRIMARY}>
                <ScanLine className="h-5 w-5" aria-hidden="true" />{" "}
                {real.length ? "Scan now" : "Take your first scan"}
              </Link>
              <Link to="/agent" className={BUTTON_GHOST}>
                <MessagesSquare className="h-5 w-5" aria-hidden="true" /> Ask your agent
              </Link>
            </div>
            {topPick && (
              <p className="mt-4 text-sm text-muted-foreground">
                Suggested for you:{" "}
                <span className="font-semibold text-foreground">{topPick.product.name}</span> ·{" "}
                <span className="readout">{topPick.match}%</span> match
              </p>
            )}
          </div>
        </div>
      </section>

      {real.length === 0 ? (
        <section aria-labelledby="start" className="space-y-4">
          <h2 id="start" className="font-display text-3xl font-semibold">
            Three ways to begin
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                to: "/scan" as const,
                motif: "face" as const,
                title: "Take your first scan",
                body: "One photo of your skin, hair or nails, read on this phone.",
              },
              {
                to: "/programmes" as const,
                motif: "chart" as const,
                title: "Pick a four-week goal",
                body: "Calm redness, fade marks, keep your length or strengthen nails.",
              },
              {
                to: "/guides" as const,
                motif: "leaf" as const,
                title: "Read a Glow Guide",
                body: "Short, honest answers for every skin tone and hair type.",
              },
            ].map((item, index) => (
              <Reveal key={item.to} delay={index * 90}>
                <Link to={item.to} className="surface lift flex h-full flex-col gap-4 p-5">
                  <LineArt motif={item.motif} className="h-16 w-16" />
                  <span className="font-display text-xl font-semibold">{item.title}</span>
                  <span className="text-sm text-muted-foreground">{item.body}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="for-you" className="space-y-4">
        <h2
          id="for-you"
          className="label-tracking text-xs font-bold text-muted-foreground uppercase"
        >
          For you today
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Reveal>
            <Link
              to="/guides/$id"
              params={{ id: tip.guide.id }}
              className="surface lift flex h-full items-start justify-between gap-4 p-5"
            >
              <span>
                <span className="label-tracking block text-xs font-bold text-muted-foreground uppercase">
                  {tip.why === "reading" ? "Because of your readings" : "Today's guide"}
                </span>
                <span className="mt-2 block font-display text-2xl font-semibold">
                  {tip.guide.title}
                </span>
                <span className="mt-2 line-clamp-2 block text-sm text-muted-foreground">
                  {tip.guide.body[0]}
                </span>
              </span>
              <LineArt motif={tip.guide.motif} className="h-16 w-16 shrink-0" />
            </Link>
          </Reveal>
          <Reveal delay={90}>
            {activeProgramme ? (
              <Link
                to="/programmes/$id"
                params={{ id: activeProgramme.programme.id }}
                className="surface lift flex h-full flex-col justify-between gap-4 p-5"
              >
                <span>
                  <span className="label-tracking block text-xs font-bold text-muted-foreground uppercase">
                    Your programme · week {Math.min(activeProgramme.week + 1, 4)} of 4
                  </span>
                  <span className="mt-2 block font-display text-2xl font-semibold">
                    {activeProgramme.programme.title}
                  </span>
                  {activeProgramme.next && (
                    <span className="mt-2 block text-sm">Next: {activeProgramme.next}</span>
                  )}
                </span>
                <WeekRibbon current={activeProgramme.week} checkIns={activeProgramme.checkIns} />
              </Link>
            ) : (
              <Link
                to="/programmes"
                className="surface lift flex h-full items-start justify-between gap-4 p-5"
              >
                <span>
                  <span className="label-tracking block text-xs font-bold text-muted-foreground uppercase">
                    Programmes
                  </span>
                  <span className="mt-2 block font-display text-2xl font-semibold">
                    Pick a four-week goal
                  </span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    Three small steps a week, one check-in, and your own before and after.
                  </span>
                </span>
                <LineArt motif="chart" className="h-16 w-16 shrink-0" />
              </Link>
            )}
          </Reveal>
        </div>
        <Reveal className="mt-3">
          <SkinWeatherCard findings={brief.findings} />
        </Reveal>
        <Reveal className="mt-3">
          <LightingInvite />
        </Reveal>
      </section>

      {recent[0] && <CheerCard scans={scans} area={recent[0].category} />}

      <TodayCard scans={scans} />

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
