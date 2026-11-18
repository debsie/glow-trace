import { ArrowRight, Check, ShieldCheck, Sun, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import { GuidedCamera } from "@/components/scan/guided-camera";
import { MotionGuide } from "@/components/scan/motion-guide";
import { GhostButton, PrimaryButton, SectionCard } from "@/components/ui/bits";
import { analyseShot } from "@/lib/cv/analyse-session";
import type { NailReading, ShotAnalysis } from "@/lib/cv/analyse-session";
import { GUIDE_DOWNLOAD_MB } from "@/lib/cv/guides";
import type { BiomarkerReport } from "@/lib/cv/types";
import { combineShots, SESSIONS } from "@/lib/scan-session";
import type { ScanCategory } from "@/lib/types";

const SEEN_KEY = (area: ScanCategory) => `glowtrace.guided.${area}`;

const INTRO: Record<ScanCategory, { title: string; lead: string; needs: string[] }> = {
  skin: {
    title: "Scan your skin",
    lead: "One photo of your face in daylight. Glowtrace reads only your skin, not your eyes, lips, hair or background.",
    needs: ["A window with daylight", "Clean, bare skin", "About one minute"],
  },
  nails: {
    title: "Scan your nails",
    lead: "Two photos: four fingers, then your thumb. Glowtrace finds each nail and reads it on its own.",
    needs: ["A plain table or sheet of paper", "Daylight, no flash", "About two minutes"],
  },
  hair: {
    title: "Scan your hair",
    lead: "Three photos: your lengths, your parting or crown, and your ends. Each one shows something the others cannot.",
    needs: ["Daylight from the side", "A sheet of white paper", "About three minutes"],
  },
};

export type SessionResult = {
  report: BiomarkerReport | null;
  photo: Blob | undefined;
  nails: NailReading[];
  notes: string[];
};

type Stage =
  | { kind: "intro" }
  | { kind: "guide"; index: number }
  | { kind: "camera"; index: number }
  | { kind: "analysing" };

/** The guided scan: onboarding, a motion guide before each shot, the camera, then analysis. */
export const GuidedSession = ({
  category,
  onDone,
  onCancel,
}: {
  category: ScanCategory;
  onDone: (result: SessionResult) => void;
  onCancel: () => void;
}) => {
  const shots = SESSIONS[category];
  const [stage, setStage] = useState<Stage>({ kind: "intro" });
  const [photos, setPhotos] = useState<Blob[]>([]);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SEEN_KEY(category)) === "yes")
        setStage({ kind: "guide", index: 0 });
    } catch {
      // Show the introduction.
    }
  }, [category]);

  const finish = async (all: Blob[]) => {
    setStage({ kind: "analysing" });
    const analyses: ShotAnalysis[] = [];
    for (const [index, photo] of all.entries()) {
      const shot = shots[index];
      if (!shot) continue;
      try {
        analyses.push(await analyseShot(category, shot, photo));
      } catch {
        analyses.push({
          shotId: shot.id,
          reports: [],
          nails: [],
          note: `The ${shot.title.toLowerCase()} photo couldn't be read.`,
        });
      }
    }
    onDone({
      report: combineShots(category, shots, analyses),
      photo: all[0],
      nails: analyses.flatMap((analysis) => analysis.nails),
      notes: analyses.flatMap((analysis) => (analysis.note ? [analysis.note] : [])),
    });
  };

  if (stage.kind === "intro") {
    const intro = INTRO[category];
    return (
      <SectionCard>
        <div className="space-y-5">
          <div>
            <p className="label-tracking text-xs font-bold text-muted-foreground uppercase">
              Guided scan · {shots.length} {shots.length === 1 ? "photo" : "photos"}
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold">{intro.title}</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">{intro.lead}</p>
          </div>
          <MotionGuide overlay={shots[0]?.overlay ?? "face"} steps={shots[0]?.steps ?? []} />
          <ul className="grid gap-2 sm:grid-cols-3">
            {intro.needs.map((need, index) => {
              const Icon = [Sun, Check, Timer][index] ?? Check;
              return (
                <li
                  key={need}
                  className="flex min-h-[50px] items-center gap-3 rounded-2xl border border-border px-4 text-sm"
                >
                  <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  {need}
                </li>
              );
            })}
          </ul>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            Photos are read on this phone and never uploaded. The first guided {category} scan
            downloads about {GUIDE_DOWNLOAD_MB[category]} MB once, so Wi-Fi is best.
          </p>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              onClick={() => {
                try {
                  window.localStorage.setItem(SEEN_KEY(category), "yes");
                } catch {
                  // Shows again next time.
                }
                setStage({ kind: "guide", index: 0 });
              }}
            >
              Start <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </PrimaryButton>
            <GhostButton onClick={onCancel}>Not now</GhostButton>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (stage.kind === "guide") {
    const shot = shots[stage.index];
    if (!shot) return null;
    return (
      <SectionCard>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">{shot.title}</h2>
            <span
              className="readout text-sm text-muted-foreground"
              aria-label={`Photo ${stage.index + 1} of ${shots.length}`}
            >
              {stage.index + 1} / {shots.length}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden="true">
            {shots.map((item, index) => (
              <span
                key={item.id}
                className={`h-1 flex-1 rounded-full ${index <= stage.index ? "bg-primary" : "bg-secondary"}`}
              />
            ))}
          </div>
          <MotionGuide overlay={shot.overlay} steps={shot.steps} />
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => setStage({ kind: "camera", index: stage.index })}>
              Open camera <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </PrimaryButton>
            <GhostButton onClick={onCancel}>Cancel</GhostButton>
          </div>
        </div>
      </SectionCard>
    );
  }

  if (stage.kind === "camera") {
    const shot = shots[stage.index];
    if (!shot) return null;
    return (
      <GuidedCamera
        shot={shot}
        onCancel={() => setStage({ kind: "guide", index: stage.index })}
        onCapture={(photo) => {
          const all = [...photos.slice(0, stage.index), photo];
          setPhotos(all);
          if (stage.index + 1 < shots.length) setStage({ kind: "guide", index: stage.index + 1 });
          else void finish(all);
        }}
      />
    );
  }

  return (
    <SectionCard>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Reading your {category === "nails" ? "nails" : category} on this device. The first time can
        take a little longer while the guide downloads.
      </p>
    </SectionCard>
  );
};
