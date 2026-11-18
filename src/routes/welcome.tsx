import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { useState } from "react";

import { MotionGuide } from "@/components/scan/motion-guide";
import { LogoMark, PrimaryButton } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { DEFAULT_PROFILE, loadProfile, saveProfile } from "@/lib/makeup-day";
import type { MakeupProfile } from "@/lib/makeup-day";
import { firstScanArea, onboardingSteps, saveOnboarding } from "@/lib/onboarding";
import type { Goal, Onboarding } from "@/lib/onboarding";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/welcome")({
  head: () =>
    pageHead({
      title: "Welcome — Glowtrace",
      description: "Set up Glowtrace in a minute.",
      path: "/welcome",
      noindex: true,
    }),
  component: Welcome,
});

const GOALS: { id: Goal; title: string; line: string }[] = [
  { id: "skin", title: "My skin", line: "Redness, texture, dryness, even tone" },
  { id: "hair", title: "My hair", line: "Shine, frizz, ends, how full it looks" },
  { id: "nails", title: "My nails", line: "Ridges, spots, staining, each nail on its own" },
  { id: "makeup", title: "My makeup", line: "The right base, prep, and taking it all off" },
];

const HAIR: { id: NonNullable<Onboarding["hairPattern"]>; title: string; line: string }[] = [
  { id: "straight", title: "Straight", line: "Lies flat, no bend" },
  { id: "wavy", title: "Wavy", line: "Loose S-shapes" },
  { id: "curly", title: "Curly", line: "Springy spirals" },
  { id: "coily", title: "Coily", line: "Tight coils or zig-zags" },
];

const FEEL: { id: MakeupProfile["feel"]; title: string }[] = [
  { id: "oily", title: "Shiny all over" },
  { id: "combination", title: "Shiny in the T-zone" },
  { id: "normal", title: "Pretty comfortable" },
  { id: "dry", title: "Tight or flaky" },
];

const Choice = ({
  selected,
  onClick,
  title,
  line,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  line?: string;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={`flex min-h-[64px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
      selected ? "border-foreground/30 bg-secondary" : "border-border bg-card hover:bg-secondary/60"
    }`}
  >
    <span>
      <span className="block font-semibold text-foreground">{title}</span>
      {line && <span className="block text-sm text-muted-foreground">{line}</span>}
    </span>
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
        selected ? "border-transparent bg-primary text-primary-foreground" : "border-border"
      }`}
      aria-hidden="true"
    >
      {selected && <Check className="h-3.5 w-3.5" />}
    </span>
  </button>
);

function Welcome() {
  const navigate = useNavigate();
  const { profile, setWorkspace } = useAppState();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [artist, setArtist] = useState(false);
  const [feel, setFeel] = useState<MakeupProfile["feel"] | null>(null);
  const [sensitive, setSensitive] = useState<boolean | null>(null);
  const [hairPattern, setHairPattern] = useState<Onboarding["hairPattern"]>(null);
  const [hairTreated, setHairTreated] = useState<boolean | null>(null);
  const [index, setIndex] = useState(0);

  const steps = onboardingSteps(goals.length ? goals : ["skin"]);
  const step = steps[Math.min(index, steps.length - 1)] ?? "welcome";
  const firstName = profile.display_name.split(" ")[0] ?? "";

  const canContinue =
    step === "goals"
      ? goals.length > 0
      : step === "skin"
        ? feel !== null && sensitive !== null
        : step === "hair"
          ? hairPattern !== null && hairTreated !== null
          : true;

  const finish = (scanNow: boolean) => {
    const chosen = goals.length ? goals : (["skin"] as Goal[]);
    saveOnboarding({
      goals: chosen,
      artist,
      hairPattern,
      hairTreated,
      completedAt: new Date().toISOString(),
    });
    if (feel && sensitive !== null)
      saveProfile({ ...(loadProfile() ?? DEFAULT_PROFILE), feel, sensitive });
    if (artist) setWorkspace("pro");
    void navigate(
      scanNow ? { to: "/scan", search: { area: firstScanArea(chosen) } } : { to: "/app" },
    );
  };

  const toggleGoal = (goal: Goal) =>
    setGoals((current) =>
      current.includes(goal) ? current.filter((g) => g !== goal) : [...current, goal],
    );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 py-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <LogoMark />
          <span className="font-display text-lg font-semibold">Glowtrace</span>
        </span>
        {step !== "ready" && (
          <button
            type="button"
            onClick={() => finish(false)}
            className="min-h-[44px] px-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        )}
      </div>
      <div className="mt-4 flex gap-1" aria-hidden="true">
        {steps.map((name, i) => (
          <span
            key={name}
            className={`h-1 flex-1 rounded-full ${i <= index ? "bg-primary" : "bg-secondary"}`}
          />
        ))}
      </div>

      <main key={step} className="page-enter flex-1 py-10" aria-live="polite">
        {step === "welcome" && (
          <div className="space-y-8">
            <h1 className="font-display text-4xl leading-tight font-semibold">
              Hi{firstName ? ` ${firstName}` : ""}. Let's get to know your skin, hair and nails.
            </h1>
            <ul className="space-y-5">
              {[
                {
                  Icon: ShieldCheck,
                  title: "Your photos never leave your phone",
                  line: "Everything is read right here on your device. Nothing gets uploaded.",
                },
                {
                  Icon: Camera,
                  title: "Real you, no filters",
                  line: "Beauty filters hide exactly what we look for, so we ask for the honest version.",
                },
                {
                  Icon: Stethoscope,
                  title: "A coach, not a doctor",
                  line: "We track how things look and change over time. For anything worrying, see a clinician.",
                },
              ].map(({ Icon, title, line }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-muted-foreground">{line}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === "goals" && (
          <div className="space-y-6">
            <h1 className="font-display text-3xl leading-tight font-semibold">
              What would you like to look after?
            </h1>
            <p className="text-muted-foreground">
              Pick as many as you like. You can change this any time.
            </p>
            <div className="space-y-2">
              {GOALS.map((goal) => (
                <Choice
                  key={goal.id}
                  selected={goals.includes(goal.id)}
                  onClick={() => toggleGoal(goal.id)}
                  title={goal.title}
                  line={goal.line}
                />
              ))}
            </div>
            <Choice
              selected={artist}
              onClick={() => setArtist((value) => !value)}
              title="I'm a makeup artist"
              line="Opens your studio for client files, lookbooks and prep plans"
            />
          </div>
        )}

        {step === "skin" && (
          <div className="space-y-6">
            <h1 className="font-display text-3xl leading-tight font-semibold">
              By lunchtime, your skin usually feels...
            </h1>
            <div className="space-y-2">
              {FEEL.map((option) => (
                <Choice
                  key={option.id}
                  selected={feel === option.id}
                  onClick={() => setFeel(option.id)}
                  title={option.title}
                />
              ))}
            </div>
            <h2 className="pt-2 font-display text-xl font-semibold">Does it get annoyed easily?</h2>
            <p className="-mt-4 text-sm text-muted-foreground">
              Stinging, redness or bumps from new products.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Choice
                selected={sensitive === true}
                onClick={() => setSensitive(true)}
                title="Yes, often"
              />
              <Choice
                selected={sensitive === false}
                onClick={() => setSensitive(false)}
                title="Not really"
              />
            </div>
          </div>
        )}

        {step === "hair" && (
          <div className="space-y-6">
            <h1 className="font-display text-3xl leading-tight font-semibold">
              Tell us about your hair
            </h1>
            <p className="text-muted-foreground">
              Every texture is read on its own terms. Coily hair is never judged against straight
              hair.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {HAIR.map((option) => (
                <Choice
                  key={option.id}
                  selected={hairPattern === option.id}
                  onClick={() => setHairPattern(option.id)}
                  title={option.title}
                  line={option.line}
                />
              ))}
            </div>
            <h2 className="pt-2 font-display text-xl font-semibold">
              Coloured, relaxed or permed?
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <Choice
                selected={hairTreated === true}
                onClick={() => setHairTreated(true)}
                title="Yes"
              />
              <Choice
                selected={hairTreated === false}
                onClick={() => setHairTreated(false)}
                title="No, it's natural"
              />
            </div>
          </div>
        )}

        {step === "how" && (
          <div className="space-y-6">
            <h1 className="font-display text-3xl leading-tight font-semibold">How a scan works</h1>
            <p className="text-muted-foreground">
              About a minute. We'll show you exactly where to stand and tell you when the photo is
              good.
            </p>
            <MotionGuide
              overlay="face"
              steps={[
                "Find a window: daylight is your best friend",
                "Camera straight on, filters and beauty mode off",
                "Hold still for a second while we check the light",
              ]}
            />
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              Same spot, same light, each time: that's how you'll see real change, not lighting
              tricks.
            </p>
          </div>
        )}

        {step === "ready" && (
          <div className="space-y-6">
            <h1 className="font-display text-4xl leading-tight font-semibold">You're all set.</h1>
            <p className="text-lg text-muted-foreground">
              Your first scan becomes your starting line. Everything after is measured against it.
            </p>
          </div>
        )}
      </main>

      <div className="flex items-center gap-3 pb-4">
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label="Back"
            className="inline-flex h-[50px] w-[50px] items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {step === "ready" ? (
          <div className="flex flex-1 flex-wrap gap-2">
            <PrimaryButton className="flex-1" onClick={() => finish(true)}>
              Take my first scan <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </PrimaryButton>
            <button
              type="button"
              onClick={() => finish(false)}
              className="min-h-[50px] px-4 font-semibold text-muted-foreground hover:text-foreground"
            >
              Look around first
            </button>
          </div>
        ) : (
          <PrimaryButton
            className="flex-1"
            disabled={!canContinue}
            onClick={() => setIndex((i) => i + 1)}
          >
            {step === "welcome" ? "Let's go" : "Continue"}{" "}
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}
