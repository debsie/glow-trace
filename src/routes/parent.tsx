import { createFileRoute, Link } from "@tanstack/react-router";
import { Delete, Lock, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { useFocusTasks } from "@/hooks/use-focus-tasks";
import { useParentPin } from "@/hooks/use-parent-pin";
import { countDone, isFourDigits, progressPercent } from "@/lib/focus";

export const Route = createFileRoute("/parent")({
  head: () => ({
    meta: [
      { title: "Glow Trace — Parent Mode" },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Glow Trace — Parent Mode" },
      {
        property: "og:description",
        content: "Review focus progress and manage your child's focus tasks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParentPage,
});

type Phase = "gate" | "open";

function ParentPage() {
  const [phase, setPhase] = useState<Phase>("gate");
  return phase === "gate" ? (
    <PinGate onSuccess={() => setPhase("open")} />
  ) : (
    <ParentDashboard onLock={() => setPhase("gate")} />
  );
}

/* ---------- PIN gate: entering Parent Mode always requires the 4-digit PIN ---------- */

const PinGate = ({ onSuccess }: { onSuccess: () => void }) => {
  const { verify, hydrated } = useParentPin();
  const [entry, setEntry] = useState("");
  const [wrong, setWrong] = useState(false);
  const settling = useRef(false);

  useEffect(() => {
    if (settling.current || entry.length < 4) return;
    settling.current = true;
    const timer = window.setTimeout(() => {
      if (verify(entry)) {
        toast.success("Welcome back.");
        onSuccess();
      } else {
        setWrong(true);
        window.setTimeout(() => {
          setEntry("");
          setWrong(false);
          settling.current = false;
        }, 650);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [entry, verify, onSuccess]);

  const press = (digit: string) => {
    if (settling.current) return;
    setEntry((current) => (current.length < 4 ? current + digit : current));
  };

  const backspace = () => {
    if (settling.current) return;
    setEntry((current) => current.slice(0, -1));
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <div className={`w-full max-w-sm text-center ${wrong ? "shake" : ""}`}>
        <div className="glow-soft mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-primary/40 bg-card">
          <Lock className="h-9 w-9 text-primary" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Parent Mode</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter your 4-digit PIN to continue.</p>

        <div
          className="mt-6 flex justify-center gap-3"
          role="status"
          aria-live="assertive"
          aria-label={wrong ? "Incorrect PIN, try again" : "PIN entry"}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border-2 transition-colors ${
                wrong
                  ? "border-destructive bg-destructive"
                  : entry.length > i
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/50"
              }`}
            />
          ))}
        </div>
        <p aria-live="assertive" className="mt-3 min-h-6 text-sm font-semibold text-destructive">
          {wrong ? "That PIN didn't match. Try again." : ""}
        </p>

        <div className="mx-auto mt-4 grid w-64 grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => press(digit)}
              disabled={!hydrated}
              className="min-h-[64px] rounded-2xl border border-border bg-card text-2xl font-semibold transition-colors hover:bg-secondary active:bg-secondary/70"
            >
              {digit}
            </button>
          ))}
          <span />
          <button
            type="button"
            onClick={() => press("0")}
            disabled={!hydrated}
            className="min-h-[64px] rounded-2xl border border-border bg-card text-2xl font-semibold transition-colors hover:bg-secondary active:bg-secondary/70"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            aria-label="Delete last digit"
            className="inline-flex min-h-[64px] items-center justify-center rounded-2xl border border-border bg-card transition-colors hover:bg-secondary active:bg-secondary/70"
          >
            <Delete className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <Link
          to="/"
          className="mt-8 inline-flex min-h-[50px] items-center justify-center rounded-full px-6 text-base font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to Child Mode
        </Link>
      </div>
    </div>
  );
};

/* ---------- Parent dashboard: progress, task management, PIN change ---------- */

const ParentDashboard = ({ onLock }: { onLock: () => void }) => {
  const { tasks, addTask, removeTask, resetToday } = useFocusTasks();
  const { changePin, pin } = useParentPin();
  const [title, setTitle] = useState("");
  const [nextPin, setNextPin] = useState("");
  const done = countDone(tasks);
  const percent = progressPercent(tasks);

  const submitTask = () => {
    const clean = title.trim();
    if (!clean) return;
    addTask(clean);
    setTitle("");
    toast.success("Task added to the focus board.");
  };

  const submitPin = () => {
    if (!isFourDigits(nextPin)) {
      toast.error("Pick exactly four digits.");
      return;
    }
    changePin(nextPin);
    setNextPin("");
    toast.success("Parent PIN updated.");
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto w-full max-w-md px-5 pt-8 pb-12">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Parent Mode</h1>
          <Link
            to="/"
            onClick={onLock}
            className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-secondary px-5 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            Child Mode
          </Link>
        </header>

        <section aria-labelledby="progress-heading" className="mt-6 rounded-3xl border border-border bg-card p-5">
          <h2 id="progress-heading" className="label-tracking text-sm font-bold text-muted-foreground uppercase">
            Today
          </h2>
          <p aria-live="polite" className="mt-1 text-xl font-semibold">
            {done} of {tasks.length} tasks complete ({percent}%)
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              resetToday();
              toast.success("Fresh start — all tasks reset for today.");
            }}
            className="mt-4 min-h-[50px] w-full rounded-full border border-border bg-background text-base font-semibold transition-colors hover:bg-secondary/50"
          >
            Reset for a new day
          </button>
        </section>

        <section aria-labelledby="manage-heading" className="mt-6">
          <h2 id="manage-heading" className="label-tracking mb-3 text-sm font-bold text-muted-foreground uppercase">
            Focus steps
          </h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitTask();
            }}
            className="flex gap-2"
          >
            <label className="sr-only" htmlFor="new-task">
              New focus step
            </label>
            <input
              id="new-task"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a focus step…"
              maxLength={120}
              className="min-h-[50px] flex-1 rounded-2xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              aria-label="Add task"
              className="inline-flex min-h-[50px] w-[50px] items-center justify-center rounded-2xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </button>
          </form>
          <ul className="mt-3 space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4"
              >
                <span className={`flex-1 text-base ${task.done ? "text-muted-foreground" : "text-foreground"}`}>
                  {task.title}
                </span>
                {task.done && (
                  <span className="rounded-full bg-primary/15 px-3 py-1 text-sm font-semibold text-primary">
                    Done
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    removeTask(task.id);
                    toast("Task removed.");
                  }}
                  aria-label={`Remove task: ${task.title}`}
                  className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pin-heading" className="mt-6 rounded-3xl border border-border bg-card p-5">
          <h2 id="pin-heading" className="label-tracking text-sm font-bold text-muted-foreground uppercase">
            Parent PIN
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Used to unlock Parent Mode. Change it any time.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPin();
            }}
            className="mt-3 flex gap-2"
          >
            <label className="sr-only" htmlFor="new-pin">
              New four-digit PIN
            </label>
            <input
              id="new-pin"
              value={nextPin}
              onChange={(event) => setNextPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              autoComplete="off"
              placeholder={pin}
              className="min-h-[50px] flex-1 rounded-2xl border border-input bg-background px-4 text-center text-lg tracking-[0.4em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="min-h-[50px] rounded-2xl bg-secondary px-5 text-base font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
            >
              Save
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
