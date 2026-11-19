import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  FlaskConical,
  Minus,
  Moon,
  Plus,
  Send,
  Sun,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import { Badge, BUTTON_PRIMARY, PageHeader, SectionCard } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import type { Finding, Intent, Severity, Suggestion, Trend } from "@/lib/agent/agent";
import { cloudConfigured } from "@/integrations/supabase/client";
import { answer, briefing, intentFor, QUICK_QUESTIONS } from "@/lib/agent/agent";
import { askCoach } from "@/lib/coach-client";
import type { BlockedGate } from "@/lib/plans";
import { pageHead } from "@/lib/seo";
import type { ScanCategory } from "@/lib/types";

export const Route = createFileRoute("/agent")({
  head: () =>
    pageHead({
      title: "Your Care Agent — Glowtrace",
      description:
        "A personal skin, hair and nail agent that reads your scans and shelf on your device and suggests what to use next.",
      path: "/agent",
      noindex: true,
    }),
  component: AgentPage,
});

const SEVERITY: Record<Severity, { label: string; tone: "warning" | "primary" | "success" }> = {
  focus: { label: "Focus", tone: "warning" },
  watch: { label: "Watch", tone: "primary" },
  good: { label: "Good", tone: "success" },
};

const TREND: Record<Trend, { label: string; icon: typeof Minus } | null> = {
  improving: { label: "Improving", icon: ArrowUpRight },
  worsening: { label: "Slipping", icon: ArrowDownRight },
  steady: { label: "Steady", icon: Minus },
  new: null,
};

const AREA_LABEL: Record<ScanCategory, string> = { skin: "Skin", hair: "Hair", nails: "Nails" };

type Turn = { id: number; from: "you" | "agent"; paragraphs: string[]; productIds: string[] };

const FindingRow = ({ finding }: { finding: Finding }) => {
  const severity = SEVERITY[finding.severity];
  const trend = TREND[finding.trend];
  return (
    <li className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">
          {finding.label}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {AREA_LABEL[finding.area]}
          </span>
        </p>
        {finding.severity !== "good" && (
          <p className="mt-0.5 text-sm text-muted-foreground">{finding.habit}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="readout text-sm text-foreground">{finding.health.toFixed(1)}</span>
        {trend && (
          <Badge tone="outline">
            <trend.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {trend.label}
          </Badge>
        )}
        <Badge tone={severity.tone}>{severity.label}</Badge>
      </div>
    </li>
  );
};

const ProductCard = ({
  suggestion,
  onAdd,
}: {
  suggestion: Suggestion;
  onAdd: (productId: string) => void;
}) => {
  const [showDiy, setShowDiy] = useState(false);
  const { product, profile } = suggestion;
  const WhenIcon = profile.when === "pm" ? Moon : Sun;
  return (
    <li className="surface lift flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{product.brand}</p>
          <p className="font-display text-lg font-semibold text-foreground">{product.name}</p>
        </div>
        <span className="text-right">
          <span className="readout block text-lg text-primary">{suggestion.match}%</span>
          <span className="block text-xs text-muted-foreground">match</span>
        </span>
      </div>
      <p className="mt-2 text-sm text-foreground">{suggestion.why}</p>
      <p className="mt-1 text-xs text-muted-foreground">{product.ingredients}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge tone="accent">
          <WhenIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {profile.when === "am"
            ? "Morning"
            : profile.when === "pm"
              ? "Evening"
              : "Morning or evening"}
        </Badge>
        {profile.gentle && <Badge tone="outline">Gentle</Badge>}
        {suggestion.onShelf && (
          <Badge tone="success">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> On your shelf
          </Badge>
        )}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{profile.howTo}</p>
      {suggestion.conflict && (
        <p className="mt-3 flex gap-2 rounded-2xl border border-warning px-3 py-2 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          {suggestion.conflict}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        {!suggestion.onShelf && (
          <button
            type="button"
            onClick={() => onAdd(product.id)}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> I have this
          </button>
        )}
        {suggestion.diy && (
          <button
            type="button"
            aria-expanded={showDiy}
            onClick={() => setShowDiy((open) => !open)}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary hover:underline"
          >
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            {showDiy ? "Hide DIY option" : "DIY option"}
          </button>
        )}
      </div>
      {showDiy && suggestion.diy && (
        <div className="mt-3 rounded-2xl border border-border p-3">
          <p className="text-sm font-semibold text-foreground">{suggestion.diy.name}</p>
          <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
            {(suggestion.diy.recipe_instructions ?? "").split("\n").map((line) => (
              <li key={line}>{line.replace(/^\d+\.\s*/, "")}</li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Patch-test first.</p>
        </div>
      )}
    </li>
  );
};

function AgentPage() {
  const { scans, catalog, inventory, toggleShelfProduct, tier } = useAppState();
  // Pro and Studio: typed questions go to the written coach (server checks the plan too).
  const coach = tier !== "free" && cloudConfigured;
  const [thinking, setThinking] = useState(false);
  const brief = useMemo(() => briefing(scans, catalog, inventory), [scans, catalog, inventory]);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [blocked, setBlocked] = useState<BlockedGate | null>(null);
  const [area, setArea] = useState<ScanCategory | "all">("all");
  const nextId = useRef(0);

  const ask = (question: string, intent: Intent | null) => {
    const id = nextId.current;
    nextId.current += 2;
    const reply = intent
      ? answer(intent, brief, catalog, inventory)
      : {
          paragraphs: [
            "I can help with what to focus on, which products to use and when, whether your shelf mixes safely, your progress, and habits. Try one of the questions below.",
          ],
          productIds: [],
        };
    setTurns((current) => [
      ...current,
      { id, from: "you", paragraphs: [question], productIds: [] },
      { id: id + 1, from: "agent", ...reply },
    ]);
  };

  const askWritten = async (question: string) => {
    const id = nextId.current;
    nextId.current += 2;
    setTurns((current) => [
      ...current,
      { id, from: "you", paragraphs: [question], productIds: [] },
    ]);
    setThinking(true);
    const reply = await askCoach({
      question,
      findings: brief.findings,
      shelf: inventory.filter((item) => item.in_stock).map((item) => productName(item.product_id)),
      routine: [],
    });
    setThinking(false);
    setTurns((current) => [
      ...current,
      {
        id: id + 1,
        from: "agent",
        paragraphs:
          "answer" in reply
            ? [
                ...reply.answer.split(/\n{2,}/).filter(Boolean),
                ...(reply.remaining <= 3
                  ? [
                      `${reply.remaining} written ${reply.remaining === 1 ? "question" : "questions"} left today.`,
                    ]
                  : []),
              ]
            : [reply.error],
        productIds: [],
      },
    ]);
  };

  const onAdd = (productId: string) => {
    const gate = toggleShelfProduct(productId);
    if (gate.allowed) {
      setBlocked(null);
      toast.success("Added to your shelf. Your routine will use it.");
    } else {
      setBlocked(gate);
    }
  };

  const productName = (id: string) => catalog.find((product) => product.id === id)?.name ?? id;
  const shown = brief.suggestions.filter(
    (suggestion) => area === "all" || suggestion.profile.area === area,
  );
  const areas = (["skin", "hair", "nails"] as const).filter((item) =>
    brief.suggestions.some((suggestion) => suggestion.profile.area === item),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Care Agent"
        subtitle="Reads your scans and your shelf on this device, and tells you what to do next."
      />

      <section className="surface-strong p-6" aria-live="polite">
        <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
          Today's briefing
        </p>
        <p className="mt-3 font-display text-2xl leading-snug font-semibold text-foreground">
          {brief.headline}
        </p>
        {brief.findings.length === 0 && (
          <Link to="/scan" className={`${BUTTON_PRIMARY} mt-5`}>
            Run a scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </Link>
        )}
      </section>

      {brief.findings.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <SectionCard title="What I'm seeing">
            <ul className="divide-y divide-border">
              {brief.findings.map((finding) => (
                <FindingRow key={`${finding.area}-${finding.concern}`} finding={finding} />
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Health out of 100 for each indicator, from your latest scan of each area.
              {brief.unscanned.length > 0 &&
                ` No ${brief.unscanned.map((item) => AREA_LABEL[item].toLowerCase()).join(" or ")} scan yet.`}
            </p>
          </SectionCard>

          <SectionCard title="Ask your agent">
            <div className="space-y-3" aria-live="polite">
              {turns.length === 0 && (
                <p className="text-sm text-muted-foreground">Pick a question, or type your own.</p>
              )}
              {turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`page-enter rounded-2xl px-4 py-3 text-sm ${
                    turn.from === "you"
                      ? "ml-8 bg-primary text-primary-foreground"
                      : "mr-8 border border-border bg-background text-foreground"
                  }`}
                >
                  <p className="sr-only">{turn.from === "you" ? "You asked:" : "Agent:"}</p>
                  {turn.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mt-1 first:mt-0">
                      {paragraph}
                    </p>
                  ))}
                  {turn.productIds.length > 0 && (
                    <ul className="mt-2 list-inside list-disc">
                      {turn.productIds.map((id) => (
                        <li key={id}>{productName(id)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {thinking && (
                <p className="text-sm text-muted-foreground">Glowtrace is writing your answer.</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question.intent}
                  type="button"
                  onClick={() => ask(question.label, question.intent)}
                  className="min-h-[44px] rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary"
                >
                  {question.label}
                </button>
              ))}
            </div>
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const text = draft.trim();
                if (!text || thinking) return;
                if (coach) void askWritten(text);
                else ask(text, intentFor(text));
                setDraft("");
              }}
            >
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="e.g. Can I use my BHA with retinal?"
                aria-label="Ask your agent"
                maxLength={coach ? 500 : 200}
                disabled={thinking}
                className="min-h-[50px] min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label="Ask"
                className="inline-flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Send className="h-5 w-5" aria-hidden="true" />
              </button>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">
              {coach
                ? "Typed questions are answered by Glowtrace's written coach: it sees your scores, trends and shelf, never your photos. The quick questions above stay on this device."
                : "Answers come from fixed care rules applied to your own results. Nothing you type leaves this device. Pro and Studio add a written coach for questions in your own words."}
            </p>
          </SectionCard>
        </div>
      )}

      {brief.suggestions.length > 0 && (
        <section aria-labelledby="picks" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="picks" className="font-display text-2xl font-semibold">
                Suggested for you
              </h2>
              <p className="text-sm text-muted-foreground">
                Matched to your results. What you already own comes first.
              </p>
            </div>
            <div
              className="flex rounded-full border border-border bg-secondary p-1"
              role="group"
              aria-label="Filter by area"
            >
              {(["all", ...areas] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={area === item}
                  onClick={() => setArea(item)}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-semibold transition-colors ${
                    area === item
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item === "all" ? "All" : AREA_LABEL[item]}
                </button>
              ))}
            </div>
          </div>
          {blocked && <UpgradeCard gate={blocked} onDismiss={() => setBlocked(null)} />}
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {shown.map((suggestion) => (
              <ProductCard key={suggestion.product.id} suggestion={suggestion} onAdd={onAdd} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Products shown are examples from the Glowtrace catalogue, not paid placements.
            Patch-test anything new, and see a dermatologist for anything that worries you.
          </p>
        </section>
      )}
    </div>
  );
}
