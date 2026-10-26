import { Check } from "lucide-react";

import type { FocusTask } from "@/lib/focus";

type TaskChecklistProps = {
  tasks: FocusTask[];
  hydrated: boolean;
  onToggle: (id: string) => void;
};

/** Big, calm checkboxes — every target is at least 50 CSS px tall. */
export const TaskChecklist = ({ tasks, hydrated, onToggle }: TaskChecklistProps) => {
  if (!hydrated) {
    return (
      <div className="space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-card/70" />
        ))}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <button
            type="button"
            onClick={() => onToggle(task.id)}
            aria-pressed={task.done}
            className={`flex min-h-[56px] w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition-colors ${
              task.done
                ? "border-primary/60 bg-primary/10"
                : "border-border bg-card hover:bg-card/70"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${
                task.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"
              }`}
            >
              {task.done && <Check className="h-5 w-5" aria-hidden="true" />}
            </span>
            <span
              className={`flex-1 text-lg leading-snug ${
                task.done ? "text-muted-foreground" : "text-foreground"
              }`}
            >
              {task.title}
            </span>
            {task.done && (
              <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                Done
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};
