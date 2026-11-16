import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { Home, ScanLine, Sparkles, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { TierBadge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import type { Workspace } from "@/lib/types";

const NAV_ITEMS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/scan", label: "Scan", icon: ScanLine },
  { to: "/routine", label: "Routine", icon: Sparkles },
  { to: "/pro/clients", label: "Clients", icon: Users },
];

const WorkspaceSwitcher = () => {
  const { workspace, setWorkspace } = useAppState();
  const options: { id: Workspace; label: string }[] = [
    { id: "personal", label: "Personal App" },
    { id: "pro", label: "MUA Pro Portal" },
  ];
  return (
    <div
      className="flex rounded-full border border-border bg-secondary/60 p-1"
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
              ? "ai-gradient text-white"
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
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-2 py-1.5">
      <span className="ai-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white">
        {initials}
      </span>
      <span className="hidden text-sm font-semibold sm:block">{profile.display_name}</span>
      <TierBadge tier={profile.subscription_tier} />
    </div>
  );
};

const Logo = () => (
  <Link to="/" className="flex min-h-[44px] items-center gap-2">
    <Sparkles className="h-6 w-6 text-primary" aria-hidden="true" />
    <span className="ai-text font-display text-xl font-extrabold">Glowtrace AI</span>
  </Link>
);

const NavLinkList = ({ layout }: { layout: "side" | "bottom" }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  if (layout === "side") {
    return (
      <nav aria-label="Primary" className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-h-[50px] items-center gap-3 rounded-xl px-4 text-base font-semibold transition-colors ${
              isActive(item.to)
                ? "bg-accent/15 text-accent"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
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
    <nav aria-label="Primary" className="grid grid-cols-4">
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

/** App shell: sticky top bar, side rail on desktop, bottom nav on mobile. */
export const SiteShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh">
    <header className="glass sticky top-0 z-40 flex items-center justify-between gap-3 rounded-none border-x-0 border-t-0 px-4 py-3">
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
        <p className="mt-6 px-4 text-xs text-muted-foreground">
          Enterprise tier · unlimited AI scans
        </p>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:pb-10">{children}</main>
    </div>

    <div className="glass fixed inset-x-0 bottom-0 z-40 rounded-none border-x-0 border-b-0 lg:hidden">
      <NavLinkList layout="bottom" />
    </div>
  </div>
);
