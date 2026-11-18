import { makeupPrep } from "@/lib/makeup";
import type { ScanReport } from "@/lib/types";

/** Base match and prep from a skin scan's readings. Used on the scan page and in client briefs. */
export const MakeupPrepPanel = ({ report }: { report: ScanReport | undefined }) => {
  const plan = report ? makeupPrep(report) : null;
  if (!plan) {
    return (
      <p className="text-sm text-muted-foreground">
        Makeup matching needs a scored skin scan with enough visible skin. Try a closer photo in
        daylight.
      </p>
    );
  }
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">Shade depth</dt>
        <dd className="font-semibold text-foreground">{plan.depth}</dd>
        <dt className="text-muted-foreground">Undertone</dt>
        <dd className="font-semibold text-foreground">
          {plan.undertone}
          {!plan.undertoneSure && (
            <span className="ml-2 font-normal text-muted-foreground">
              unsure: the light was coloured, check in daylight
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">Finish</dt>
        <dd className="text-foreground">{plan.finish}</dd>
        <dt className="text-muted-foreground">Primer</dt>
        <dd className="text-foreground">{plan.primer}</dd>
      </dl>
      {plan.correctors.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Colour correcting</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {plan.correctors.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="font-semibold text-foreground">Prep</p>
        <ul className="mt-1 list-inside list-disc text-muted-foreground">
          {plan.prep.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Read from this photo. Swatch two shades along the jaw in daylight to confirm.
      </p>
    </div>
  );
};
