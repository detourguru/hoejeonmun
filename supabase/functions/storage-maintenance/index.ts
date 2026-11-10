import { createClient } from "@supabase/supabase-js";

// Public SHA-256 of the random bearer token encrypted in Vault.
// Rotate the Vault token and redeploy this hash together; never commit the token.
const TOKEN_SHA256 =
  "f20835ed4b48d70a6c5b458d86eb8b259efb7d1817a526308be2a1741ba7a311";
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

Deno.serve(async (request: Request) => {
  if (request.method !== "POST")
    return new Response("Method not allowed", { status: 405 });
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== TOKEN_SHA256)
    return new Response("Unauthorized", { status: 401 });
  try {
    const body = await request.json();
    if (body.action !== "cleanup" && body.action !== "preview")
      return new Response("Invalid action", { status: 400 });
    const { data, error } = await admin.rpc("storage_cleanup_candidates", {
      p_limit: 1000,
    });
    if (error) throw error;
    const candidates = data as {
      bucket_id: string;
      name: string;
      bytes: number;
    }[];
    if (body.action === "preview") return Response.json({ candidates });
    const result: Record<string, { deleted: number; bytes: number }> = {};
    for (const bucket of [
      "casting-boards",
      "show-posters",
      "poster-thumbnails",
    ]) {
      const rows = candidates.filter((row) => row.bucket_id === bucket);
      for (let offset = 0; offset < rows.length; offset += 100) {
        const batch = rows.slice(offset, offset + 100);
        const { error: removeError } = await admin.storage
          .from(bucket)
          .remove(batch.map((row) => row.name));
        if (removeError) throw removeError;
        result[bucket] ??= { deleted: 0, bytes: 0 };
        result[bucket].deleted += batch.length;
        result[bucket].bytes += batch.reduce(
          (sum, row) => sum + Number(row.bytes),
          0,
        );
        if (bucket === "casting-boards") {
          const { error: logError } = await admin
            .from("parse_failures")
            .update({ image_purged_at: new Date().toISOString() })
            .in(
              "storage_path",
              batch.map((row) => row.name),
            )
            .is("image_purged_at", null);
          if (logError) throw logError;
        }
      }
    }
    console.log(JSON.stringify({ action: "storage_cleanup", result }));
    return Response.json({ result });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
