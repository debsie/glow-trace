import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { findingsFor } from "@/lib/agent/agent";
import { longDate } from "@/lib/progress";
import { prepPlan } from "@/lib/prep-plan";

export const Route = createFileRoute("/pro/clients/$id/prep")({
  component: PrepPlanner,
});

const today = () => new Date().toISOString().slice(0, 10);

function PrepPlanner() {
  const { id } = Route.useParams();
  const { clients, scans } = useAppState();
  const client = clients.find((item) => item.id === id);
  const [eventDate, setEventDate] = useState("");

  if (!client) {
    return <PageHeader title="Client not found" />;
  }

  const findings = findingsFor(scans.filter((scan) => scan.client_id === client.id));
  const plan = eventDate ? prepPlan(eventDate, today(), findings) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Prep plan for ${client.client_name}`}
        subtitle="A 7-day countdown of what to pause, add and avoid before the event."
      />

      <SectionCard>
        <label className="block text-sm font-semibold" htmlFor="event-date">
          Event date
        </label>
        <input
          id="event-date"
          type="date"
          value={eventDate}
          min={today()}
          onChange={(event) => setEventDate(event.target.value)}
          className="mt-1 min-h-[50px] rounded-lg border border-border bg-card px-3 text-base"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Check the client's own products first: a retinoid or acid they use will need pausing.
        </p>
      </SectionCard>

      <div aria-live="polite" className="space-y-3">
        {plan && plan.daysAway < 0 && (
          <SectionCard>
            <p className="text-sm text-muted-foreground">
              That date has passed. Pick a future date.
            </p>
          </SectionCard>
        )}
        {plan && plan.daysAway >= 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {longDate(eventDate)} is{" "}
              {plan.daysAway === 0 ? "today" : `${plan.daysAway} days away`}.
              {plan.shortRunway && " Less than a week is left, so the earliest steps are skipped."}
            </p>
            {plan.days.map((day) => (
              <SectionCard
                key={day.daysBefore}
                title={day.daysBefore === 0 ? day.title : `${day.daysBefore} days before`}
              >
                {day.daysBefore !== 0 && (
                  <p className="font-display text-lg font-semibold">{day.title}</p>
                )}
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {day.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </SectionCard>
            ))}
          </>
        )}
      </div>

      <Link
        to="/pro/clients/$id"
        params={{ id: client.id }}
        className="inline-flex min-h-[50px] items-center font-semibold text-primary hover:underline"
      >
        Back to {client.client_name}
      </Link>
    </div>
  );
}
