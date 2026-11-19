import { BAND_LABEL, growthPerMonth } from "@/lib/hair-length";
import { shortDate } from "@/lib/progress";
import type { ScanRecord } from "@/lib/types";

/**
 * Hair length on the result screen: the band, and growth since the first length photo in the same
 * state (stretched against stretched, natural against natural).
 */
export const HairLengthCard = ({
  scans,
  current,
  className = "",
}: {
  scans: readonly ScanRecord[];
  current: ScanRecord;
  className?: string;
}) => {
  const reading = current.report?.hairLength;
  if (!reading) return null;
  const earlier = scans
    .filter(
      (scan) =>
        scan.id !== current.id &&
        scan.created_at < current.created_at &&
        scan.report?.hairLength?.state === reading.state,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = earlier[0];
  const growth = first?.report?.hairLength
    ? growthPerMonth(
        { at: first.created_at, reading: first.report.hairLength },
        { at: current.created_at, reading },
      )
    : null;
  return (
    <section aria-label="Hair length" className={`surface p-5 ${className}`}>
      <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
        Length · {reading.state === "stretched" ? "stretched" : "natural"} · preview
      </p>
      <p className="mt-2 font-display text-2xl font-semibold">{BAND_LABEL[reading.band]}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {growth === null || !first
          ? "Your first length photo in this state. Take one every month or so and we'll show your growth."
          : growth >= 0
            ? `About ${growth.toFixed(1)} cm a month since ${shortDate(first.created_at)}. Most hair grows 1 to 1.5 cm a month, so you're keeping what you grow when this matches.`
            : `Shorter than on ${shortDate(first.created_at)}. A trim does this. If you didn't trim, your ends may be breaking: the ends photo shows how they're doing.`}
      </p>
    </section>
  );
};
