import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  Clock,
  Heart,
  Mail,
  MessageSquareText,
  Minus,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge, PageHeader, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import type { AdminData } from "@/integrations/beta-api";
import {
  declineRequest,
  grantAccess,
  isDemo,
  loadAdminData,
  revokeAccess,
  updateFeedback,
} from "@/integrations/beta-api";
import type { AccessDuration, Feedback, FeedbackStatus, Sentiment, TesterStatus } from "@/lib/beta";
import {
  ACCESS_DURATIONS,
  accessUntil,
  CATEGORY_LABEL,
  daysLeft,
  feedbackSummary,
  firstNameFrom,
  grantSchema,
  sentimentFor,
  testerStatus,
  thankYouMailto,
  triageOrder,
} from "@/lib/beta";
import { longDate, shortDate } from "@/lib/progress";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin")({
  head: () =>
    pageHead({
      title: "Beta Dashboard — Glowtrace",
      description: "Private beta administration.",
      path: "/admin",
      noindex: true,
    }),
  component: AdminPage,
});

type Tab = "feedback" | "requests" | "testers" | "grant";

const SENTIMENT: Record<
  Sentiment,
  { label: string; tone: "warning" | "outline" | "success"; icon: typeof Minus }
> = {
  negative: { label: "Needs attention", tone: "warning", icon: AlertTriangle },
  neutral: { label: "Neutral", tone: "outline", icon: Minus },
  positive: { label: "Positive", tone: "success", icon: Heart },
};

const STATUS: Record<TesterStatus, { label: string; tone: "success" | "warning" | "outline" }> = {
  active: { label: "Active", tone: "success" },
  "ending-soon": { label: "Ending soon", tone: "warning" },
  expired: { label: "Expired", tone: "outline" },
  revoked: { label: "Revoked", tone: "outline" },
};

const FEEDBACK_FILTERS: { id: "attention" | "problems" | "praise" | "all"; label: string }[] = [
  { id: "attention", label: "Open" },
  { id: "problems", label: "Problems" },
  { id: "praise", label: "Praise" },
  { id: "all", label: "All" },
];

const smallButton =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-sm font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50";

const DurationButtons = ({
  label,
  onPick,
  busy,
}: {
  label: (days: AccessDuration) => string;
  onPick: (days: AccessDuration) => void;
  busy: boolean;
}) => (
  <div className="flex flex-wrap gap-2">
    {ACCESS_DURATIONS.map((days) => (
      <button
        key={days}
        type="button"
        disabled={busy}
        onClick={() => onPick(days)}
        className={smallButton}
      >
        {label(days)}
      </button>
    ))}
  </div>
);

const FeedbackCard = ({
  item,
  onStatus,
  onThank,
}: {
  item: Feedback;
  onStatus: (status: FeedbackStatus) => void;
  onThank: () => void;
}) => {
  const sentiment = SENTIMENT[sentimentFor(item)];
  return (
    <li
      className={`p-5 ${sentimentFor(item) === "negative" && item.status === "new" ? "surface-strong" : "surface"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={sentiment.tone}>
          <sentiment.icon className="h-3.5 w-3.5" aria-hidden="true" />
          {sentiment.label}
        </Badge>
        <Badge tone="outline">{CATEGORY_LABEL[item.category]}</Badge>
        <span className="readout text-sm text-foreground">{item.rating}/5</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {shortDate(item.created_at)} · {item.page ?? "unknown page"}
        </span>
      </div>
      <p className="mt-3 text-foreground">{item.message}</p>
      <p className="mt-2 text-sm text-muted-foreground">{item.email}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.status !== "triaged" && item.status !== "resolved" && (
          <button type="button" className={smallButton} onClick={() => onStatus("triaged")}>
            <Check className="h-4 w-4" aria-hidden="true" /> Mark triaged
          </button>
        )}
        {item.status !== "resolved" && (
          <button type="button" className={smallButton} onClick={() => onStatus("resolved")}>
            <CheckCheck className="h-4 w-4" aria-hidden="true" /> Resolve
          </button>
        )}
        {item.status === "resolved" && (
          <button type="button" className={smallButton} onClick={() => onStatus("new")}>
            Reopen
          </button>
        )}
        {sentimentFor(item) !== "negative" &&
          (item.thanked_at ? (
            <Badge tone="success">
              <Heart className="h-3.5 w-3.5" aria-hidden="true" /> Thanked{" "}
              {shortDate(item.thanked_at)}
            </Badge>
          ) : (
            <a
              href={thankYouMailto(item, firstNameFrom(item.email))}
              onClick={onThank}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Mail className="h-4 w-4" aria-hidden="true" /> Thank {firstNameFrom(item.email)}
            </a>
          ))}
        <span className="ml-auto text-xs font-semibold text-muted-foreground uppercase label-tracking">
          {item.status}
        </span>
      </div>
    </li>
  );
};

function AdminPage() {
  const { isAdmin, access } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("feedback");
  const [filter, setFilter] = useState<(typeof FEEDBACK_FILTERS)[number]["id"]>("attention");
  const [busy, setBusy] = useState(false);
  const [grantEmail, setGrantEmail] = useState("");
  const [grantDays, setGrantDays] = useState<AccessDuration>(30);
  const now = new Date();

  const reload = useCallback(async () => {
    const result = await loadAdminData();
    if (result.ok) {
      setData(result.data);
      setError(null);
    } else setError(result.reason);
  }, []);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  const run = async (action: () => Promise<{ ok: boolean; reason?: string }>, done: string) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success(done);
      await reload();
    } else toast.error(result.reason ?? "Something went wrong.");
  };

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">This page is for admins</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {access.kind === "member"
            ? `${access.email} isn't an admin account.`
            : "Sign in with an admin account."}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <p
        className="py-16 text-center text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {error ?? "Loading the beta dashboard…"}
      </p>
    );
  }

  const summary = feedbackSummary(data.feedback);
  const pending = data.requests.filter((request) => request.status === "pending");
  const decided = data.requests.filter((request) => request.status !== "pending");
  const activeTesters = data.testers.filter((tester) => {
    const status = testerStatus(tester, now);
    return status === "active" || status === "ending-soon";
  });
  const ordered = triageOrder(data.feedback).filter((item) =>
    filter === "attention"
      ? item.status === "new"
      : filter === "problems"
        ? sentimentFor(item) === "negative"
        : filter === "praise"
          ? sentimentFor(item) === "positive"
          : true,
  );

  const stats = [
    { label: "Requests waiting", value: pending.length, tab: "requests" as Tab },
    { label: "Active testers", value: activeTesters.length, tab: "testers" as Tab },
    { label: "Problems to triage", value: summary.urgent, tab: "feedback" as Tab },
    { label: "People to thank", value: summary.toThank, tab: "feedback" as Tab },
  ];
  const tabs: { id: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { id: "feedback", label: "Feedback", icon: MessageSquareText, count: summary.open },
    { id: "requests", label: "Requests", icon: Clock, count: pending.length },
    { id: "testers", label: "Testers", icon: Users },
    { id: "grant", label: "Grant access", icon: UserPlus },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beta Dashboard"
        subtitle={`Requests, testers and feedback for the Glowtrace beta. Average rating ${summary.averageRating ?? "—"} from ${summary.total} responses.`}
      />
      {isDemo() && (
        <p
          className="rounded-2xl border border-accent px-4 py-3 text-sm text-foreground"
          role="note"
        >
          <span className="font-semibold text-accent">Sample data. </span>
          Connect Supabase to see your real testers and feedback. Changes here reset on reload.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => setTab(stat.tab)}
            className="surface lift p-5 text-left"
          >
            <span className="readout block text-3xl text-foreground">{stat.value}</span>
            <span className="text-sm text-muted-foreground">{stat.label}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Dashboard section">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex min-h-[50px] items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition-colors ${
              tab === item.id
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className="readout">{item.count}</span>
            )}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {tab === "feedback" && (
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter feedback">
              {FEEDBACK_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${
                    filter === item.id
                      ? "border-primary text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {ordered.length === 0 ? (
              <SectionCard>
                <p className="text-sm text-muted-foreground">Nothing here. You're all caught up.</p>
              </SectionCard>
            ) : (
              <ul className="space-y-3">
                {ordered.map((item) => (
                  <FeedbackCard
                    key={item.id}
                    item={item}
                    onStatus={(status) =>
                      void run(
                        () => updateFeedback(item.id, { status }),
                        status === "new" ? "Reopened." : `Marked ${status}.`,
                      )
                    }
                    onThank={() =>
                      void run(
                        () =>
                          updateFeedback(item.id, {
                            thanked_at: new Date().toISOString(),
                            ...(item.status === "new" ? { status: "resolved" as const } : {}),
                          }),
                        "Thank-you email opened, and marked as thanked.",
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "requests" && (
          <section className="space-y-3">
            {pending.length === 0 && (
              <SectionCard>
                <p className="text-sm text-muted-foreground">No requests waiting.</p>
              </SectionCard>
            )}
            <ul className="space-y-3">
              {pending.map((request) => (
                <li key={request.email} className="surface p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-lg font-semibold">
                      {request.name ?? request.email}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Asked {shortDate(request.requested_at)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.email}</p>
                  {request.note && <p className="mt-2 text-foreground">“{request.note}”</p>}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">Approve for</span>
                    <DurationButtons
                      busy={busy}
                      label={(days) => `${days} days`}
                      onPick={(days) =>
                        void run(
                          () => grantAccess(request.email, days),
                          `${request.name ?? request.email} has ${days} days of access.`,
                        )
                      }
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(() => declineRequest(request.email), "Request declined.")
                      }
                      className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                      <Ban className="h-4 w-4" aria-hidden="true" /> Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {decided.length > 0 && (
              <SectionCard title="Already decided">
                <ul className="divide-y divide-border">
                  {decided.map((request) => (
                    <li
                      key={request.email}
                      className="flex min-h-[48px] items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">{request.name ?? request.email}</span>
                      <Badge tone={request.status === "approved" ? "success" : "outline"}>
                        {request.status === "approved" ? "Approved" : "Declined"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </section>
        )}

        {tab === "testers" && (
          <section>
            {data.testers.length === 0 ? (
              <SectionCard>
                <p className="text-sm text-muted-foreground">
                  No testers yet. Approve a request or grant access by email.
                </p>
              </SectionCard>
            ) : (
              <ul className="space-y-3">
                {data.testers.map((tester) => {
                  const status = testerStatus(tester, now);
                  const left = daysLeft(tester.expires_at, now);
                  return (
                    <li key={tester.email} className="surface p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold text-foreground">
                          {tester.email}
                        </p>
                        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {status === "revoked"
                          ? "Access revoked."
                          : status === "expired"
                            ? `Ended ${tester.expires_at ? longDate(tester.expires_at) : ""}.`
                            : `${left === null ? "No end date" : `${left} days left`}, ${accessUntil(tester.expires_at)}.`}
                        {tester.duration_days ? ` Last granted ${tester.duration_days} days.` : ""}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {status === "expired" || status === "revoked"
                            ? "Restore for"
                            : "Extend by"}
                        </span>
                        <DurationButtons
                          busy={busy}
                          label={(days) => `+${days} days`}
                          onPick={(days) =>
                            void run(
                              () => grantAccess(tester.email, days),
                              `Added ${days} days for ${tester.email}.`,
                            )
                          }
                        />
                        {status !== "revoked" && status !== "expired" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => revokeAccess(tester.email),
                                `${tester.email} no longer has access.`,
                              )
                            }
                            className="inline-flex min-h-[44px] items-center gap-1.5 px-3 text-sm font-semibold text-destructive hover:underline"
                          >
                            <Ban className="h-4 w-4" aria-hidden="true" /> Revoke
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {tab === "grant" && (
          <SectionCard title="Grant access by email">
            <form
              className="max-w-lg space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                const parsed = grantSchema.safeParse({ email: grantEmail, days: grantDays });
                if (!parsed.success) {
                  toast.error(parsed.error.issues[0]?.message ?? "Check the email.");
                  return;
                }
                void run(
                  () => grantAccess(parsed.data.email, parsed.data.days),
                  `${parsed.data.email} has ${parsed.data.days} days of access.`,
                ).then(() => setGrantEmail(""));
              }}
            >
              <label className="block text-sm font-semibold text-muted-foreground">
                Email
                <input
                  type="email"
                  required
                  value={grantEmail}
                  onChange={(event) => setGrantEmail(event.target.value)}
                  placeholder="tester@example.co.za"
                  className="mt-1 min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground"
                />
              </label>
              <fieldset>
                <legend className="mb-2 text-sm font-semibold text-muted-foreground">
                  Access for
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {ACCESS_DURATIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      aria-pressed={grantDays === days}
                      onClick={() => setGrantDays(days)}
                      className={`min-h-[50px] rounded-2xl border text-base font-semibold transition-colors ${
                        grantDays === days
                          ? "border-transparent bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </fieldset>
              <PrimaryButton type="submit" disabled={busy}>
                <UserPlus className="h-5 w-5" aria-hidden="true" /> Grant Access
              </PrimaryButton>
              <p className="text-xs text-muted-foreground">
                If they already have access, the days are added to what they have left. They sign in
                with this email, by email link or Google.
              </p>
            </form>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
