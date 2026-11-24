import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import type { IndicatorSeries } from "@/lib/progress";
import { shortDate } from "@/lib/progress";

const W = 160;
const H = 44;

const Spark = ({ series }: { series: IndicatorSeries }) => {
  const values = series.points.map((p) => p.value);
  const lo = Math.min(...values, 100);
  const hi = Math.max(...values, 0);
  const span = Math.max(10, hi - lo);
  const x = (i: number) => (values.length === 1 ? W / 2 : 4 + (i / (values.length - 1)) * (W - 8));
  const y = (v: number) => 4 + (1 - (v - lo) / span) * (H - 8);
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="art-draw h-11 w-full" aria-hidden="true">
      <path
        d={path}
        pathLength={1}
        data-draw=""
        fill="none"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r="3.5" className="fill-primary" />
    </svg>
  );
};

const WORDS = { better: "Better", worse: "Worse", same: "Steady" } as const;
const ICONS = { better: ArrowUpRight, worse: ArrowDownRight, same: Minus } as const;

/** Small multiples: one quiet sparkline per indicator, latest value and change in words. */
export const IndicatorTrends = ({ series }: { series: IndicatorSeries[] }) => (
  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {series.map((item, index) => {
      const latest = item.points[item.points.length - 1];
      const Icon = item.verdict ? ICONS[item.verdict] : null;
      return (
        <Reveal as="li" key={item.key} delay={index * 60} className="surface lift min-w-0 p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-semibold">{item.label}</p>
            <p className="readout text-lg text-foreground">{latest?.value.toFixed(1)}</p>
          </div>
          <Spark series={item} />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {Icon && item.verdict && item.change !== null ? (
              <>
                <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                {WORDS[item.verdict]}{" "}
                <span className="readout">
                  ({item.change > 0 ? "+" : ""}
                  {item.change.toFixed(1)})
                </span>{" "}
                since {shortDate(item.points[0]?.date ?? "")}
              </>
            ) : (
              "One reading so far"
            )}
            <span className="sr-only">
              {item.higherIsBetter ? "Higher is better." : "Lower is better."}
            </span>
          </p>
        </Reveal>
      );
    })}
  </ul>
);
