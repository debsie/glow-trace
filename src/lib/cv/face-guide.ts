import { faceSkinMask } from "./face-mask";
import type { FaceRegions } from "./face-mask";

/**
 * The optional face guide (browser only). Loads MediaPipe Face Landmarker (Apache-2.0) from this
 * site on first use, about 18 MB, then the browser and service worker keep it. Runs entirely on
 * the device: landmarks are used to build a skin mask for this one scan and are never stored.
 */

export const FACE_GUIDE_KEY = "glowtrace.faceGuide";
export const FACE_GUIDE_DOWNLOAD_MB = 18;

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";

type Landmarker = {
  detect: (image: ImageData) => { faceLandmarks: { x: number; y: number }[][] };
};

let landmarker: Promise<{ instance: Landmarker; regions: FaceRegions }> | null = null;

const load = () => {
  landmarker ??= import("@mediapipe/tasks-vision").then(async (vision) => {
    const files = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    const instance = await vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
      runningMode: "IMAGE",
      numFaces: 1,
    });
    const F = vision.FaceLandmarker;
    return {
      instance,
      regions: {
        oval: F.FACE_LANDMARKS_FACE_OVAL,
        exclude: [
          F.FACE_LANDMARKS_LEFT_EYE,
          F.FACE_LANDMARKS_RIGHT_EYE,
          F.FACE_LANDMARKS_LEFT_EYEBROW,
          F.FACE_LANDMARKS_RIGHT_EYEBROW,
          F.FACE_LANDMARKS_LIPS,
        ],
      },
    };
  });
  landmarker.catch(() => {
    landmarker = null;
  });
  return landmarker;
};

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

/**
 * Face skin mask at `width` x `height` (the analysis size), detected on `detectOn` (a larger copy
 * of the same photo). Null when no face is found, it is too small, or the guide fails to load.
 */
export const findFaceMask = async (
  detectOn: ImageData,
  width: number,
  height: number,
): Promise<Uint8Array | null> => {
  try {
    const { instance, regions } = await load();
    const face = instance.detect(detectOn).faceLandmarks[0];
    return face ? faceSkinMask(face, regions, width, height) : null;
  } catch {
    return null;
  }
};
