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
});

export const biomarkerReportSchema = z.object({
  kernelVersion: z.string().min(1),
  category: z.enum(["skin", "hair", "nails"]),
  quality: imageQualitySchema,
  metrics: z.array(biomarkerMetricSchema),
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
