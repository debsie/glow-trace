import type { ReactNode } from "react";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import { PageHeader } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { studioAccessGate } from "@/lib/plans";

/** MUA Studio pages sit behind the Studio plan, like the client roster. */
export const StudioGate = ({ title, children }: { title: string; children: ReactNode }) => {
  const { tier } = useAppState();
  const gate = studioAccessGate(tier);
  if (gate.allowed) return <>{children}</>;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={title} subtitle="Part of MUA Studio for bridal and event artists." />
      <UpgradeCard gate={gate} />
    </div>
  );
};
