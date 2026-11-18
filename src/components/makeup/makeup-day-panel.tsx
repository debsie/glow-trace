import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { UpgradeCard } from "@/components/billing/upgrade-card";
import { MakeupPrepPanel } from "@/components/makeup/makeup-prep-panel";
import { PrimaryButton, SectionCard } from "@/components/ui/bits";
import { DEFAULT_PROFILE, loadProfile, makeupDay, saveProfile } from "@/lib/makeup-day";
import type { MakeupProfile } from "@/lib/makeup-day";
import { makeupDayGate } from "@/lib/plans";
import type { ScanReport, SubscriptionTier } from "@/lib/types";

type Phase = "before" | "after" | "recovery";

const QUESTIONS: {
  key: keyof MakeupProfile;
  label: string;
  options: { value: string | boolean; label: string }[];
}[] = [
  {
    key: "feel",
    label: "By midday, your skin feels",
    options: [
      { value: "oily", label: "Oily all over" },
      { value: "combination", label: "Oily in the T-zone" },
      { value: "normal", label: "Comfortable" },
      { value: "dry", label: "Tight or dry" },
    ],
  },
  {
    key: "sensitive",
    label: "Does your skin react easily (stinging, redness)?",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ],
  },
  {
    key: "coverage",
    label: "Coverage you like",
    options: [
      { value: "sheer", label: "Sheer" },
      { value: "light", label: "Light" },
      { value: "medium", label: "Medium" },
      { value: "full", label: "Full" },
    ],
  },
  {
    key: "wear",
    label: "How long will you wear it today?",
    options: [
      { value: "short", label: "A few hours" },
      { value: "day", label: "All day" },
      { value: "long", label: "Event, 10+ hours" },
    ],
  },
  {
    key: "waterproof",
    label: "Waterproof or long-wear products?",
    options: [
      { value: true, label: "Yes" },
      { value: false, label: "No" },
    ],
  },
  {
    key: "climate",
    label: "Today's weather",
    options: [
      { value: "humid", label: "Humid (coast)" },
      { value: "dry", label: "Dry (Highveld)" },
      { value: "mild", label: "Mild" },
    ],
  },
];

/** Makeup Day inside the Routine page: questions once, then Before, Removal and Recovery. */
export const MakeupDayPanel = ({
  report,
  tier,
}: {
  report: ScanReport | null;
  tier: SubscriptionTier;
}) => {
  const [profile, setProfile] = useState<MakeupProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MakeupProfile>(DEFAULT_PROFILE);
  const [phase, setPhase] = useState<Phase>("before");
  useEffect(() => {
    const saved = loadProfile();
    setProfile(saved);
    setEditing(saved === null);
    if (saved) setDraft(saved);
  }, []);

  const gate = makeupDayGate(tier);

  if (editing || !profile) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Six quick questions about what a photo can't show. Saved on this device only.
        </p>
        <SectionCard>
          <div className="space-y-5">
            {QUESTIONS.map((question) => (
              <fieldset key={question.key}>
                <legend className="text-sm font-semibold">{question.label}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {question.options.map((option) => {
                    const selected = draft[question.key] === option.value;
                    return (
                      <button
                        key={String(option.value)}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setDraft({ ...draft, [question.key]: option.value })}
                        className={`min-h-[50px] rounded-lg border px-4 text-sm font-semibold ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-foreground"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <PrimaryButton
              onClick={() => {
                saveProfile(draft);
                setProfile(draft);
                setEditing(false);
              }}
            >
              See my Makeup Day
            </PrimaryButton>
          </div>
        </SectionCard>
      </div>
    );
  }

  const day = makeupDay(report, profile);
  const tabs: { id: Phase; label: string }[] = [
    { id: "before", label: "Before" },
    { id: "after", label: "Removal" },
    { id: "recovery", label: "Recovery" },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {report
          ? "From your latest skin scan and your answers."
          : "From your answers. Scan your skin for shade, undertone and correctors."}
      </p>
      <div
        className="inline-grid grid-cols-3 rounded-2xl border border-border bg-secondary p-1"
        role="tablist"
        aria-label="Makeup Day phase"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={phase === tab.id}
            onClick={() => setPhase(tab.id)}
            className={`min-h-[44px] rounded-xl px-5 text-sm font-semibold transition-colors ${
              phase === tab.id
                ? "bg-card text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {phase === "before" && (
        <div className="space-y-3">
          <SectionCard title="Your foundation">
            <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">Formula</dt>
              <dd className="font-semibold">{day.before.foundation.base}</dd>
              <dt className="text-muted-foreground">Finish</dt>
              <dd className="font-semibold">{day.before.foundation.finish}</dd>
              <dt className="text-muted-foreground">Coverage</dt>
              <dd className="font-semibold">{day.before.foundation.coverage}</dd>
              <dt className="text-muted-foreground">Setting</dt>
              <dd>{day.before.setting}</dd>
            </dl>
            <p className="mt-3 text-sm text-muted-foreground">{day.before.foundation.why}</p>
            {day.before.foundation.avoid.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                Best avoided: {day.before.foundation.avoid.join("; ")}.
              </p>
            )}
          </SectionCard>
          <SectionCard title="Shade, prep and correcting">
            {report ? (
              <MakeupPrepPanel report={report} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Scan your skin to get shade depth, undertone and colour correcting.{" "}
                <Link to="/scan" className="font-semibold text-primary hover:underline">
                  Scan now
                </Link>
              </p>
            )}
          </SectionCard>
        </div>
      )}

      {phase !== "before" && !gate.allowed && <UpgradeCard gate={gate} />}

      {phase === "after" && gate.allowed && (
        <SectionCard title="Taking it off">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {day.after.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </SectionCard>
      )}

      {phase === "recovery" && gate.allowed && (
        <SectionCard title="The night after">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {day.recovery.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </SectionCard>
      )}

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex min-h-[44px] items-center text-sm font-semibold text-primary hover:underline"
      >
        Change my answers
      </button>
      <p className="text-xs text-muted-foreground">
        Cosmetic guidance from wellness indicators. Patch-test new products, and see a clinician for
        any skin condition.
      </p>
    </div>
  );
};
