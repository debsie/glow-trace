import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge, SectionCard } from "@/components/ui/bits";
import { getSupabase } from "@/integrations/supabase/client";
import { longDate } from "@/lib/progress";

const BUCKET = "training-photos";
const rowSchema = z.array(
  z.object({
    id: z.string(),
    path: z.string(),
    area: z.enum(["skin", "hair", "nails"]),
    kernel_version: z.string(),
    scores: z.record(z.string(), z.number()),
    created_at: z.string(),
    expires_at: z.string(),
  }),
);
type Row = z.infer<typeof rowSchema>[number] & { url: string | null };

/**
 * Shared training photos (admins only, by row-level security). Short-lived signed links, never
 * public. Deleting removes the file and its record.
 */
export const PhotosPanel = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [area, setArea] = useState<"all" | "skin" | "hair" | "nails">("all");

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return setRows([]);
    const { data } = await supabase
      .from("training_photos")
      .select("id, path, area, kernel_version, scores, created_at, expires_at")
      .order("created_at", { ascending: false })
      .limit(120);
    const parsed = rowSchema.safeParse(data);
    const list = parsed.success ? parsed.data : [];
    const { data: signed } = list.length
      ? await supabase.storage.from(BUCKET).createSignedUrls(
          list.map((row) => row.path),
          600,
        )
      : { data: [] };
    const urls = new Map((signed ?? []).map((item) => [item.path, item.signedUrl]));
    setRows(list.map((row) => ({ ...row, url: urls.get(row.path) ?? null })));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (row: Row) => {
    const supabase = getSupabase();
    if (!supabase || !window.confirm("Delete this shared photo for good?")) return;
    const files = await supabase.storage.from(BUCKET).remove([row.path]);
    const record = await supabase.from("training_photos").delete().eq("id", row.id);
    if (files.error || record.error) toast.error("Couldn't delete it. Try again.");
    else {
      toast.success("Deleted.");
      await load();
    }
  };

  const shown = (rows ?? []).filter((row) => area === "all" || row.area === area);

  return (
    <SectionCard title="Shared photos">
      <p className="text-sm text-muted-foreground">
        Photos testers chose to share for training. Links last 10 minutes and are never public. Each
        photo is deleted automatically at its expiry date, or as soon as its owner withdraws.
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Area">
        {(["all", "skin", "hair", "nails"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={area === id}
            onClick={() => setArea(id)}
            className={`min-h-[44px] rounded-2xl border px-4 text-sm font-semibold capitalize ${
              area === id ? "border-primary bg-secondary" : "border-border"
            }`}
          >
            {id}
          </button>
        ))}
      </div>
      {rows === null ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading shared photos.</p>
      ) : shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No shared photos yet.</p>
      ) : (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((row) => (
            <li key={row.id} className="surface overflow-hidden">
              {row.url ? (
                <img
                  src={row.url}
                  alt={`Shared ${row.area} photo from ${longDate(row.created_at)}`}
                  className="aspect-square w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square bg-secondary" />
              )}
              <div className="space-y-2 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="outline">{row.area}</Badge>
                  <span className="text-xs text-muted-foreground">{longDate(row.created_at)}</span>
                </div>
                <p className="readout text-xs text-muted-foreground">
                  {Object.entries(row.scores)
                    .map(([key, value]) => `${key} ${value.toFixed(1)}`)
                    .join(" · ")}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    Expires {longDate(row.expires_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(row)}
                    className="min-h-[44px] rounded-lg px-3 text-xs font-semibold text-primary hover:bg-secondary"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};
