import { createFileRoute, Outlet } from "@tanstack/react-router";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import { PageHeader } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { studioAccessGate } from "@/lib/plans";
import { pageHead } from "@/lib/seo";

/** Layout for the artist workspace; every client screen sits behind the MUA Studio plan. */
export const Route = createFileRoute("/pro/clients")({
  head: () =>
    pageHead({
      title: "Client Roster — Glowtrace MUA Studio",
      description:
        "Your makeup clients in one place: skin notes, prep, lookbooks and sign-off for weddings and events.",
      path: "/pro/clients",
      noindex: true,
    }),
  component: StudioLayout,
});

function StudioLayout() {
  const { tier } = useAppState();
  const gate = studioAccessGate(tier);
  if (gate.allowed) return <Outlet />;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="MUA Studio"
        subtitle="Skin notes, prep plans, lookbooks and client sign-off for bridal and event artists."
      />
      <UpgradeCard gate={gate} />
    </div>
  );
}
