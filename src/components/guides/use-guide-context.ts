import { useMemo } from "react";

import { useAppState } from "@/context/app-state";
import { briefing } from "@/lib/agent/agent";
import type { TopicContext } from "@/lib/agent/knowledge";
import { topicContext } from "@/lib/agent/retrieve";

/** The person's own results for guides' "Your reading" lines (on the device only). */
export const useGuideContext = (): TopicContext => {
  const { scans, catalog, inventory } = useAppState();
  return useMemo(() => {
    const brief = briefing(scans, catalog, inventory);
    const shelf = inventory
      .filter((item) => item.in_stock)
      .map((item) => catalog.find((product) => product.id === item.product_id)?.name ?? "")
      .filter(Boolean);
    return topicContext(scans, brief.findings, shelf);
  }, [scans, catalog, inventory]);
};
