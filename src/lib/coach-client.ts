import { z } from "zod";

import { getSupabase } from "@/integrations/supabase/client";

import type { Finding } from "./agent/agent";

/**
 * The written coach (every plan, within its monthly allowance). Sends the question plus numbers and product names only,
 * never photos, to the `coach` edge function, which checks the plan and daily allowance itself.
 */
const replySchema = z.object({ answer: z.string().min(1).max(4000) });
const errorSchema = z.object({ error: z.string().max(300) });

export type CoachReply = { answer: string } | { error: string };

export const askCoach = async (input: {
  question: string;
  findings: readonly Finding[];
  shelf: readonly string[];
  routine: readonly string[];
}): Promise<CoachReply> => {
  const supabase = getSupabase();
  if (!supabase) return { error: "Sign in to use the written coach." };
  const { data, error } = await supabase.functions.invoke("coach", {
    body: {
      question: input.question.slice(0, 500),
      findings: input.findings.slice(0, 30).map((finding) => ({
        area: finding.area,
        label: finding.label,
        health: finding.health,
        trend: finding.trend,
        change: finding.change,
      })),
      shelf: input.shelf.slice(0, 40),
      routine: input.routine.slice(0, 40),
    },
  });
  if (error) {
    const context: unknown = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const parsed = errorSchema.safeParse(await context.json().catch(() => null));
      if (parsed.success) return parsed.data;
    }
    return { error: "The coach is unavailable right now. Your on-device agent still works." };
  }
  const parsed = replySchema.safeParse(data);
  return parsed.success ? parsed.data : { error: "The coach sent something unreadable." };
};
