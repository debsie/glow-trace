import type { ScanCategory } from "../types";

/**
 * What the live camera found, from the on-device guides. All shares are of the preview frame.
 * `found: false` means the guide looked and saw nothing; null fields mean it could not tell.
 */
export type SubjectMeasure =
  | { kind: "face"; found: boolean; share: number; centreX: number; centreY: number }
  | { kind: "hand"; found: boolean; fingertips: number; thumb: boolean }
  | { kind: "hair"; share: number };

export const FACE_MIN_SHARE = 0.12;
export const FACE_MAX_SHARE = 0.6;
const FACE_OFF_CENTRE = 0.18;
export const HAIR_MIN_SHARE = 0.25;

/**
 * One plain hint until the right subject is in frame; undefined when it is. The shutter waits
 * for this the same way it waits for light and focus.
 */
export const subjectHint = (shotId: string, measure: SubjectMeasure): string | undefined => {
  if (measure.kind === "face") {
    if (!measure.found) return "Bring your face into the frame";
    if (measure.share < FACE_MIN_SHARE) return "Move a little closer";
    if (measure.share > FACE_MAX_SHARE) return "Move back a little so your whole face fits";
    if (
      Math.abs(measure.centreX - 0.5) > FACE_OFF_CENTRE ||
      Math.abs(measure.centreY - 0.5) > FACE_OFF_CENTRE
    ) {
      return "Centre your face in the outline";
    }
    return undefined;
  }
  if (measure.kind === "hand") {
    if (!measure.found) return "Show your hand to the camera";
    if (shotId === "thumb") return measure.thumb ? undefined : "Turn your thumb nail to the camera";
    return measure.fingertips >= 4 ? undefined : "Spread your fingers so every nail shows";
  }
  if (measure.share < HAIR_MIN_SHARE) {
    return shotId === "crown"
      ? "Tilt your head so the crown fills the frame"
      : "Fill the frame with your hair";
  }
  return undefined;
};

export const subjectKind = (category: ScanCategory): SubjectMeasure["kind"] =>
  category === "skin" ? "face" : category === "nails" ? "hand" : "hair";
