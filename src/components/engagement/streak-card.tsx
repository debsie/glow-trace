import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarPlus, Check, X } from "lucide-react";
import { useState } from "react";

import { Badge, PrimaryButton } from "@/components/ui/bits";
import {
  addDays,
  dayKey,
  dueToday,
  EVENT_KINDS,
  milestones,
  pairFor,
  weekOf,
  weeklyStreak,
} from "@/lib/engagement";
import type { EventKind } from "@/lib/engagement";
import { longDate } from "@/lib/progress";
import { compareScans } from "@/lib/progress";
import { STREAK_PROGRAM } from "@/lib/referrals";
import type { ScanRecord } from "@/lib/types";

import { useCheckinEvents } from "./use-checkin-events";

const WEEKS_SHOWN = 8;

/**
 * Home: this week's streak, check-ins due today, a planner for before-and-after check-ins, the
 * latest before-and-after result and milestones. Quiet, specific, never nagging.
 */
export const StreakCard = ({ scans }: { scans: readonly ScanRecord[] }) => {
  const now = new Date();
  const today = dayKey(now);
  const { events, add, remove } = useCheckinEvents();
  const [planning, setPlanning] = useState(false);
  const [kind, setKind] = useState<EventKind>("makeup");
  const [day, setDay] = useState(addDays(today, 1));

  const streak = weeklyStreak(scans, now);
  const weeksWithScan = new Set(
    scans.filter((scan) => !scan.demo).map((scan) => weekOf(new Date(scan.created_at))),
  );
  const thisWeek = weekOf(now);
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, i) =>
    addDays(thisWeek, -7 * (WEEKS_SHOWN - 1 - i)),
  );
  const due = dueToday(events, scans, today);
  const finished = events
    .map((event) => ({ event, pair: pairFor(event, scans) }))
    .filter((item) => item.pair)
    .sort((a, b) => b.event.day.localeCompare(a.event.day))[0];
  const reached = milestones(scans, events, now);
  const toReward = STREAK_PROGRAM.rewardAtWeeks - streak;

  return (
    <section aria-label="Your streak and check-ins" className="surface space-y-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
            Weekly streak
          </p>
          <p className="mt-1 font-display text-4xl leading-none font-semibold">
            {streak}
            <span className="ml-2 text-base font-semibold text-muted-foreground">
              {streak === 1 ? "week" : "weeks"}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {streak === 0
              ? "One scan a week starts a streak. Weekly is plenty: skin changes slowly."
              : toReward > 0
                ? `${toReward} more ${toReward === 1 ? "week" : "weeks"} for ${STREAK_PROGRAM.bonusScans} bonus check-ins.`
                : `You've earned ${STREAK_PROGRAM.bonusScans} bonus check-ins this month. Keep it going.`}
          </p>
        </div>
        <ol className="flex gap-1.5" aria-label={`Last ${WEEKS_SHOWN} weeks`}>
          {weeks.map((week) => {
            const done = weeksWithScan.has(week);
            const current = week === thisWeek;
            return (
              <li
                key={week}
                aria-label={`Week of ${week}${done ? ": scanned" : ""}`}
                className={`flex h-9 w-7 items-center justify-center rounded-lg border ${
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : current
                      ? "border-primary"
                      : "border-border"
                }`}
              >
                {done && <Check className="h-4 w-4" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </div>

      {due.length > 0 && (
        <ul className="space-y-2" aria-label="Check-ins due today">
          {due.map((step) => (
            <li
              key={`${step.event.id}-${step.moment}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary px-4 py-3"
            >
              <span className="text-sm">
                <span className="font-semibold">
                  {step.moment === "before" ? "Day before" : "Day after"}:{" "}
                  {EVENT_KINDS[step.event.kind].label.toLowerCase()}
                </span>
                <span className="block text-muted-foreground">
                  {step.moment === "before"
                    ? "A scan today gives you the honest starting point."
                    : "Scan today to see what it did."}
                </span>
              </span>
              <Link
                to="/scan"
                search={{ area: step.area }}
                className="inline-flex min-h-[50px] items-center gap-1 text-sm font-semibold text-primary"
              >
                Scan now <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {finished?.pair && (
        <BeforeAfter
          label={EVENT_KINDS[finished.event.kind].label}
          day={finished.event.day}
          changes={compareScans(finished.pair.before, finished.pair.after)}
        />
      )}

      {planning ? (
        <form
          className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-[1fr_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            add({ id: `${Date.now()}`, kind, day, note: "" });
            setPlanning(false);
          }}
        >
          <label className="text-sm font-semibold">
            What's happening
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as EventKind)}
              className="mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base"
            >
              {(Object.keys(EVENT_KINDS) as EventKind[]).map((id) => (
                <option key={id} value={id}>
                  {EVENT_KINDS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            On
            <input
              type="date"
              value={day}
              min={today}
              onChange={(event) => setDay(event.target.value)}
              className="mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base"
            />
          </label>
          <div className="flex items-end">
            <PrimaryButton type="submit">Plan it</PrimaryButton>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            We'll ask for a scan the day before and the day after, then show you exactly what
            changed.
          </p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setPlanning(true)}
          className="inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-secondary"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Plan a before-and-after check-in
        </button>
      )}

      {events.filter((event) => event.day >= today).length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Planned check-ins">
          {events
            .filter((event) => event.day >= today)
            .map((event) => (
              <li
                key={event.id}
                className="flex min-h-[44px] items-center gap-2 rounded-2xl border border-border pr-1 pl-3 text-sm"
              >
                {EVENT_KINDS[event.kind].label} · {longDate(`${event.day}T12:00:00`)}
                <button
                  type="button"
                  onClick={() => remove(event.id)}
                  aria-label={`Remove ${EVENT_KINDS[event.kind].label} on ${event.day}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
        </ul>
      )}

      <div>
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Milestones
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {reached.map((milestone) => (
            <li key={milestone.id} title={milestone.detail}>
              <Badge tone={milestone.reached ? "success" : "outline"}>
                {milestone.reached ? "" : "Next: "}
                {milestone.title}
              </Badge>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const BeforeAfter = ({
  label,
  day,
  changes,
}: {
  label: string;
  day: string;
  changes: ReturnType<typeof compareScans>;
}) => {
  const moved = changes.filter((change) => change.verdict !== "same");
  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
        Before and after · {label.toLowerCase()} · {longDate(`${day}T12:00:00`)}
      </p>
      {moved.length === 0 ? (
        <p className="mt-2 text-sm">
          Nothing moved beyond everyday noise. Your skin took it in its stride.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {moved.map((change) => (
            <li key={change.key} className="flex items-center justify-between gap-3 text-sm">
              <span>{change.label}</span>
              <span className="readout">
                {change.before.toFixed(1)} → {change.after.toFixed(1)}{" "}
                <span className={change.verdict === "better" ? "text-success" : "text-foreground"}>
                  ({change.verdict === "better" ? "better" : "worse"})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
