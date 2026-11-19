// Glowtrace written coach: Claude Haiku answers a question about the person's own readings.
// Every plan, within the plan's monthly spend budget and daily cap, both checked here against
// public.subscriptions and the coach counters (never trusted from the app).
// Receives numbers and product names only, never photos. Set the ANTHROPIC_API_KEY secret in
// Supabase (Edge Functions > Secrets); SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are built in.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

import {
  COACH_BUDGET_MICRO_USD_PER_MONTH,
  COACH_MODEL,
  COACH_QUESTIONS_PER_DAY,
  coachCostMicroUsd,
} from "../../../src/lib/coach-limits.ts";

// Browser origins allowed to call this (comma-separated ALLOWED_ORIGINS secret, e.g. the site's
// own domain). Not the security boundary: the signed-in user's token is.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:8080")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const finding = z.object({
  area: z.enum(["skin", "hair", "nails"]),
  label: z.string().max(60),
  health: z.number().min(0).max(100),
  trend: z.enum(["improving", "worsening", "steady", "new"]),
  change: z.number().nullable(),
});

const body = z.object({
  question: z.string().trim().min(2).max(500),
  findings: z.array(finding).max(30),
  shelf: z.array(z.string().max(80)).max(40),
  routine: z.array(z.string().max(80)).max(40),
});

const SYSTEM = `You are Glowtrace's skin, hair and nail coach for adult women in South Africa, every skin tone and hair type.
You see only the person's own wellness indicators (0-100, higher is healthier), their trend and the products on their shelf and in their routine. You never see photos.
Rules:
- Wellness guidance only. Never diagnose, never name a disease, never claim clinical accuracy. If something sounds medical (pain, bleeding, sudden hair loss, a changing mole, infection), say kindly that a doctor or dermatologist should look at it.
- Trends: "improving" or "worsening" are 95% certain; "steady" means no real change yet. Never treat one reading as a trend.
- Plain, warm, specific English. Short: at most 120 words, then one clear next step. No emoji, no exclamation marks, no jargon without a plain explanation.
- Prefer products already on their shelf. Suggest at most two new product types, by type not brand. Flag ingredient clashes.
- Never call yourself an AI. You are "Glowtrace".`;

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

const json = (status: number, data: unknown, origin: string) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors(origin) },
  });

Deno.serve(async (request) => {
  const requestOrigin = request.headers.get("Origin") ?? "";
  const origin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0]!;
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "POST only" }, origin);

  // Until the Anthropic key is added (planned for when payments start), say so without counting
  // anything; the app then answers on the device.
  if (!Deno.env.get("ANTHROPIC_API_KEY")) {
    return json(503, { error: "The written coach isn't switched on yet.", off: true }, origin);
  }

  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in to ask the coach." }, origin);
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user) return json(401, { error: "Sign in to ask the coach." }, origin);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "That question couldn't be read." }, origin);

  const { data: plan } = await admin
    .from("subscriptions")
    .select("tier")
    .eq("user_id", user.id)
    .maybeSingle();
  const tier = (plan?.tier ?? "free") as keyof typeof COACH_QUESTIONS_PER_DAY;
  const daily = COACH_QUESTIONS_PER_DAY[tier] ?? COACH_QUESTIONS_PER_DAY.free;
  const budget = COACH_BUDGET_MICRO_USD_PER_MONTH[tier] ?? COACH_BUDGET_MICRO_USD_PER_MONTH.free;
  const { data: gate, error: gateError } = await admin.rpc("coach_begin", {
    p_user: user.id,
    p_daily: daily,
    p_budget: budget,
  });
  if (gateError) return json(500, { error: "The coach is unavailable right now." }, origin);
  if (gate === "daily") {
    return json(429, { error: `That's today's ${daily} questions. Ask again tomorrow.` }, origin);
  }
  if (gate === "budget") {
    return json(
      429,
      {
        error:
          tier === "free"
            ? "You've used this month's free coach questions. They come back on the 1st, and Pro gives you many more."
            : "You've used this month's coach allowance. It resets on the 1st.",
      },
      origin,
    );
  }

  const { question, findings, shelf, routine } = parsed.data;
  const context = [
    "Indicators (latest scan of each area):",
    ...findings.map(
      (f) =>
        `- ${f.area} / ${f.label}: health ${f.health.toFixed(1)}, trend ${f.trend}${f.change === null ? "" : ` (${f.change > 0 ? "+" : ""}${f.change.toFixed(1)})`}`,
    ),
    `Shelf: ${shelf.join(", ") || "nothing yet"}`,
    `Routine: ${routine.join(", ") || "not set"}`,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const response = await client.messages.create({
      model: COACH_MODEL,
      max_tokens: 2000,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      // Short coaching answers: low effort keeps them quick and cheap.
      output_config: { effort: "low" },
      messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
    });
    await admin.rpc("coach_record_spend", {
      p_user: user.id,
      p_micro_usd: coachCostMicroUsd(response.usage),
    });
    if (response.stop_reason === "refusal") {
      return json(
        200,
        { answer: "That's one for a doctor or dermatologist rather than Glowtrace." },
        origin,
      );
    }
    const answer = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .replace(/!/g, ".")
      .trim();
    return json(200, { answer }, origin);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json(503, { error: "Lots of questions right now. Try again in a minute." }, origin);
    }
    return json(502, { error: "The coach is unavailable right now." }, origin);
  }
});
