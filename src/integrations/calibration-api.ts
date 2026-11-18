import { calibrationSampleSchema } from "@/lib/calibration";
import type { CalibrationRow, CalibrationSample } from "@/lib/calibration";

import { getSupabase } from "./supabase/client";

/**
 * Calibration contributions: numbers only, never photos. Row-level security decides who can
 * add, read or delete rows; nothing here is trusted on its own.
 */

export type CalibrationResult<T = undefined> =
  { ok: true; data: T } | { ok: false; reason: string };

export const calibrationAvailable = (): boolean => getSupabase() !== null;

export const submitContribution = async (
  sample: CalibrationSample,
): Promise<CalibrationResult<string>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, reason: "Sharing needs a connected account." };
  const checked = calibrationSampleSchema.safeParse(sample);
  if (!checked.success) return { ok: false, reason: "Those answers couldn't be checked." };
  const { data, error } = await supabase
    .from("calibration_samples")
    .insert(checked.data)
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      reason: /limit/i.test(error?.message ?? "")
        ? "You've reached today's limit for sharing. Try again tomorrow."
        : "Couldn't share that. Try again.",
    };
  }
  return { ok: true, data: String(data.id) };
};

export const myContributionCount = async (): Promise<CalibrationResult<number>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: 0 };
  const { count, error } = await supabase
    .from("calibration_samples")
    .select("id", { count: "exact", head: true });
  return error ? { ok: false, reason: "Couldn't check." } : { ok: true, data: count ?? 0 };
};

export const deleteMyContributions = async (): Promise<CalibrationResult> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: undefined };
  const { error } = await supabase.from("calibration_samples").delete().not("id", "is", null);
  return error
    ? { ok: false, reason: "Couldn't delete them. Try again." }
    : { ok: true, data: undefined };
};

/** Admins only: row-level security returns nothing to anyone else. */
export const loadContributions = async (): Promise<CalibrationResult<CalibrationRow[]>> => {
  const supabase = getSupabase();
  if (!supabase) return { ok: true, data: [] };
  const { data, error } = await supabase
    .from("calibration_samples")
    .select("id, category, metrics, self_report, lighting, fitzpatrick, repeat_of, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return { ok: false, reason: "Couldn't load contributions." };
  return { ok: true, data: (data ?? []) as CalibrationRow[] };
};
