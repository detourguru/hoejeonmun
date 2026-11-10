import { createClient } from "@supabase/supabase-js";

// The opaque bearer token is generated and encrypted in Vault. Only its hash is
// deployed. Set this value during deployment; never commit the token itself.
const TOKEN_SHA256 = "__TOKEN_SHA256__";
const COMPRESSION_UNTIL = "__COMPRESSION_UNTIL__";
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
    if (body.action === "compression_urls") {
      // One-off compression access is time bounded; remove this operation once done.
      if (
        !Number.isFinite(Date.parse(COMPRESSION_UNTIL)) ||
        Date.now() > Date.parse(COMPRESSION_UNTIL)
      )
        return new Response("Expired", { status: 403 });
      const files = body.files;
      if (!Array.isArray(files) || files.length > 30)
        throw new Error("Invalid file list");
      const signed = [];
      for (const file of files) {
        if (
          ![
            "casting-boards",
            "show-posters",
            "bug-report-images",
            "poster-thumbnails",
          ].includes(file.bucket) ||
          typeof file.path !== "string"
        )
          throw new Error("Invalid object");
        const bucket = admin.storage.from(file.bucket);
        const { data: info, error: infoError } = await bucket.info(file.path);
        if (infoError) throw infoError;
        if (Number(info.size) <= 5 * 1024 * 1024) continue;
        const read = await bucket.createSignedUrl(file.path, 1800);
        const write = await bucket.createSignedUploadUrl(file.path, {
          upsert: true,
        });
        if (read.error || write.error) throw read.error || write.error;
        signed.push({
          bucket: file.bucket,
          path: file.path,
          size: info.size,
          readUrl: read.data.signedUrl,
          writeUrl: write.data.signedUrl,
        });
      }
      return Response.json({ signed });
    }
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
