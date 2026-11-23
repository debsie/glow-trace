import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import type { Motif } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import { BUTTON_GHOST, BUTTON_PRIMARY } from "@/components/ui/bits";
import { ScoreRing } from "@/components/ui/score-ring";
import { useAppState } from "@/context/app-state";
import { longDate } from "@/lib/progress";
import type { AreaReport, MonthKey, MonthReport } from "@/lib/report-card";
import { monthReport, monthStart, reportMonths } from "@/lib/report-card";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/report")({
  head: () =>
    pageHead({
      title: "Monthly report card — Glowtrace",
      description: "Your month in skin, hair and nails: what moved, what held and what to watch.",
      path: "/report",
      noindex: true,
    }),
  component: ReportPage,
});

const AREA_LABEL = { skin: "Skin", hair: "Hair", nails: "Nails" } as const;
const AREA_MOTIF: Record<AreaReport["area"], Motif> = {
  skin: "face",
  hair: "strands",
  nails: "nail",
};

const GRADE: Record<MonthReport["grade"], { word: string; line: string }> = {
  rising: {
    word: "Rising",
    line: "More of your indicators moved the right way than the wrong way.",
  },
  holding: {
    word: "Holding",
    line: "Steady overall. Holding ground is a result too, especially with a routine you keep.",
  },
  dipping: {
    word: "Dipping",
    line: "A softer month. One change at a time is the quickest way back, so start with the one to watch.",
  },
  "getting started": {
    word: "Getting started",
    line: "One more scan of the same area and this card starts showing real change.",
  },
};

/** "November 2026" from a month key, via longDate so server and browser agree. */
const monthName = (month: MonthKey) => longDate(monthStart(month)).split(" ").slice(1).join(" ");

const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;

const ChangeLine = ({ change }: { change: number | null }) => {
  if (change === null) return <p className="text-sm text-muted-foreground">First reading</p>;
  const Icon = change >= 2 ? ArrowUpRight : change <= -2 ? ArrowDownRight : Minus;
  const word = change >= 2 ? "up" : change <= -2 ? "down" : "steady";
  return (
    <p className="flex items-center gap-1.5 text-sm">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="readout">{signed(change)}</span>
      <span className="text-muted-foreground">{word} this month</span>
    </p>
  );
};

function ReportPage() {
  const { scans } = useAppState();
  const months = useMemo(() => reportMonths(scans), [scans]);
  const [picked, setPicked] = useState<MonthKey | null>(null);
  const month = picked ?? months[0] ?? null;
  const report = useMemo(() => (month ? monthReport(scans, month) : null), [scans, month]);

  if (!month || !report) {
    return (
      <section className="surface-strong relative overflow-hidden p-8 sm:p-12">
        <LineArt motif="chart" className="art-draw mb-6 h-20 w-20" />
        <h1 className="font-display text-4xl font-semibold">
          Your first report card is a scan away
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Each month Glowtrace gathers your scans into one card: what moved, what held and the one
          thing to watch next. It all stays on this device.
        </p>
        <Link to="/scan" className={`${BUTTON_PRIMARY} mt-8`}>
          Take a scan
        </Link>
      </section>
    );
  }

  const grade = GRADE[report.grade];

  return (
    <div className="space-y-8">
      <section className="surface-strong page-enter relative overflow-hidden p-6 sm:p-10">
        <LineArt
          motif="chart"
          className="art-draw art-breathe pointer-events-none absolute top-6 right-6 hidden h-28 w-28 opacity-80 sm:block"
        />
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Report card · {monthName(month)}
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold sm:text-6xl">{grade.word}</h1>
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{grade.line}</p>
        <dl className="mt-8 grid max-w-md grid-cols-3 gap-6">
          {[
            ["Scans", report.totalScans],
            ["Active days", report.activeDays],
            ["Areas", report.areas.length],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="readout mt-1 text-3xl text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {months.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Month">
          {months.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === month}
              onClick={() => setPicked(key)}
              className={`min-h-[50px] shrink-0 rounded-2xl border px-5 text-sm font-semibold transition-colors ${
                key === month
                  ? "border-foreground bg-card text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {monthName(key)}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {report.areas.map((area, index) => (
          <Reveal key={`${month}-${area.area}`} delay={index * 90}>
            <article className="surface lift flex h-full flex-col p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {AREA_LABEL[area.area]}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="readout">{area.scans}</span>{" "}
                    {area.scans === 1 ? "scan" : "scans"}
                  </p>
                </div>
                <LineArt motif={AREA_MOTIF[area.area]} className="art-draw h-12 w-12" />
              </div>
              <ScoreRing value={area.end} label="Score" className="mx-auto my-5 h-32 w-32" />
              <ChangeLine change={area.change} />
              <dl className="mt-4 space-y-3 border-t border-border pt-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Biggest win</dt>
                  <dd className="mt-0.5 font-semibold">
                    {area.best ? (
                      <>
                        {area.best.label}{" "}
                        <span className="readout font-normal">{signed(area.best.delta)}</span>
                      </>
                    ) : (
                      "Nothing past the noise yet"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">To watch</dt>
                  <dd className="mt-0.5 font-semibold">
                    {area.watch ? (
                      <>
                        {area.watch.label}{" "}
                        <span className="readout font-normal">{signed(area.watch.delta)}</span>
                      </>
                    ) : (
                      "Nothing slipping"
                    )}
                  </dd>
                </div>
              </dl>
            </article>
          </Reveal>
        ))}
      </div>

      <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-semibold">Make next month count</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A four-week programme turns the thing to watch into three small steps a week.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/programmes" className={BUTTON_PRIMARY}>
            Choose a programme
          </Link>
          <Link to="/progress" className={BUTTON_GHOST}>
            See every scan
          </Link>
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Wellness indicators, not a diagnosis. Changes under 2 points are treated as measurement
        noise. Built on this device from your own scans.
      </p>
    </div>
  );
}
