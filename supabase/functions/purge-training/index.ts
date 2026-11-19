// Deletes shared training photos past their 2-year limit: the files in the private bucket, then
// their records. Called once a day by pg_cron (migration 20261119160000) with a random secret
// that lives only in Supabase Vault; any other caller is refused.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "training-photos";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("POST only", { status: 405 });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const secret = request.headers.get("x-purge-secret") ?? "";
  const { data: ok } = await admin.rpc("training_purge_secret_ok", { p_secret: secret });
  if (ok !== true) return new Response("Forbidden", { status: 403 });

  let removed = 0;
  for (let round = 0; round < 20; round += 1) {
    const { data: expired, error } = await admin
      .from("training_photos")
      .select("id, path")
      .lt("expires_at", new Date().toISOString())
      .limit(500);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    if (!expired?.length) break;
    const files = await admin.storage.from(BUCKET).remove(expired.map((row) => row.path));
    if (files.error)
      return new Response(JSON.stringify({ error: files.error.message }), { status: 500 });
    await admin
      .from("training_photos")
      .delete()
      .in(
        "id",
        expired.map((row) => row.id),
      );
    removed += expired.length;
  }
  return new Response(JSON.stringify({ removed }), {
    headers: { "Content-Type": "application/json" },
  });
});
