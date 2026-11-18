import { SectionCard } from "@/components/ui/bits";
import {
  agreementByMetric,
  coverage,
  FITZPATRICK,
  MIN_SAMPLES,
  repeatability,
} from "@/lib/calibration";
import type { CalibrationRow } from "@/lib/calibration";

const AREAS = ["skin", "hair", "nails"] as const;

const Counts = ({ title, counts }: { title: string; counts: Record<string, number> }) => (
  <div>
    <h3 className="label-tracking text-xs font-bold text-muted-foreground uppercase">{title}</h3>
    <ul className="mt-2 space-y-1 text-sm">
      {Object.entries(counts).map(([name, value]) => (
        <li key={name} className="flex justify-between gap-3">
          <span>{name.replace(/_/g, " ")}</span>
          <span className="readout">{value}</span>
        </li>
      ))}
    </ul>
  </div>
);

/** What the shared numbers say so far: coverage, agreement with people's ratings, repeatability. */
export const CalibrationPanel = ({ rows }: { rows: readonly CalibrationRow[] }) => {
  if (rows.length === 0) {
    return (
      <SectionCard title="Calibration">
        <p className="text-sm text-muted-foreground">
          Nothing shared yet. Testers see a "Help check the analysis" card after each scored scan.
          Only scores and ratings arrive here, never photos.
        </p>
      </SectionCard>
    );
  }
  const spread = coverage(rows);
  const repeats = repeatability(rows);
  const missingTypes = FITZPATRICK.filter((type) => !spread.byFitzpatrick[`Type ${type.id}`]);
  return (
    <div className="space-y-3">
      <SectionCard title="Coverage">
        <p className="text-sm text-muted-foreground">
          {spread.total} shared scans, {spread.pairs} repeat photos. Aim for {MIN_SAMPLES}+ per
          indicator before reading a number, and some from every skin type.
        </p>
        <div className="mt-4 grid gap-6 sm:grid-cols-3">
          <Counts title="Area" counts={spread.byCategory} />
          <Counts title="Light" counts={spread.byLighting} />
          <Counts title="Skin type" counts={spread.byFitzpatrick} />
        </div>
        {missingTypes.length > 0 && (
          <p className="mt-4 text-sm text-warning">
            No contributions yet from skin type {missingTypes.map((type) => type.id).join(", ")}.
            Recruit there next.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Agreement with people's ratings">
        <p className="text-sm text-muted-foreground">
          Rank correlation between the app's score and what people said they see. 1 means they move
          together, 0 means unrelated, below 0 means the app disagrees. Ratings are rough, so this
          is a sanity check, not accuracy.
        </p>
        {AREAS.map((area) => {
          const agreement = agreementByMetric(rows, area);
          if (agreement.length === 0) return null;
          return (
            <div key={area} className="mt-4">
              <h3 className="font-display font-semibold capitalize">{area}</h3>
              <ul className="mt-1 divide-y divide-border">
                {agreement.map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-sm">{item.key}</span>
                    <span className="text-sm text-muted-foreground">
                      <span className="readout">{item.rho ?? "n/a"}</span> from {item.n}
                      {item.enough ? "" : ` (need ${MIN_SAMPLES})`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </SectionCard>

      <SectionCard title="Repeatability">
        {repeats.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No repeat photos yet. Ask testers to retake a photo in different light and tick "repeat
            of the photo I shared last time".
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              How far an indicator moves between a photo and its repeat, in score points. 9 in 10
              repeats moved less than the second number. A change smaller than that between two
              scans is noise, not progress.
            </p>
            <ul className="mt-2 divide-y divide-border">
              {repeats.map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-sm">{item.key}</span>
                  <span className="text-sm text-muted-foreground">
                    avg <span className="readout">{item.meanDifference}</span> · 90% under{" "}
                    <span className="readout">{item.p90}</span> · {item.pairs} pairs
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SectionCard>
    </div>
  );
};
