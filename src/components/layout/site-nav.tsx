import { Link, useRouterState } from "@tanstack/react-router";
import {
  Droplets,
  Gift,
  Home,
  LayoutDashboard,
  LineChart,
  MessagesSquare,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AccessGate } from "@/components/auth/access-gate";
import { useAuth } from "@/context/auth";
import { gateFor } from "@/lib/access";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { Badge, LogoMark, TierBadge } from "@/components/ui/bits";
import { daysLeft, ENDING_SOON_DAYS } from "@/lib/beta";
import { useAppState } from "@/context/app-state";
import { PLANS, scansLeft } from "@/lib/plans";
import type { Workspace } from "@/lib/types";

/** `sideOnly` items stay out of the phone bar so it never holds more than six. */
const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; sideOnly?: boolean }[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/agent", label: "Agent", icon: MessagesSquare },
  { to: "/routine", label: "Routine", icon: Droplets },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/pro/clients", label: "Clients", icon: Users },
  { to: "/refer", label: "Earn", icon: Gift, sideOnly: true },
];

const WorkspaceSwitcher = () => {
  const { workspace, setWorkspace } = useAppState();
  const options: { id: Workspace; label: string }[] = [
    { id: "personal", label: "Personal App" },
    { id: "pro", label: "MUA Pro Portal" },
  ];
  return (
    <div
      className="flex rounded-full border border-border bg-secondary p-1"
      role="tablist"
      aria-label="Workspace"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={workspace === option.id}
          onClick={() => setWorkspace(option.id)}
          className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors ${
            workspace === option.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const ProfilePill = () => {
  const { profile } = useAppState();
  const initials = profile.display_name
    .split(" ")
    .map((part) => part[0])
    .join("");
  return (
    <Link
      to="/pricing"
      aria-label={`${profile.display_name}, ${PLANS[profile.subscription_tier].name} plan — view plans`}
      className="flex min-h-[50px] items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5"
    >
      <span className="bg-primary flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-primary-foreground">
        {initials}
      </span>
      <span className="hidden text-sm font-semibold sm:block">{profile.display_name}</span>
      <TierBadge tier={profile.subscription_tier} />
    </Link>
  );
};

const Logo = () => (
  <Link to="/app" className="flex min-h-[50px] items-center gap-2">
    <LogoMark />
    <span className="font-display text-xl font-semibold text-foreground">Glowtrace</span>
  </Link>
);

const NavLinkList = ({ layout }: { layout: "side" | "bottom" }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname.startsWith(to);
  if (layout === "side") {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive(item.to) ? "page" : undefined}
            className={`flex min-h-[50px] items-center gap-3 rounded-xl px-4 text-base font-semibold transition-colors ${
              isActive(item.to)
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Primary" className="grid grid-cols-6">
      {NAV_ITEMS.filter((item) => !item.sideOnly).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          aria-current={isActive(item.to) ? "page" : undefined}
          className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
            isActive(item.to) ? "text-accent" : "text-muted-foreground"
          }`}
        >
          <item.icon className="h-5 w-5" aria-hidden="true" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

const PlanSummary = () => {
  const { tier, usage, rewards } = useAppState();
  const left = scansLeft(tier, usage.scans, rewards.bonusScans);
  return (
    <Link
      to="/pricing"
      className="mt-6 block min-h-[50px] rounded-xl px-4 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      <span className="block font-semibold text-foreground">{PLANS[tier].name} plan</span>
      {left === null ? "Unlimited check-ins" : `${left} free check-ins left this month`}
      <span className="block text-primary">See plans and pricing</span>
    </Link>
  );
};

/** Beta testers see how long their access lasts, with a heads-up near the end. */
const BetaNotice = () => {
  const { access, isAdmin } = useAuth();
  if (access.kind !== "member" && access.kind !== "demo") return null;
  const left = access.kind === "member" ? daysLeft(access.expiresAt, new Date()) : null;
  const ending = left !== null && left <= ENDING_SOON_DAYS;
  return (
    <div className="mt-4 space-y-1 px-4 text-xs">
      <span className="flex items-center gap-2">
        <Badge tone={ending ? "warning" : "accent"}>Beta</Badge>
        <span className={ending ? "font-semibold text-warning" : "text-muted-foreground"}>
          {left === null ? "Early access" : `${left} ${left === 1 ? "day" : "days"} left`}
        </span>
      </span>
      {isAdmin && (
        <Link
          to="/admin"
          className="flex min-h-[44px] items-center gap-2 font-semibold text-primary hover:underline"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Beta dashboard
        </Link>
      )}
    </div>
  );
};

/** App shell: sticky top bar, side rail on desktop, bottom nav on mobile. */
export const SiteShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The landing page brings its own header and footer.
  const { access } = useAuth();
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/cookies" ||
    pathname === "/skin-analysis-app" ||
    pathname === "/makeup-artist-app"
  )
    return <>{children}</>;
  // Not let in yet: show sign-in or the waitlist on its own, with no app chrome or profile.
  if (gateFor(pathname, access) !== "show") {
    return (
      <div className="min-h-dvh px-4 py-10">
        <AccessGate>{children}</AccessGate>
      </div>
    );
  }
  return <AppShell>{children}</AppShell>;
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <Logo />
        <div className="hidden sm:block">
          <WorkspaceSwitcher />
        </div>
        <ProfilePill />
      </header>

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-[72px] hidden h-fit w-60 shrink-0 py-6 pl-4 lg:block">
          <div className="mb-4 sm:hidden">
            <WorkspaceSwitcher />
          </div>
          <NavLinkList layout="side" />
          <PlanSummary />
          <BetaNotice />
          <Link
            to="/privacy"
            className="mt-1 flex min-h-[50px] items-center gap-2 rounded-xl px-4 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Your data and privacy
          </Link>
        </aside>

        <main key={pathname} className="page-enter min-w-0 flex-1 px-4 py-6 pb-28 lg:pb-10">
          {children}
        </main>
      </div>

      {pathname !== "/admin" && <FeedbackButton />}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden">
        <NavLinkList layout="bottom" />
      </div>
    </div>
  );
};
