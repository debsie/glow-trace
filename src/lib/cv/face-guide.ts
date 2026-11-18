/**
 * The face-guide setting. The detectors live in guides.ts; this keeps the person's choice.
 */
export { findFaceMask } from "./guides";

export const FACE_GUIDE_KEY = "glowtrace.faceGuide";
export const FACE_GUIDE_DOWNLOAD_MB = 18;

export const faceGuideEnabled = (): boolean => {
  try {
    return window.localStorage.getItem(FACE_GUIDE_KEY) === "on";
  } catch {
    return false;
  }
};

export const setFaceGuide = (on: boolean): void => {
  try {
    window.localStorage.setItem(FACE_GUIDE_KEY, on ? "on" : "off");
  } catch {
    // Not saved: applies to this visit only.
  }
};
