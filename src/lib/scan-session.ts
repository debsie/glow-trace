import type { BiomarkerReport } from "./cv/types";
import type { ScanCategory } from "./types";

/**
 * Guided scan sessions: the shots each area needs, what each shot is for, and how the shots
 * combine into one result. Pure, so the plan and the maths are tested.
 */

export type Overlay =
  "face" | "hand-flat" | "thumb" | "hair-lengths" | "hair-crown" | "hair-ends" | "hair-length";

export type Shot = {
  id: string;
  title: string;
  /** Short instructions, shown over the camera and in the motion guide. */
  steps: string[];
  overlay: Overlay;
  /** Front camera for selfies, back camera otherwise. */
  camera: "user" | "environment";
  /** Indicator keys this shot is trusted for; the others are ignored from it. */
  reads: string[];
};

export const SESSIONS: Record<ScanCategory, Shot[]> = {
  skin: [
    {
      id: "face",
      title: "Your face",
      steps: [
        "Face a window in daylight, no flash",
        "Hold the phone at arm's length, straight on",
        "Bare skin, hair back, glasses off",
      ],
      overlay: "face",
      camera: "user",
      reads: ["erythema", "texture", "hydration", "discoloration"],
    },
  ],
  nails: [
    {
      id: "hand",
      title: "Four fingers",
      steps: [
        "Hand flat on a plain surface, palm down",
        "Fingers slightly apart, nails bare if you can",
        "Phone straight above, about 20 cm away",
      ],
      overlay: "hand-flat",
      camera: "environment",
      reads: ["yellowness", "spots", "ridges"],
    },
    {
      id: "thumb",
      title: "Your thumb",
      steps: ["Turn your hand so the thumbnail faces the camera", "Same light, same distance"],
      overlay: "thumb",
      camera: "environment",
      reads: ["yellowness", "spots", "ridges"],
    },
  ],
  hair: [
    {
      id: "lengths",
      title: "Lengths",
      steps: [
        "Bring a section of hair over your shoulder",
        "Daylight from the side, no flash",
        "Phone about 25 cm away, hair filling the frame",
      ],
      overlay: "hair-lengths",
      camera: "environment",
      reads: ["shine", "porosity"],
    },
    {
      id: "crown",
      title: "Parting or crown",
      steps: [
        "Part your hair where it is thinnest",
        "Phone straight above, or ask someone to help",
        "Use the timer if you are on your own",
      ],
      overlay: "hair-crown",
      camera: "environment",
      reads: ["density"],
    },
    {
      id: "ends",
      title: "Ends",
      steps: [
        "Pinch the ends of a section together",
        "Hold them against white paper",
        "Phone about 15 cm away, ends in focus",
      ],
      overlay: "hair-ends",
      camera: "environment",
      reads: ["porosity"],
    },
    {
      id: "length",
      title: "Length",
      steps: [
        "Face the camera and bring your hair forward over your shoulders",
        "Prop your phone up and use the timer, or ask someone to help",
        "Head to hips in the frame",
      ],
      overlay: "hair-length",
      camera: "environment",
      // Length is measured separately (hair-length.ts), not as a 0-100 indicator.
      reads: [],
    },
  ],
};

export type ShotResult = { shotId: string; reports: BiomarkerReport[]; label?: string };

/** How the hair is worn today: decides which hair photos are taken and what is compared. */
export type HairToday = "stretched" | "natural" | "protective";

/** Protective styles hide the lengths and ends, so only the scalp photo is taken. */
export const shotsForHair = (today: HairToday): Shot[] =>
  today === "protective" ? SESSIONS.hair.filter((shot) => shot.id === "crown") : SESSIONS.hair;

/**
 * One report from many: each indicator is the mean over the shots trusted for it (and over every
 * tile within a shot, such as each nail). Unusable reports are ignored. Null if nothing scored.
 */
export const combineShots = (
  category: ScanCategory,
  shots: readonly Shot[],
  results: readonly ShotResult[],
): BiomarkerReport | null => {
  const values = new Map<string, { sum: number; n: number }>();
  const templates = new Map<string, BiomarkerReport["metrics"][number]>();
  let kernelVersion = "";
  let sharpness = 0;
  let width = 0;
  let height = 0;
  let warning: string | undefined;
  let hairGuide = false;
  let faceGuide = false;
  let filtered = false;
  let skinDetail: number | undefined;
  for (const result of results) {
    const shot = shots.find((item) => item.id === result.shotId);
    if (!shot) continue;
    for (const report of result.reports) {
      if (!report.quality.usable) continue;
      kernelVersion = report.kernelVersion;
      sharpness = Math.max(sharpness, report.quality.sharpness);
      width = Math.max(width, report.quality.width);
      height = Math.max(height, report.quality.height);
      warning ??= report.quality.warning;
      hairGuide ||= Boolean(report.quality.hairGuide);
      faceGuide ||= Boolean(report.quality.faceGuide);
      filtered ||= Boolean(report.quality.filtered);
      skinDetail ??= report.quality.skinDetail;
      for (const metric of report.metrics) {
        if (!shot.reads.includes(metric.key)) continue;
        templates.set(metric.key, metric);
        const entry = values.get(metric.key) ?? { sum: 0, n: 0 };
        values.set(metric.key, { sum: entry.sum + metric.value, n: entry.n + 1 });
      }
    }
  }
  if (values.size === 0) return null;
  const metrics = [...templates.values()].map((metric) => {
    const entry = values.get(metric.key) ?? { sum: metric.value, n: 1 };
    return { ...metric, value: Math.round((entry.sum / entry.n) * 10) / 10 };
  });
  return {
    kernelVersion,
    category,
    quality: {
      width,
      height,
      sharpness,
      usable: true,
      ...(warning ? { warning } : {}),
      ...(faceGuide ? { faceGuide } : {}),
      ...(hairGuide ? { hairGuide } : {}),
      ...(filtered ? { filtered } : {}),
      ...(skinDetail !== undefined ? { skinDetail } : {}),
    },
    metrics,
  };
};
