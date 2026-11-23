import { Check } from "lucide-react";

/** Four weeks as connected nodes; the line fills to the current week (quiet, CSS only). */
export const WeekRibbon = ({
  current,
  checkIns,
}: {
  /** 0-3 running, 4 finished, -1 not started. */
  current: number;
  checkIns: readonly boolean[];
}) => {
  const filled = Math.max(0, Math.min(3, current)) / 3;
  return (
    <div
      className="relative px-5"
      aria-label={current < 0 ? "Not started" : `Week ${Math.min(current + 1, 4)} of 4`}
    >
      <div className="absolute top-1/2 right-5 left-5 h-px -translate-y-1/2 bg-border" />
      <div
        className="absolute top-1/2 left-5 h-0.5 -translate-y-1/2 bg-primary transition-[width] duration-1000 ease-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 2.5rem) * ${current < 0 ? 0 : current >= 4 ? 1 : filled})` }}
      />
      <ol className="relative flex justify-between">
        {[0, 1, 2, 3].map((week) => {
          const done = checkIns[week] ?? false;
          const now = week === current;
          return (
            <li
              key={week}
              className={`readout flex h-10 w-10 items-center justify-center rounded-full border text-xs ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : now
                    ? "border-primary bg-background text-primary"
                    : "border-border bg-background text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" aria-hidden="true" /> : `W${week + 1}`}
              <span className="sr-only">
                {done ? `Week ${week + 1} checked in` : `Week ${week + 1}`}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
