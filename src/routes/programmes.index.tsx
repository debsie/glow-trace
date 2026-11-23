import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { LineArt } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import { useEnrolments } from "@/components/programmes/use-enrolments";
import { WeekRibbon } from "@/components/programmes/week-ribbon";
import { Badge } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { dayKey } from "@/lib/engagement";
import { currentWeek, PROGRAMMES, weeklyCheckIns } from "@/lib/programmes";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/programmes/")({
  head: () =>
    pageHead({
      title: "Programmes — Glowtrace",
      description: "Four-week plans for redness, dark marks, length, nails and hydration.",
      path: "/programmes",
      noindex: true,
    }),
  component: ProgrammesPage,
});

const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";
const AREA_WORD = { skin: "Skin", hair: "Hair", nails: "Nails" } as const;

function ProgrammesPage() {
  const { scans } = useAppState();
  const { enrolments } = useEnrolments();
  const today = dayKey(new Date());

  return (
    <div className="space-y-10">
      <header className="page-enter max-w-2xl">
        <p className={LABEL}>Programmes</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold sm:text-6xl">
          Four weeks. <span className="text-primary">One goal.</span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          Three small steps a week and one check-in scan. At the end, your own before and after,
          read the same way every time.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {PROGRAMMES.map((programme, index) => {
          const enrolment = enrolments.find((e) => e.id === programme.id);
          const week = enrolment ? currentWeek(enrolment, today) : -1;
          return (
            <Reveal key={programme.id} delay={index * 80}>
              <Link
                to="/programmes/$id"
                params={{ id: programme.id }}
                className={`lift flex h-full flex-col gap-6 p-6 ${enrolment ? "surface-strong" : "surface"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone="accent">{AREA_WORD[programme.area]}</Badge>
                      {enrolment && (
                        <Badge tone="success">
                          {week >= 4 ? "Finished" : `Week ${week + 1} of 4`}
                        </Badge>
                      )}
                    </div>
                    <h2 className="mt-4 font-display text-3xl font-semibold">{programme.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{programme.promise}</p>
                  </div>
                  <LineArt motif={programme.motif} className="h-20 w-20 shrink-0" />
                </div>
                <WeekRibbon
                  current={week}
                  checkIns={enrolment ? weeklyCheckIns(programme, enrolment, scans) : []}
                />
                <span className="flex items-center gap-1 text-sm font-semibold text-primary">
                  {enrolment ? "Continue" : "See the plan"}{" "}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </div>
  );
}
