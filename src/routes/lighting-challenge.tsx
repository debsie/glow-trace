import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Check, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";

import { LineArt } from "@/components/art/line-art";
import type { Motif } from "@/components/art/line-art";
import { TrainingConsent } from "@/components/privacy/training-consent";
import { Reveal } from "@/components/motion/reveal";
import { BUTTON_GHOST, BUTTON_PRIMARY } from "@/components/ui/bits";
import { useAuth } from "@/context/auth";
import { centreLook } from "@/lib/cv/consistency";
import { loadImageData } from "@/lib/cv/image";
import { pageHead } from "@/lib/seo";
import type { Lighting } from "@/lib/training-share";
import { shareTrainingPhoto, trainingStatus } from "@/lib/training-share";

export const Route = createFileRoute("/lighting-challenge")({
  head: () =>
    pageHead({
      title: "Lighting challenge — Glowtrace",
      description:
        "Three selfies in three lights, to help Glowtrace read every skin tone in any light.",
      path: "/lighting-challenge",
      noindex: true,
    }),
  component: LightingChallenge,
});

type Step = { id: Lighting; title: string; how: string; motif: Motif };

const STEPS: Step[] = [
  {
    id: "daylight",
    title: "By a window",
    how: "Daytime, facing a window, no lamps on. Light on your face, not behind you.",
    motif: "sun",
  },
  {
    id: "indoor",
    title: "Indoor light",
    how: "Your bathroom or room light switched on, the way you usually get ready.",
    motif: "drop",
  },
  {
    id: "dim",
    title: "Dim evening light",
    how: "One small lamp or the lights turned low. Darker than you'd normally take a selfie.",
    motif: "eye",
  },
];

const DONE_KEY = "glowtrace:lighting-challenge:v1";

type Shot = { blob: Blob; url: string; luma: number };

function LightingChallenge() {
  const { access } = useAuth();
  const member = access.kind === "member";
  const [consented, setConsented] = useState<boolean | null>(null);
  const [shots, setShots] = useState<Partial<Record<Lighting, Shot>>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [doneBefore, setDoneBefore] = useState(false);

  useEffect(() => {
    if (member) void trainingStatus().then((s) => setConsented(s?.consented ?? false));
    try {
      setDoneBefore(Boolean(window.localStorage.getItem(DONE_KEY)));
    } catch {
      // Unknown; show the challenge as new.
    }
  }, [member]);

  useEffect(
    () => () => {
      for (const shot of Object.values(shots)) if (shot) URL.revokeObjectURL(shot.url);
    },
    // Only on leaving the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const take = async (id: Lighting, file: File | undefined) => {
    if (!file) return;
    const previous = shots[id];
    if (previous) URL.revokeObjectURL(previous.url);
    let luma = 128;
    try {
      luma = centreLook(await loadImageData(file, 256)).luma;
    } catch {
      // Unreadable here; the server keeps only what decodes anyway.
    }
    setShots((current) => ({
      ...current,
      [id]: { blob: file, url: URL.createObjectURL(file), luma },
    }));
    setState("idle");
  };

  // A second round minutes later, in the same three spots, gives same-person repeats: how much
  // readings move on their own (research/vision/lighting_sets.cjs).
  const again = () => {
    for (const shot of Object.values(shots)) if (shot) URL.revokeObjectURL(shot.url);
    setShots({});
    setState("idle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const ready = STEPS.every((step) => shots[step.id]);
  const dim = shots.dim;
  const brightest = Math.max(shots.daylight?.luma ?? 0, shots.indoor?.luma ?? 0);
  const dimTooBright = dim !== undefined && brightest > 0 && dim.luma > brightest * 0.8;

  const share = async () => {
    setState("sending");
    const setId = crypto.randomUUID();
    let ok = true;
    for (const step of STEPS) {
      const shot = shots[step.id];
      if (!shot) continue;
      ok = (await shareTrainingPhoto(shot.blob, null, { lighting: step.id, setId })) && ok;
    }
    setState(ok ? "sent" : "failed");
    if (ok) {
      try {
        window.localStorage.setItem(DONE_KEY, new Date().toISOString());
      } catch {
        // Fine.
      }
    }
  };

  return (
    <div className="space-y-10">
      <section className="surface-strong page-enter relative overflow-hidden p-6 sm:p-10">
        <LineArt
          motif="sun"
          className="art-draw art-orbit pointer-events-none absolute top-6 right-6 hidden h-28 w-28 opacity-80 sm:block"
        />
        <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
          Lighting challenge
        </p>
        <h1 className="mt-3 max-w-xl font-display text-5xl leading-[0.95] font-semibold sm:text-6xl">
          Three selfies, three lights
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">
          Phone light changes how skin looks, and it changes it differently on every skin tone. The
          same face in three lights teaches Glowtrace to read your skin, not the room. It takes
          about two minutes.
        </p>
        {doneBefore && (
          <p className="mt-4 text-sm font-semibold">
            You've done this before. Thank you. Another set on a different day helps just as much.
          </p>
        )}
      </section>

      {!member ? (
        <p className="text-muted-foreground">
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Sign in
          </Link>{" "}
          to take part. It's for beta members who choose to share photos for training.
        </p>
      ) : consented === false ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            First, turn on photo sharing for training. You choose every photo, and you can delete
            them all any time.
          </p>
          <TrainingConsent />
          <button
            type="button"
            onClick={() => void trainingStatus().then((s) => setConsented(s?.consented ?? false))}
            className="text-sm font-semibold text-primary hover:underline"
          >
            I've turned it on
          </button>
        </div>
      ) : (
        <>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => {
              const shot = shots[step.id];
              return (
                <Reveal
                  as="li"
                  key={step.id}
                  delay={index * 90}
                  className="surface flex flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="readout text-sm text-muted-foreground">{index + 1} of 3</p>
                      <h2 className="mt-1 font-display text-2xl font-semibold">{step.title}</h2>
                    </div>
                    <LineArt motif={step.motif} className="art-draw h-12 w-12 shrink-0" />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{step.how}</p>
                  <div className="relative mt-4 aspect-[3/4] overflow-hidden rounded-2xl bg-secondary">
                    {shot ? (
                      <img
                        src={shot.url}
                        alt={`Your ${step.title.toLowerCase()} selfie`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No photo yet
                      </span>
                    )}
                    {shot && (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-background/85 px-3 py-1 text-xs font-semibold">
                        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> Taken
                      </span>
                    )}
                  </div>
                  {step.id === "dim" && dimTooBright && (
                    <p className="mt-3 text-sm text-warning" role="status">
                      This looks about as bright as your other photos. Turn the lights lower and
                      take it again.
                    </p>
                  )}
                  <label
                    className={`mt-4 inline-flex min-h-[50px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-border px-4 font-semibold hover:bg-secondary ${state === "sending" ? "pointer-events-none opacity-50" : ""}`}
                  >
                    {shot ? (
                      <RotateCcw className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Camera className="h-5 w-5" aria-hidden="true" />
                    )}
                    {shot ? "Take again" : "Take this selfie"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="user"
                      className="sr-only"
                      onChange={(event) => {
                        void take(step.id, event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </Reveal>
              );
            })}
          </ol>

          <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-xl font-semibold" aria-live="polite">
                {state === "sent"
                  ? "Shared. Thank you for helping Glowtrace see every skin in every light."
                  : state === "failed"
                    ? "Something didn't send. Your photos are still on this phone; try again."
                    : ready
                      ? "All three taken"
                      : `${STEPS.filter((s) => shots[s.id]).length} of 3 taken`}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Same face, no filters or beauty mode, no one else in the photo. Each photo is saved
                as a new JPEG without location or camera details, kept for at most two years, and
                deleted if you stop sharing.
              </p>
            </div>
            {state === "sent" && (
              <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                <p className="text-sm text-muted-foreground sm:max-w-xs sm:text-right">
                  A second round in about five minutes, in the same three spots, shows how much
                  readings move on their own. It helps as much as the first.
                </p>
                <button type="button" onClick={again} className={`${BUTTON_GHOST} shrink-0`}>
                  Take a second round
                </button>
              </div>
            )}
            {state !== "sent" && (
              <button
                type="button"
                disabled={!ready || state === "sending" || dimTooBright}
                onClick={() => void share()}
                className={`${BUTTON_PRIMARY} shrink-0 disabled:opacity-50`}
              >
                {state === "sending" ? "Sharing" : "Share all three"}
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
