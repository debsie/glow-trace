import type { Shot, ShotResult } from "../scan-session";
import type { ScanCategory } from "../types";
import { findFaceMask, findHairMask, findNails } from "./guides";
import { loadImageData, MAX_DIM, PHOTO_DIM } from "./image";
import { analyzeBiomarkers } from "./kernel";
import { cropTile } from "./nail-tiles";
import type { Finger } from "./nail-tiles";
import { parseBiomarkerReport } from "./schemas";
import type { BiomarkerReport } from "./types";

/** Nails are small, so they are found on a larger copy of the photo. */
const NAIL_DETECT_DIM = 1280;
const NAIL_TILE_PX = 128;

export type NailReading = { finger: Finger; report: BiomarkerReport };
export type ShotAnalysis = ShotResult & {
  nails: NailReading[];
  /** Plain note for the result screen, e.g. that no hand was found. */
  note?: string;
};

/** Reads one guided shot on the device. Throws only if the photo cannot be decoded at all. */
export const analyseShot = async (
  category: ScanCategory,
  shot: Shot,
  photo: Blob,
): Promise<ShotAnalysis> => {
  const pixels = await loadImageData(photo, MAX_DIM);
  if (category === "nails") {
    const large = await loadImageData(photo, NAIL_DETECT_DIM);
    const boxes = await findNails(large);
    if (boxes.length === 0) {
      return {
        shotId: shot.id,
        reports: [parseBiomarkerReport(analyzeBiomarkers("nails", pixels))],
        nails: [],
        note: "No hand found, so the whole photo was read. Lay your hand flat and try again for per-nail results.",
      };
    }
    const nails = boxes.map((box) => ({
      finger: box.finger,
      report: parseBiomarkerReport(analyzeBiomarkers("nails", cropTile(large, box, NAIL_TILE_PX))),
    }));
    // The thumb shot is for the thumb; the flat-hand shot for the other four.
    const wanted = nails.filter((nail) => (shot.id === "thumb") === (nail.finger === "thumb"));
    const kept = wanted.length > 0 ? wanted : nails;
    return { shotId: shot.id, reports: kept.map((nail) => nail.report), nails: kept };
  }
  const large = await loadImageData(photo, PHOTO_DIM);
  const mask =
    category === "skin"
      ? await findFaceMask(large, pixels.width, pixels.height)
      : await findHairMask(large, pixels.width, pixels.height);
  const note = mask
    ? undefined
    : category === "skin"
      ? "No face found, so the whole photo was read."
      : "Not enough hair found, so the whole photo was read.";
  return {
    shotId: shot.id,
    reports: [parseBiomarkerReport(analyzeBiomarkers(category, pixels, mask))],
    nails: [],
    ...(note ? { note } : {}),
  };
};
