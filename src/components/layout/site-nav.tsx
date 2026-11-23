import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  LogOut,
  Target,
  CreditCard,
  Droplets,
  FlaskConical,
  Gift,
  Home,
  LayoutDashboard,
  LineChart,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  ScanLine,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AccessGate } from "@/components/auth/access-gate";
import { FeedbackButton } from "@/components/feedback/feedback-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge, LogoMark } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { useAuth } from "@/context/auth";
import { gateFor } from "@/lib/access";
import { daysLeft, ENDING_SOON_DAYS } from "@/lib/beta";
import { PLANS, scansLeft } from "@/lib/plans";
import type { Workspace } from "@/lib/types";

type NavItem = { to: string; label: string; icon: LucideIcon; mobile?: boolean };

/** Sidebar groups. `mobile` items form the phone bar, which never holds more than six. */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Care",
    items: [
      { to: "/app", label: "Home", icon: Home, mobile: true },
      { to: "/scan", label: "Scan", icon: ScanLine, mobile: true },
      { to: "/agent", label: "Agent", icon: MessagesSquare, mobile: true },
      { to: "/routine", label: "Routine", icon: Droplets, mobile: true },
      { to: "/progress", label: "Progress", icon: LineChart, mobile: true },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/programmes", label: "Programmes", icon: Target },
      { to: "/guides", label: "Guides", icon: BookOpen },
      { to: "/ingredients", label: "Ingredients", icon: FlaskConical },
      { to: "/refer", label: "Earn", icon: Gift },
    ],
  },
  {
    label: "Studio",
    items: [{ to: "/pro/clients", label: "Clients", icon: Users, mobile: true }],
  },
];

const COLLAPSE_KEY = "glowtrace.sidebar";

const WorkspaceSwitcher = () => {
  const { workspace, setWorkspace } = useAppState();
  const options: { id: Workspace; label: string }[] = [
    { id: "personal", label: "Personal" },
    { id: "pro", label: "MUA Pro" },
  ];
  return (
    <div
      className="grid grid-cols-2 rounded-lg border border-border bg-secondary p-1"
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
          className={`min-h-[44px] rounded-md px-3 text-sm font-semibold transition-colors ${
            workspace === option.id
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

const initialsOf = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const ProfileLink = ({ compact }: { compact: boolean }) => {
  const { profile } = useAppState();
  const plan = PLANS[profile.subscription_tier].name;
  return (
    <Link
      to="/pricing"
      aria-label={`${profile.display_name}, ${plan} plan. View plans`}
      title={compact ? `${profile.display_name} · ${plan}` : undefined}
      className={`flex min-h-[56px] items-center rounded-xl hover:bg-secondary ${
        compact ? "justify-center" : "gap-3 px-2"
      }`}
    >
      <span className="bg-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-primary-foreground">
        {initialsOf(profile.display_name)}
      </span>
      {!compact && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {profile.display_name}
          </span>
          <span className="block text-xs text-muted-foreground">{plan}</span>
        </span>
      )}
    </Link>
  );
};

/** Sign out, for signed-in members (desktop sidebar and mobile top bar). */
const SignOutButton = () => {
  const { access, signOut } = useAuth();
  const navigate = useNavigate();
  if (access.kind !== "member") return null;
  return (
    <button
      type="button"
      onClick={() => {
        void signOut().then(() => navigate({ to: "/" }));
      }}
      aria-label="Sign out"
      title="Sign out"
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
    >
      <LogOut className="h-5 w-5" aria-hidden="true" />
    </button>
  );
};

const Logo = ({ compact }: { compact: boolean }) => (
  <Link
    to="/app"
    aria-label="Glowtrace home"
    className={`flex min-h-[50px] items-center gap-2 ${compact ? "justify-center" : ""}`}
  >
    <LogoMark />
    {!compact && (
      <span className="font-display text-xl font-semibold text-foreground">Glowtrace</span>
    )}
  </Link>
);

const SideNav = ({ compact }: { compact: boolean }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isActive = (to: string) => pathname.startsWith(to);
  return (
    <nav aria-label="Primary" className="space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          {compact ? (
            <div className="mx-3 mb-2 border-t border-border first:hidden" aria-hidden="true" />
          ) : (
            <p className="label-tracking mb-1 px-3 text-[11px] font-bold text-muted-foreground uppercase">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    aria-label={compact ? item.label : undefined}
                    title={compact ? item.label : undefined}
                    className={`relative flex min-h-[50px] items-center rounded-lg text-[15px] font-semibold transition-colors ${
                      compact ? "justify-center" : "gap-3 px-3"
                    } ${
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {active && (
                      <span
                        className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-full bg-accent"
                        aria-hidden="true"
                      />
                    )}
                    <item.icon
                      className={`h-5 w-5 shrink-0 ${active ? "text-accent" : ""}`}
                      aria-hidden="true"
                    />
                    {!compact && item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
};

const BottomNav = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const items = NAV_GROUPS.flatMap((group) => group.items).filter((item) => item.mobile);
  return (
    <nav aria-label="Primary" className="grid grid-cols-6">
      {items.map((item) => {
        const active = pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
              active ? "text-accent" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-5 w-5" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};

/** Plan status and beta access in one calm block at the foot of the sidebar. */
const StatusBlock = () => {
  const { tier, usage, rewards } = useAppState();
  const { access, isAdmin } = useAuth();
  const left = scansLeft(tier, usage.scans, rewards.bonusScans);
  const member = access.kind === "member" || access.kind === "demo";
  const days = access.kind === "member" ? daysLeft(access.expiresAt, new Date()) : null;
  const ending = days !== null && days <= ENDING_SOON_DAYS;
  return (
    <div className="space-y-1">
      <div className="rounded-xl border border-border p-3 text-xs">
        {member && (
          <p className="mb-2 flex items-center gap-2">
            <Badge tone={ending ? "warning" : "accent"}>Beta</Badge>
            <span className={ending ? "font-semibold text-warning" : "text-muted-foreground"}>
              {days === null ? "Early access" : `${days} ${days === 1 ? "day" : "days"} left`}
            </span>
          </p>
        )}
        <p className="text-muted-foreground">
          {left === null ? "Unlimited check-ins" : `${left} free check-ins left this month`}
        </p>
        <Link to="/pricing" className="mt-1 inline-block font-semibold text-primary">
          Plans and pricing
        </Link>
      </div>
      {isAdmin && (
        <Link
          to="/admin"
          className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Beta dashboard
        </Link>
      )}
      <Link
        to="/privacy"
        className="flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Your data and privacy
      </Link>
    </div>
  );
};

/** Icon-only footer links for the collapsed sidebar. */
const CompactLinks = () => {
  const { isAdmin } = useAuth();
  const links: { to: string; label: string; icon: LucideIcon }[] = [
    { to: "/pricing", label: "Plans and pricing", icon: CreditCard },
    ...(isAdmin ? [{ to: "/admin", label: "Beta dashboard", icon: LayoutDashboard }] : []),
    { to: "/privacy", label: "Your data and privacy", icon: ShieldCheck },
  ];
  return (
    <ul className="space-y-0.5">
      {links.map((link) => (
        <li key={link.to}>
          <Link
            to={link.to}
            aria-label={link.label}
            title={link.label}
            className="flex min-h-[50px] items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <link.icon className="h-5 w-5" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
};

/** App shell: full-height sidebar on desktop, slim top bar and bottom nav on mobile. */
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
  // First-run onboarding gets the whole screen.
  if (pathname === "/welcome") return <div className="min-h-dvh">{children}</div>;
  return <AppShell>{children}</AppShell>;
};

const AppShell = ({ children }: { children: React.ReactNode }) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  // Read after mount so server and first client render match.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "collapsed");
    } catch {
      // Storage blocked: stay expanded.
    }
  }, []);
  const toggle = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "collapsed" : "expanded");
      } catch {
        // Not saved; still works for this visit.
      }
      return next;
    });
  };

  return (
    <div className="min-h-dvh lg:flex">
      {/* Mobile and tablet: slim top bar. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2 lg:hidden print:hidden">
        <Logo compact={false} />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <ProfileLink compact />
          <SignOutButton />
        </div>
      </header>

      {/* Desktop: full-height sidebar. */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card py-4 transition-[width] duration-200 lg:flex print:!hidden ${
          collapsed ? "w-[76px] px-2" : "w-64 px-3"
        }`}
      >
        <div
          className={`flex items-center ${collapsed ? "flex-col gap-2" : "justify-between px-1"}`}
        >
          <Logo compact={collapsed} />
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-4">
            <WorkspaceSwitcher />
          </div>
        )}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
          <SideNav compact={collapsed} />
        </div>

        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {collapsed ? <CompactLinks /> : <StatusBlock />}
          <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
            <div className="min-w-0 flex-1">
              <ProfileLink compact={collapsed} />
            </div>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </aside>

      <main
        key={pathname}
        className="page-enter mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-10"
      >
        {children}
      </main>

      {pathname !== "/admin" && (
        <div className="print:hidden">
          <FeedbackButton />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card lg:hidden print:hidden">
        <BottomNav />
      </div>
    </div>
  );
};
