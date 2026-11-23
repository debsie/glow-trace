import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { LineArt } from "@/components/art/line-art";
import { Reveal } from "@/components/motion/reveal";
import { useEnrolments } from "@/components/programmes/use-enrolments";
import { WeekRibbon } from "@/components/programmes/week-ribbon";
import { GhostButton, PrimaryButton } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { dayKey } from "@/lib/engagement";
import { guideById } from "@/lib/guides";
import {
  beforeAfter,
  currentWeek,
  programmeById,
  toggleProgrammeTick,
  weeklyCheckIns,
} from "@/lib/programmes";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/programmes/$id")({
  loader: ({ params }) => {
    if (!programmeById(params.id)) throw notFound();
    return { id: params.id };
  },
  head: ({ params }) =>
    pageHead({
      title: `${programmeById(params.id)?.title ?? "Programme"} — Glowtrace`,
      description: programmeById(params.id)?.promise ?? "A four-week Glowtrace programme.",
      path: `/programmes/${params.id}`,
      noindex: true,
    }),
  component: ProgrammePage,
});

const LABEL = "label-tracking text-xs font-bold text-muted-foreground uppercase";

function ProgrammePage() {
  const { id } = Route.useLoaderData();
  const programme = programmeById(id);
  const { scans } = useAppState();
  const { enrolments, start, update, stop } = useEnrolments();
  if (!programme) return null;
  const today = dayKey(new Date());
  const enrolment = enrolments.find((e) => e.id === programme.id) ?? null;
  const week = enrolment ? currentWeek(enrolment, today) : -1;
  const checkIns = enrolment ? weeklyCheckIns(programme, enrolment, scans) : [];
  const result = enrolment ? beforeAfter(programme, enrolment, scans) : null;

  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <Link
        to="/programmes"
        className="inline-flex min-h-[50px] items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All programmes
      </Link>

      <header className="page-enter grid items-center gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className={LABEL}>Four-week programme</p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] font-semibold sm:text-5xl">
            {programme.title}
          </h1>
          <p className="mt-3 text-muted-foreground">{programme.promise}</p>
        </div>
        <LineArt motif={programme.motif} className="h-32 w-32 sm:h-40 sm:w-40" />
      </header>

      <Reveal className="surface space-y-5 p-6">
        <WeekRibbon current={week} checkIns={checkIns} />
        {enrolment ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {week >= 4
              ? "You've finished. Here's what changed, read the same way as day one."
              : `Week ${week + 1} of 4. ${checkIns[week] ? "This week's check-in is done." : "Your check-in scan for this week is still to do."}`}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={() => start(programme.id, today)}>
              Start today <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </PrimaryButton>
            <p className="text-sm text-muted-foreground">
              Take a {programme.area} scan on day one so we have your starting point.
            </p>
          </div>
        )}
      </Reveal>

      {result && (
        <Reveal className="grid grid-cols-2 gap-3 rounded-xl border border-primary bg-card p-6">
          <div>
            <p className={LABEL}>Start</p>
            <p className="readout mt-2 text-4xl">{result.before.toFixed(1)}</p>
          </div>
          <div>
            <p className={LABEL}>Now</p>
            <p className="readout mt-2 text-4xl text-primary">{result.after.toFixed(1)}</p>
          </div>
          <p className="col-span-2 text-sm">
            {programme.metricLabel}{" "}
            {Math.abs(result.after - result.before) < 2
              ? "is holding steady. Consistency is still worth it: keep going."
              : result.better
                ? "has moved the right way. That's your routine working."
                : "has moved the wrong way. Check your light matches day one, and see the guides below."}
          </p>
        </Reveal>
      )}

      <ol className="space-y-4">
        {programme.weeks.map((plan, index) => {
          const isNow = index === week;
          return (
            <Reveal
              as="li"
              key={plan.title}
              delay={index * 80}
              className={`rounded-xl border p-5 ${isNow ? "border-primary bg-card" : "border-border"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold">
                  <span className="readout mr-3 text-sm text-primary">W{index + 1}</span>
                  {plan.title}
                </h2>
                {enrolment && !checkIns[index] && index <= week && (
                  <Link
                    to="/scan"
                    search={{ area: programme.area }}
                    className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary"
                  >
                    Check-in scan <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
              <ul className="mt-4 space-y-2">
                {plan.steps.map((step, stepIndex) => {
                  const ticked = enrolment?.ticks.includes(`${index}-${stepIndex}`) ?? false;
                  return (
                    <li key={step}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={ticked}
                        disabled={!enrolment}
                        onClick={() =>
                          enrolment && update(toggleProgrammeTick(enrolment, index, stepIndex))
                        }
                        className={`flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-4 text-left text-sm transition-colors disabled:cursor-default ${
                          ticked
                            ? "border-primary bg-secondary"
                            : "border-border hover:bg-secondary"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                            ticked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                          aria-hidden="true"
                        >
                          {ticked && <Check className="h-4 w-4" />}
                        </span>
                        <span className={ticked ? "text-muted-foreground" : ""}>{step}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Reveal>
          );
        })}
      </ol>

      <section aria-labelledby="read" className="space-y-3">
        <h2 id="read" className={LABEL}>
          Read along
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {programme.guides.map((guideId) => {
            const guide = guideById(guideId);
            return guide ? (
              <Link
                key={guide.id}
                to="/guides/$id"
                params={{ id: guide.id }}
                className="surface lift flex min-h-[100px] flex-col justify-between gap-3 p-4"
              >
                <LineArt motif={guide.motif} className="h-9 w-9" />
                <span className="font-semibold">{guide.title}</span>
              </Link>
            ) : null;
          })}
        </div>
      </section>

      {enrolment && (
        <GhostButton onClick={() => stop(programme.id)}>Leave this programme</GhostButton>
      )}
    </article>
  );
}
