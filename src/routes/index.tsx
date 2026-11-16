import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ScanLine, Sparkles, Users } from "lucide-react";

import { Badge, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { wellnessScore } from "@/lib/beauty";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glowtrace AI — Beauty Dashboard" },
      {
        name: "description",
        content:
          "Your AI beauty command center: recent diagnostic scans, daily routines and client work.",
      },
      { property: "og:title", content: "Glowtrace AI — Beauty Dashboard" },
      {
        property: "og:description",
        content:
          "Your AI beauty command center: recent diagnostic scans, daily routines and client work.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const CATEGORY_LABEL: Record<string, string> = { skin: "Skin", hair: "Hair", nails: "Nails" };

function Dashboard() {
  const { profile, scans, clients, looks } = useAppState();
  const recent = [...scans].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const pendingSignoff = looks.filter((look) => look.status === "sent").length;

  const actions = [
    { to: "/scan", label: "New Scan", description: "Analyze skin, hair or nails", icon: ScanLine },
    {
      to: "/routine",
      label: "Daily Routine",
      description: "Match products on your shelf",
      icon: Sparkles,
    },
    {
      to: "/pro/clients",
      label: "MUA Portal",
      description: `${clients.length} clients in your roster`,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${profile.display_name.split(" ")[0]}`}
        subtitle="Your AI beauty command center — one place for diagnostics, routines and client work."
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
          Run a new analysis <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </SectionCard>

      <div className="grid gap-3 sm:grid-cols-3">
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{scans.length}</p>
          <p className="text-sm text-muted-foreground">Total AI scans</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{clients.length}</p>
          <p className="text-sm text-muted-foreground">MUA clients</p>
        </SectionCard>
        <SectionCard>
          <p className="font-display text-3xl font-bold text-foreground">{pendingSignoff}</p>
          <p className="text-sm text-muted-foreground">Looks awaiting sign-off</p>
        </SectionCard>
      </div>
    </div>
  );
}
