import { faceAreaMasks, faceFeatureMask, faceSkinMask } from "./face-mask";
import type { FaceAreas } from "./face-mask";
import type { FaceRegions } from "./face-mask";
import { nailBoxes } from "./nail-tiles";
import type { Point, TileBox } from "./nail-tiles";
import type { SubjectMeasure } from "./subject-check";

/**
 * On-device guides (browser only), all MediaPipe (Apache-2.0) served from this site:
 * face (skin mask), hand (nail tiles) and hair (hair mask). The shared runtime (about 15 MB)
 * downloads once; each model is fetched the first time its area is scanned. The service worker
 * keeps them. Nothing found here is stored or sent anywhere.
 */

const WASM_PATH = "/mediapipe/wasm";
const RUNTIME_MB = 15;

/** Approximate first-time download per area, including the shared runtime. */
export const GUIDE_DOWNLOAD_MB = {
  skin: RUNTIME_MB + 4,
  nails: RUNTIME_MB + 8,
  hair: RUNTIME_MB + 1,
};

type Vision = typeof import("@mediapipe/tasks-vision");
let vision: Promise<{
  lib: Vision;
  files: Awaited<ReturnType<Vision["FilesetResolver"]["forVisionTasks"]>>;
}> | null = null;

const loadVision = () => {
  vision ??= import("@mediapipe/tasks-vision").then(async (lib) => ({
    lib,
    files: await lib.FilesetResolver.forVisionTasks(WASM_PATH),
  }));
  vision.catch(() => {
    vision = null;
  });
  return vision;
};

const once = <T>(make: () => Promise<T>) => {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= make();
    pending.catch(() => {
      pending = null;
    });
    return pending;
  };
};

const faceModel = once(async () => {
  const { lib, files } = await loadVision();
  const instance = await lib.FaceLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  const F = lib.FaceLandmarker;
  const regions: FaceRegions = {
    oval: F.FACE_LANDMARKS_FACE_OVAL,
    exclude: [
      F.FACE_LANDMARKS_LEFT_EYE,
      F.FACE_LANDMARKS_RIGHT_EYE,
      F.FACE_LANDMARKS_LEFT_EYEBROW,
      F.FACE_LANDMARKS_RIGHT_EYEBROW,
      F.FACE_LANDMARKS_LIPS,
    ],
  };
  return { instance, regions };
});

const handModel = once(async () => {
  const { lib, files } = await loadVision();
  return lib.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/hand_landmarker.task", delegate: "CPU" },
    runningMode: "IMAGE",
    numHands: 1,
  });
});

const hairModel = once(async () => {
  const { lib, files } = await loadVision();
  return lib.ImageSegmenter.createFromOptions(files, {
    baseOptions: { modelAssetPath: "/mediapipe/hair_segmenter.tflite", delegate: "CPU" },
    runningMode: "IMAGE",
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  });
});

/** Face skin mask at width x height, from a larger copy of the photo. Null if no usable face. */
export const findFaceMask = async (
  detectOn: ImageData,
  width: number,
  height: number,
): Promise<Uint8Array | null> => {
  try {
    const { instance, regions } = await faceModel();
    const face = instance.detect(detectOn).faceLandmarks[0];
    return face ? faceSkinMask(face, regions, width, height) : null;
  } catch {
    return null;
  }
};

export type FoundFace = {
  /** Face skin mask at the given size (null if the face is too small). */
  skinAt: (width: number, height: number) => Uint8Array | null;
  /** Eyes, brows and lips at the given size. */
  featuresAt: (width: number, height: number) => Uint8Array;
  /** Nose, under-eyes and cheek reference patches at the given size. */
  areasAt: (width: number, height: number) => FaceAreas | null;
};

/** One detection, masks at any size: the analysis size and the larger filter-check size. */
export const findFace = async (detectOn: ImageData): Promise<FoundFace | null> => {
  try {
    const { instance, regions } = await faceModel();
    const face = instance.detect(detectOn).faceLandmarks[0];
    if (!face) return null;
    return {
      skinAt: (width, height) => faceSkinMask(face, regions, width, height),
      featuresAt: (width, height) => faceFeatureMask(face, regions, width, height),
      areasAt: (width, height) => faceAreaMasks(face, width, height),
    };
  } catch {
    return null;
  }
};

/** Nail boxes in the pixels of `detectOn`. Empty if no hand is found. */
export const findNails = async (detectOn: ImageData): Promise<TileBox[]> => {
  try {
    const instance = await handModel();
    const hand: Point[] | undefined = instance.detect(detectOn).landmarks[0];
    return hand ? nailBoxes(hand, detectOn.width, detectOn.height) : [];
  } catch {
    return [];
  }
};

/** Below this share of the photo, too little hair was found to read it on its own. */
export const MIN_HAIR_SHARE = 0.15;

/** Hair mask at width x height (1 = hair). Null if too little hair was found. */
export const findHairMask = async (
  detectOn: ImageData,
  width: number,
  height: number,
): Promise<Uint8Array | null> => {
  try {
    const instance = await hairModel();
    const result = instance.segment(detectOn);
    const category = result.categoryMask;
    if (!category) return null;
    const source = category.getAsUint8Array();
    const sw = category.width;
    const sh = category.height;
    const mask = new Uint8Array(width * height);
    let hair = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sx = Math.min(sw - 1, Math.floor(((x + 0.5) / width) * sw));
        const sy = Math.min(sh - 1, Math.floor(((y + 0.5) / height) * sh));
        // The hair segmenter's categories: 0 background, 1 hair.
        if ((source[sy * sw + sx] ?? 0) > 0) {
          mask[y * width + x] = 1;
          hair += 1;
        }
      }
    }
    category.close();
    return hair / mask.length >= MIN_HAIR_SHARE ? mask : null;
  } catch {
    return null;
  }
};

/**
 * For the live camera: what the guide for this area sees in a small preview frame. Null when the
 * guide could not load (the camera then works without it). Nothing is stored or sent.
 */
export const measureSubject = async (
  kind: SubjectMeasure["kind"],
  frame: ImageData,
): Promise<SubjectMeasure | null> => {
  try {
    if (kind === "face") {
      const { instance } = await faceModel();
      const face = instance.detect(frame).faceLandmarks[0];
      if (!face) return { kind, found: false, share: 0, centreX: 0.5, centreY: 0.5 };
      const xs = face.map((p) => p.x);
      const ys = face.map((p) => p.y);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      return {
        kind,
        found: true,
        share: Math.max(0, x1 - x0) * Math.max(0, y1 - y0),
        centreX: (x0 + x1) / 2,
        centreY: (y0 + y1) / 2,
      };
    }
    if (kind === "hand") {
      const instance = await handModel();
      const hand: Point[] | undefined = instance.detect(frame).landmarks[0];
      if (!hand) return { kind, found: false, fingertips: 0, thumb: false };
      const inFrame = (i: number) => {
        const p = hand[i];
        return !!p && p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98;
      };
      // Fingertip landmarks: thumb 4, then index, middle, ring and little 8, 12, 16, 20.
      return {
        kind,
        found: true,
        fingertips: [8, 12, 16, 20].filter(inFrame).length,
        thumb: inFrame(4),
      };
    }
    const instance = await hairModel();
    const category = instance.segment(frame).categoryMask;
    if (!category) return null;
    const source = category.getAsUint8Array();
    let hair = 0;
    for (const value of source) if (value > 0) hair += 1;
    category.close();
    return { kind, share: hair / Math.max(1, source.length) };
  } catch {
    return null;
  }
};
