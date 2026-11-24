import { z } from "zod";

import { KERNEL_VERSION } from "./cv/types";

import { getSupabase } from "@/integrations/supabase/client";

import type { ScanReport } from "./types";

/**
 * Optional photo sharing for training (beta testers). Never required for the beta. Photos go to a
 * private bucket only after consent, one at a time by choice; withdrawing deletes every shared
 * photo. Security is enforced by the database (see the training_photos migration).
 */
export const TRAINING_TERMS_VERSION = "2026-11-19";
const BUCKET = "training-photos";
const MAX_SIDE = 1024;

export const consentRowSchema = z.object({
  consented_at: z.string(),
  withdrawn_at: z.string().nullable(),
});

export type TrainingStatus = { consented: boolean; shared: number } | null;

export const trainingStatus = async (): Promise<TrainingStatus> => {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: session } = await supabase.auth.getSession();
  const me = session.session?.user.id;
  if (!me) return null;
  const { data } = await supabase
    .from("training_consents")
    .select("consented_at, withdrawn_at")
    .eq("user_id", me)
    .maybeSingle();
  const row = consentRowSchema.safeParse(data);
  const { count } = await supabase
    .from("training_photos")
    .select("id", { count: "exact", head: true })
    .eq("user_id", me);
  return { consented: row.success && row.data.withdrawn_at === null, shared: count ?? 0 };
};

export const giveTrainingConsent = async (): Promise<boolean> => {
  const supabase = getSupabase();
  const me = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!supabase || !me) return false;
  const { error } = await supabase.from("training_consents").upsert({
    user_id: me,
    terms_version: TRAINING_TERMS_VERSION,
    consented_at: new Date().toISOString(),
    withdrawn_at: null,
  });
  return !error;
};

/** Deletes every shared photo (files and records), then marks consent withdrawn. */
export const withdrawTrainingConsent = async (): Promise<boolean> => {
  const supabase = getSupabase();
  const me = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!supabase || !me) return false;
  const deleted = await deleteAllSharedPhotos();
  const { error } = await supabase
    .from("training_consents")
    .update({ withdrawn_at: new Date().toISOString() })
    .eq("user_id", me);
  return deleted && !error;
};

export const deleteAllSharedPhotos = async (): Promise<boolean> => {
  const supabase = getSupabase();
  const me = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!supabase || !me) return true;
  const { data: files } = await supabase.storage.from(BUCKET).list(me, { limit: 1000 });
  const paths = (files ?? []).map((file) => `${me}/${file.name}`);
  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) return false;
  }
  const { error } = await supabase.from("training_photos").delete().eq("user_id", me);
  return !error;
};

/** A fresh JPEG (no metadata such as location) no larger than MAX_SIDE. */
const reencode = async (photo: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(photo);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = Object.assign(document.createElement("canvas"), {
    width: Math.round(bitmap.width * scale),
    height: Math.round(bitmap.height * scale),
  });
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
      "image/jpeg",
      0.9,
    ),
  );
};

export type Lighting = "daylight" | "indoor" | "dim";

/**
 * Shares one photo with its readings (or none, for the lighting challenge), optionally tagged with
 * the light it was taken in and a set id joining photos taken together. The database refuses it
 * without active consent.
 */
export const shareTrainingPhoto = async (
  photo: Blob,
  report: ScanReport | null,
  extra: { lighting?: Lighting; setId?: string } = {},
): Promise<boolean> => {
  const supabase = getSupabase();
  const me = (await supabase?.auth.getSession())?.data.session?.user.id;
  if (!supabase || !me) return false;
  const path = `${me}/${crypto.randomUUID()}.jpg`;
  const jpeg = await reencode(photo);
  const upload = await supabase.storage
    .from(BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: false });
  if (upload.error) return false;
  const scores = report
    ? Object.fromEntries(report.metrics.map((metric) => [metric.key, metric.value]))
    : {};
  const { error } = await supabase.from("training_photos").insert({
    path,
    area: report?.category ?? "skin",
    kernel_version: report?.kernelVersion ?? KERNEL_VERSION,
    scores,
    ...(extra.lighting ? { lighting: extra.lighting } : {}),
    ...(extra.setId ? { set_id: extra.setId } : {}),
  });
  if (error) await supabase.storage.from(BUCKET).remove([path]);
  return !error;
};
