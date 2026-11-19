import type { Point } from "./face-mask";

/**
 * What the guides found, as shapes for the result overlay, in 0-1 of the photo. Kept in memory
 * for the result screen only: never stored or sent.
 */
export type DetectionShape =
  | { kind: "outline"; points: Point[]; role: "area" | "detail"; label?: string }
  | { kind: "box"; x: number; y: number; w: number; h: number; label: string }
  | { kind: "level"; y: number; label: string; role: "mark" | "end" };

export type Detections = { shapes: DetectionShape[]; caption: string };
