import { Check } from "lucide-react";

import { cheerFor } from "@/lib/encouragement";
import type { ScanCategory, ScanRecord } from "@/lib/types";

/** What's going well in one area: shown only when there is something honest to celebrate. */
export const CheerCard = ({
  scans,
  area,
  className = "",
}: {
  scans: readonly ScanRecord[];
  area: ScanCategory;
  className?: string;
}) => {
  const cheer = cheerFor(scans, area);
  if (!cheer.headline) return null;
  return (
    <section aria-label="What's going well" className={`surface p-5 ${className}`}>
      <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
        What's going well
      </p>
      <p className="mt-2 font-display text-lg leading-snug font-semibold text-foreground">
        {cheer.headline}
      </p>
      {cheer.lines.length > 0 && (
        <ul className="mt-3 space-y-2">
          {cheer.lines.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
