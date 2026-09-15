import { sha256 } from "@/lib/hash";
import { createAdminClient } from "@/lib/supabase/admin";

export async function hashImages(images: Blob[]): Promise<string[]> {
  return Promise.all(
    images.map(async (image) => sha256(Buffer.from(await image.arrayBuffer()))),
  );
}

export type DuplicateReason = "reported" | "registered" | "picked_twice";

export async function findDuplicateReasons({
  admin,
  showId,
  hashes,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  hashes: string[];
}): Promise<(DuplicateReason | null)[]> {
  const { data, error } = await admin
    .from("upload_images")
    .select("image_hash, upload_id")
    .eq("show_id", showId)
    .in("image_hash", hashes);

  if (error) throw error;

  const rows = data as { image_hash: string; upload_id: number }[];
  const reportedHashes = new Set<string>();
  const savedHashes = new Set(rows.map(({ image_hash }) => image_hash));

  if (rows.length > 0) {
    const { data: hidden, error: hiddenError } = await admin
      .from("hidden_castings")
      .select("upload_id")
      .in("upload_id", [...new Set(rows.map(({ upload_id }) => upload_id))]);

    if (hiddenError) throw hiddenError;

    const hiddenUploads = new Set(
      (hidden as { upload_id: number }[]).map(({ upload_id }) => upload_id),
    );

    for (const { image_hash, upload_id } of rows) {
      if (hiddenUploads.has(upload_id)) reportedHashes.add(image_hash);
    }
  }

  const seen = new Set<string>();

  return hashes.map((hash) => {
    if (reportedHashes.has(hash)) return "reported";
    if (savedHashes.has(hash)) return "registered";
    if (seen.has(hash)) return "picked_twice";

    seen.add(hash);

    return null;
  });
}
