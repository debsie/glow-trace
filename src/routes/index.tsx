import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { GlowTraceCanvas } from "@/components/glow-trace-canvas";
import { TaskChecklist } from "@/components/task-checklist";
import { useFocusTasks } from "@/hooks/use-focus-tasks";
import { countDone, progressPercent } from "@/lib/focus";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Glow Trace — Focus Board" },
      {
        name: "description",
        content: "A calm focus board and glowing tracing activity that help kids find their focus.",
      },
      { property: "og:title", content: "Glow Trace — Focus Board" },
      {
        property: "og:description",
        content: "A calm focus board and glowing tracing activity that help kids find their focus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const { tasks, hydrated, toggleTask } = useFocusTasks();
  const done = countDone(tasks);
  const percent = progressPercent(tasks);

  const handleToggle = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    toggleTask(id);
    if (task && !task.done) {
      toast.success("Glowing! One more step done.");
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-5 pt-8 pb-12">
        <header className="flex items-center justify-between">
          <h1 className="glow-text text-3xl font-bold text-primary">Glow Trace</h1>
          <Link
            to="/parent"
            aria-label="Open Parent Mode"
            className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="h-5 w-5" aria-hidden="true" />
          </Link>
        </header>

        <section aria-labelledby="glow-meter" className="rounded-3xl border border-border bg-card p-5">
          <h2 id="glow-meter" className="label-tracking text-sm font-bold text-muted-foreground uppercase">
            Today's glow
          </h2>
          <p aria-live="polite" className="mt-1 text-2xl font-semibold text-foreground">
            {done} of {tasks.length} tasks glowing
          </p>
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Tasks completed today"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </section>

        <section aria-labelledby="tasks-heading">
          <h2 id="tasks-heading" className="label-tracking mb-3 text-sm font-bold text-muted-foreground uppercase">
            Focus steps
          </h2>
          <TaskChecklist tasks={tasks} hydrated={hydrated} onToggle={handleToggle} />
        </section>

        <section aria-labelledby="trace-heading">
          <h2 id="trace-heading" className="label-tracking mb-3 text-sm font-bold text-muted-foreground uppercase">
            Glow trace break
          </h2>
          <ErrorBoundary label="glow_trace_canvas">
            <GlowTraceCanvas />
          </ErrorBoundary>
        </section>
      </div>
    </div>
  );
}
