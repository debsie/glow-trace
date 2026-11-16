import { Link, useRouterState } from "@tanstack/react-router";
import { Droplets, Gift, Home, ScanLine, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { LogoMark, TierBadge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { PLANS, scansLeft } from "@/lib/plans";
import type { Workspace } from "@/lib/types";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/routine", label: "Routine", icon: Droplets },
  { to: "/pro/clients", label: "Clients", icon: Users },
  { to: "/refer", label: "Earn", icon: Gift },
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
    <nav aria-label="Primary" className="grid grid-cols-5">
      {NAV_ITEMS.map((item) => (
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

/** App shell: sticky top bar, side rail on desktop, bottom nav on mobile. */
export const SiteShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  // The landing page brings its own header and footer.
  if (pathname === "/") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
};

const AppShell = ({ children }: { children: React.ReactNode }) => (
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
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:pb-10">{children}</main>
    </div>

    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden">
      <NavLinkList layout="bottom" />
    </div>
  </div>
);
