/**
 * Hair length from a front photo with the hair brought forward over the shoulders (how most women
 * check it in a mirror): where the hair ends against the body, in the bands women already use.
 * Back photos are not used: the pose model finds people by their face first, so it misses them. Pure, so it is tested; the pose and hair masks come from
 * the on-device guides. Positions are in "torso units": 0 at the shoulders, 1 at the hips.
 */

export type LengthBand =
  | "ear"
  | "chin"
  | "shoulder"
  | "collarbone"
  | "armpit"
  | "bra-strap"
  | "mid-back"
  | "waist"
  | "hip"
  | "past-hip";

export const BAND_LABEL: Record<LengthBand, string> = {
  ear: "Ear length",
  chin: "Chin length",
  shoulder: "Shoulder length",
  collarbone: "Collarbone length",
  armpit: "Armpit length (APL)",
  "bra-strap": "Bra strap length (BSL)",
  "mid-back": "Mid-back length",
  waist: "Waist length",
  hip: "Hip length",
  "past-hip": "Past your hips",
};

/** Lower edge of each band in torso units (shoulders 0, hips 1). Above 0 uses ear and chin. */
const BANDS: [LengthBand, number][] = [
  ["shoulder", 0.06],
  ["collarbone", 0.16],
  ["armpit", 0.3],
  ["bra-strap", 0.45],
  ["mid-back", 0.62],
  ["waist", 0.85],
  ["hip", 1.08],
];

/** Average adult shoulder-to-hip height, for a rough centimetre figure (provisional). */
export const TORSO_CM = 48;

export type BodyMarks = { ear: number; chin: number; shoulders: number; hips: number };

/** Hair end position in torso units, or null when the body marks are not in a sensible order. */
export const lengthPosition = (hairEnd: number, marks: BodyMarks): number | null => {
  const torso = marks.hips - marks.shoulders;
  if (!(marks.ear < marks.chin && marks.chin < marks.shoulders && torso > 0)) return null;
  return (hairEnd - marks.shoulders) / torso;
};

export const bandFor = (position: number, marks: BodyMarks): LengthBand => {
  if (position < 0) {
    const chinAt = (marks.chin - marks.shoulders) / (marks.hips - marks.shoulders);
    return position < chinAt ? "ear" : "chin";
  }
  for (const [band, below] of BANDS) if (position < below) return band;
  return "past-hip";
};

/**
 * Where the hair ends: the lowest row in which hair covers at least `minShare` of a column
 * `halfWidth` (0-1 of the photo) either side of `centreX`, stopping at a gap of more than 5% of the
 * photo so a stray strand lower down is ignored. Mask is 1 = hair.
 */
export const hairEndRow = (
  mask: Uint8Array,
  width: number,
  height: number,
  centreX: number,
  minShare = 0.2,
  halfWidth = 0.12,
): number | null => {
  const half = Math.max(2, Math.round(width * halfWidth));
  const from = Math.max(0, Math.round(centreX * width) - half);
  const to = Math.min(width, Math.round(centreX * width) + half);
  let last: number | null = null;
  let gap = 0;
  for (let y = 0; y < height; y += 1) {
    let hair = 0;
    for (let x = from; x < to; x += 1) hair += mask[y * width + x] ?? 0;
    if (hair / Math.max(1, to - from) >= minShare) {
      last = y;
      gap = 0;
    } else if (last !== null && (gap += 1) > height * 0.05) {
      break;
    }
  }
  return last === null ? null : (last + 1) / height;
};

export type LengthReading = {
  band: LengthBand;
  /** Torso units; the trend uses this, not the band. */
  position: number;
  state: "stretched" | "natural";
};

/** Growth between two readings of the same state, in rough centimetres per month. */
export const growthPerMonth = (
  earlier: { at: string; reading: LengthReading },
  later: { at: string; reading: LengthReading },
): number | null => {
  if (earlier.reading.state !== later.reading.state) return null;
  const months =
    (new Date(later.at).getTime() - new Date(earlier.at).getTime()) / (30.44 * 24 * 3600 * 1000);
  if (months < 0.5) return null;
  return ((later.reading.position - earlier.reading.position) * TORSO_CM) / months;
};
