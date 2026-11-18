import { useRouterState } from "@tanstack/react-router";
import { MessageSquareText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GhostButton, PrimaryButton } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import { sendFeedback } from "@/integrations/beta-api";
import type { FeedbackCategory } from "@/lib/beta";
import { CATEGORY_LABEL, FEEDBACK_CATEGORIES, feedbackSchema } from "@/lib/beta";

const RATINGS = [
  { value: 1, label: "Poor" },
  { value: 2, label: "Meh" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Love it" },
];

/** "Send feedback" on every app screen; it goes to the admin dashboard's triage list. */
export const FeedbackButton = () => {
  const { access } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>("idea");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const email =
    access.kind === "member" ? access.email : access.kind === "demo" ? "demo@glowtrace.app" : null;
  if (!email) return null;

  const submit = async () => {
    const parsed = feedbackSchema.safeParse({ rating, category, message, page: pathname });
    if (!parsed.success) {
      setError(
        rating === null
          ? "Pick a rating first."
          : (parsed.error.issues[0]?.message ?? "Check the form."),
      );
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendFeedback(email, parsed.data);
    setSending(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setOpen(false);
    setRating(null);
    setMessage("");
    toast.success("Thank you. Your feedback went straight to the team.");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-24 z-30 inline-flex min-h-[50px] items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 lg:bottom-6"
      >
        <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" /> Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="surface page-enter w-full max-w-md space-y-4 rounded-b-none p-5 sm:rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="feedback-title" className="font-display text-xl font-semibold">
                  Tell us how it's going
                </h2>
                <p className="text-sm text-muted-foreground">
                  The team reads every message. Sent with your email so we can reply.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted-foreground">
                How is Glowtrace for you?
              </legend>
              <div className="grid grid-cols-5 gap-1.5">
                {RATINGS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={rating === item.value}
                    onClick={() => setRating(item.value)}
                    className={`flex min-h-[56px] flex-col items-center justify-center rounded-2xl border text-xs font-semibold transition-colors ${
                      rating === item.value
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="readout text-base">{item.value}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-muted-foreground">
                It's about…
              </legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_CATEGORIES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => setCategory(item)}
                    className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${
                      category === item
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_LABEL[item]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold text-muted-foreground">
              Your message
              <textarea
                value={message}
                maxLength={2000}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="What happened, or what would make it better?"
                className="mt-1 min-h-[110px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground"
              />
            </label>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <PrimaryButton className="flex-1" disabled={sending} onClick={() => void submit()}>
                {sending ? "Sending…" : "Send Feedback"}
              </PrimaryButton>
              <GhostButton onClick={() => setOpen(false)}>Cancel</GhostButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
