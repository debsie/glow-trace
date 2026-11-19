import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { PrimaryButton, SectionCard } from "@/components/ui/bits";
import { getSupabase } from "@/integrations/supabase/client";
import { longDate } from "@/lib/progress";

const rowSchema = z.array(
  z.object({ email: z.string(), tier: z.enum(["free", "pro", "studio"]), updated_at: z.string() }),
);
type Row = z.infer<typeof rowSchema>[number];
const TIERS = ["free", "pro", "studio"] as const;
const TIER_LABEL = { free: "Free", pro: "Pro", studio: "Studio" } as const;

/** Admins set a member's plan by email until billing does it (admin_set_plan checks admin). */
export const PlansPanel = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [email, setEmail] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]>("pro");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return setRows([]);
    const { data } = await supabase.rpc("admin_list_plans");
    const parsed = rowSchema.safeParse(data);
    setRows(parsed.success ? parsed.data : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const supabase = getSupabase();
    if (!supabase || !email.trim()) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_plan", { p_email: email.trim(), p_tier: tier });
    setBusy(false);
    if (error) {
      toast.error(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    toast.success(`${email.trim()} is now on ${TIER_LABEL[tier]}.`);
    setEmail("");
    await load();
  };

  return (
    <SectionCard title="Plans">
      <form
        className="grid max-w-2xl gap-3 sm:grid-cols-[1fr_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="text-sm font-semibold">
          Member's email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base"
          />
        </label>
        <label className="text-sm font-semibold">
          Plan
          <select
            value={tier}
            onChange={(event) => setTier(event.target.value as (typeof TIERS)[number])}
            className="mt-1 min-h-[50px] w-full rounded-lg border border-border bg-card px-3 text-base"
          >
            {TIERS.map((id) => (
              <option key={id} value={id}>
                {TIER_LABEL[id]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <PrimaryButton type="submit" disabled={busy}>
            Set plan
          </PrimaryButton>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        The member must have signed in once. Pro and Studio unlock the written coach. Every change
        is in the audit log.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows === null ? (
          <li className="py-3 text-sm text-muted-foreground">Loading plans.</li>
        ) : rows.length === 0 ? (
          <li className="py-3 text-sm text-muted-foreground">No plans set yet.</li>
        ) : (
          rows.map((row) => (
            <li key={row.email} className="flex min-h-[48px] items-center justify-between gap-3">
              <span className="text-sm">{row.email}</span>
              <span className="text-sm">
                <span className="font-semibold">{TIER_LABEL[row.tier]}</span>
                <span className="ml-2 text-muted-foreground">since {longDate(row.updated_at)}</span>
              </span>
            </li>
          ))
        )}
      </ul>
    </SectionCard>
  );
};
