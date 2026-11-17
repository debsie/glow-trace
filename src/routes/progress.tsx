import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo, useState } from "react";

import { ScoreChart } from "@/components/progress/score-chart";
import { Badge, BUTTON_PRIMARY, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import type { Verdict } from "@/lib/progress";
import { compareScans, longDate, scoreChange, seriesFor } from "@/lib/progress";
import { pageHead } from "@/lib/seo";
import type { ScanCategory } from "@/lib/types";

export const Route = createFileRoute("/progress")({
  head: () =>
    pageHead({
      title: "Your Progress — Glowtrace",
      description: "How your skin, hair and nail scores have changed, scan by scan.",
      path: "/progress",
      noindex: true,
    }),
  component: ProgressPage,
});

const AREAS: { id: ScanCategory; label: string }[] = [
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "nails", label: "Nails" },
];

const VERDICT: Record<
  Verdict,
  { label: string; tone: "success" | "warning" | "outline"; icon: typeof Minus }
> = {
  better: { label: "Better", tone: "success", icon: ArrowUpRight },
  worse: { label: "Worse", tone: "warning", icon: ArrowDownRight },
  same: { label: "No change", tone: "outline", icon: Minus },
};

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

function ProgressPage() {
  const { scans } = useAppState();
  const [area, setArea] = useState<ScanCategory>("skin");
  const [showTable, setShowTable] = useState(false);
  const series = useMemo(() => seriesFor(scans, area), [scans, area]);
  const change = scoreChange(series);
  const label = AREAS.find((item) => item.id === area)?.label ?? "Skin";

  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const byId = new Map(scans.map((scan) => [scan.id, scan]));
  const before = byId.get(beforeId ?? "") ?? byId.get(series[0]?.id ?? "");
  const after = byId.get(afterId ?? "") ?? byId.get(series[series.length - 1]?.id ?? "");
  const changes = before && after && before.id !== after.id ? compareScans(before, after) : [];

  const selectClass =
    "min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground";

  return (
    <div className="space-y-6">
      <PageHeader title="Your Progress" subtitle="How your scores have moved, scan by scan." />

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Area">
        {AREAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={area === item.id}
            onClick={() => {
              setArea(item.id);
              setBeforeId(null);
              setAfterId(null);
            }}
            className={`min-h-[50px] rounded-2xl border text-base font-semibold transition-colors ${
              area === item.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground">
            No scored {label.toLowerCase()} scans yet. Your progress chart starts with your first
            one.
          </p>
          <Link to="/scan" className={`${BUTTON_PRIMARY} mt-4`}>
            Run a {label.toLowerCase()} scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title={`${label} score over time`}
            action={
              <button
                type="button"
                aria-pressed={showTable}
                onClick={() => setShowTable((value) => !value)}
                className="inline-flex min-h-[50px] items-center px-3 text-sm font-semibold text-primary hover:underline"
              >
                {showTable ? "Show chart" : "Show as table"}
              </button>
            }
          >
            <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1" aria-live="polite">
              <p>
                <span className="font-display text-3xl font-semibold">
                  {series[series.length - 1]?.score}
                </span>
                <span className="text-sm text-muted-foreground"> latest</span>
              </p>
              {change !== null && (
                <p className="text-sm text-muted-foreground">
                  <span className="readout text-foreground">
                    {change > 0 ? "+" : ""}
                    {change}
                  </span>{" "}
                  since {longDate(series[0]?.date ?? "")} · {series.length} scans
                </p>
              )}
            </div>
            {showTable ? (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th scope="col" className="py-2 font-semibold">
                      Date
                    </th>
                    <th scope="col" className="py-2 text-right font-semibold">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...series].reverse().map((point) => (
                    <tr key={point.id} className="border-b border-border">
                      <td className="py-2">{longDate(point.date)}</td>
                      <td className="readout py-2 text-right">{point.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <ScoreChart points={series} label={label} />
            )}
          </SectionCard>

          <SectionCard title="Compare two scans">
            {series.length < 2 ? (
              <p className="text-sm text-muted-foreground">
                Run another {label.toLowerCase()} scan to compare. Two weeks into a routine is a
                good time.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["Before", before, setBeforeId],
                      ["After", after, setAfterId],
                    ] as const
                  ).map(([name, scan, set]) => (
                    <div key={name}>
                      <label className="mb-1 block text-sm font-semibold text-muted-foreground">
                        {name}
                        <select
                          className={`${selectClass} mt-1`}
                          value={scan?.id ?? ""}
                          onChange={(event) => set(event.target.value)}
                        >
                          {[...series].reverse().map((point) => (
                            <option key={point.id} value={point.id}>
                              {longDate(point.date)} · {point.score}
                            </option>
                          ))}
                        </select>
                      </label>
                      {scan && (
                        <img
                          src={scan.image_url}
                          alt={`${label} photo, ${name.toLowerCase()}`}
                          className="mt-3 aspect-[4/3] w-full rounded-2xl object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
                {changes.length > 0 ? (
                  <ul className="mt-5 divide-y divide-border border-t border-border">
                    {changes.map((item) => {
                      const meta = VERDICT[item.verdict];
                      return (
                        <li
                          key={item.key}
                          className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 py-2"
                        >
                          <span className="text-sm text-foreground">{item.label}</span>
                          <span className="flex items-center gap-3">
                            <span className="readout text-sm text-muted-foreground">
                              {item.before.toFixed(1)} → {item.after.toFixed(1)} (
                              {signed(item.delta)})
                            </span>
                            <Badge tone={meta.tone}>
                              <meta.icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {meta.label}
                            </Badge>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">Pick two different scans.</p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Changes under 2 points count as no change: lighting and angle move readings that
                  much on their own. For a fair comparison, use the same spot, light and distance.
                </p>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
