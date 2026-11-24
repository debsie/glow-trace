import { Check } from "lucide-react";
import { useState } from "react";

import { useAppState } from "@/context/app-state";
import type { LengthBand } from "@/lib/hair-length";
import { ALL_BANDS, BAND_LABEL, growthPerMonth } from "@/lib/hair-length";
import { shortDate } from "@/lib/progress";
import type { ScanRecord } from "@/lib/types";

/**
 * Hair length on the result screen. Glowtrace's measurement is checked by the person: "Is this
 * where your hair ends?" Yes, or pick the right band. Only confirmed lengths count towards growth,
 * because on real photos the measurement is right about six times in ten.
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
  const { confirmHairLength } = useAppState();
  const [picking, setPicking] = useState(false);
  const reading = current.report?.hairLength;
  if (!reading) return null;
  const confirmed = reading.confirmed === true;

  const earlier = scans
    .filter(
      (scan) =>
        scan.id !== current.id &&
        scan.created_at < current.created_at &&
        scan.report?.hairLength?.confirmed === true &&
        scan.report.hairLength.state === reading.state,
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const first = earlier[0];
  const growth =
    confirmed && first?.report?.hairLength
      ? growthPerMonth(
          { at: first.created_at, reading: first.report.hairLength },
          { at: current.created_at, reading },
        )
      : null;

  const choose = (band: LengthBand) => {
    confirmHairLength(current.id, band);
    setPicking(false);
  };

  return (
    <section aria-label="Hair length" className={`surface p-5 ${className}`}>
      <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
        Length · {reading.state === "stretched" ? "stretched" : "natural"}
        {confirmed ? " · confirmed" : ""}
      </p>
      <p className="mt-2 font-display text-2xl font-semibold" aria-live="polite">
        {BAND_LABEL[reading.band]}
      </p>

      {!confirmed ? (
        <div className="mt-3">
          <p className="text-sm">Is this where your hair ends?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => choose(reading.band)}
              className="inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-foreground px-5 font-semibold hover:bg-foreground hover:text-background"
            >
              <Check className="h-4 w-4" aria-hidden="true" /> Yes, that's right
            </button>
            <button
              type="button"
              aria-expanded={picking}
              onClick={() => setPicking((open) => !open)}
              className="inline-flex min-h-[50px] items-center rounded-lg px-5 font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              No, it's different
            </button>
          </div>
          {picking && (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Where your hair ends"
            >
              {ALL_BANDS.map((band) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => choose(band)}
                  className={`min-h-[44px] rounded-full border px-4 text-sm ${band === reading.band ? "border-primary text-primary" : "border-border hover:bg-secondary"}`}
                >
                  {BAND_LABEL[band]}
                </button>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Confirmed lengths are the ones we use to track growth.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {growth === null || !first
            ? "Your first confirmed length in this state. Take one every month or so and we'll show your growth."
            : growth >= 0
              ? `About ${growth.toFixed(1)} cm a month since ${shortDate(first.created_at)}. Most hair grows 1 to 1.5 cm a month, so you're keeping what you grow when this matches.`
              : `Shorter than on ${shortDate(first.created_at)}. A trim does this. If you didn't trim, your ends may be breaking: the ends photo shows how they're doing.`}
        </p>
      )}
    </section>
  );
};
