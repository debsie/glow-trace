import { z } from "zod";

import type { BiomarkerReport } from "./types";

export const biomarkerMetricSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.number().min(0).max(100),
  higherMeans: z.enum(["more", "better"]),
  description: z.string(),
});

export const imageQualitySchema = z.object({
  width: z.number().int().min(0),
  height: z.number().int().min(0),
  sharpness: z.number().min(0).max(100),
  usable: z.boolean(),
  notice: z.string().optional(),
  warning: z.string().optional(),
  faceGuide: z.boolean().optional(),
  hairGuide: z.boolean().optional(),
  skinDetail: z.number().min(0).optional(),
  filtered: z.boolean().optional(),
});

export const biomarkerReportSchema = z.object({
  kernelVersion: z.string().min(1),
  category: z.enum(["skin", "hair", "nails"]),
  quality: imageQualitySchema,
  metrics: z.array(biomarkerMetricSchema),
  tone: z.object({ ita: z.number().min(-90).max(90), hueAngle: z.number() }).optional(),
  zones: z
    .object({
      forehead: z.number().min(0).max(100),
      leftCheek: z.number().min(0).max(100),
      rightCheek: z.number().min(0).max(100),
      chin: z.number().min(0).max(100),
    })
    .optional(),
  face: z
    .object({
      noseRedness: z.number().min(0).max(100),
      darkCircles: z.number().min(0).max(100),
      skinType: z.enum(["oily", "combination", "balanced"]),
    })
    .optional(),
  hairLength: z
    .object({
      band: z.enum([
        "ear",
        "chin",
        "shoulder",
        "collarbone",
        "armpit",
        "bra-strap",
        "mid-back",
        "waist",
        "hip",
        "past-hip",
      ]),
      position: z.number().min(-2).max(3),
      state: z.enum(["stretched", "natural"]),
      /** The person confirmed (or corrected) the band on the result screen. */
      confirmed: z.boolean().optional(),
    })
    .optional(),
});

export class InvalidReportError extends Error {
  readonly issues: z.ZodIssue[];
  constructor(issues: z.ZodIssue[]) {
    super(`Invalid biomarker report: ${issues.map((issue) => issue.message).join("; ")}`);
    this.name = "InvalidReportError";
    this.issues = issues;
  }
}

/** Validates a report before it enters app state; throws InvalidReportError on bad data. */
export const parseBiomarkerReport = (input: unknown): BiomarkerReport => {
  const parsed = biomarkerReportSchema.safeParse(input);
  if (!parsed.success) throw new InvalidReportError(parsed.error.issues);
  return parsed.data;
};
