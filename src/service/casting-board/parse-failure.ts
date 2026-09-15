import { createAdminClient } from "@/lib/supabase/admin";
import { CASTING_BOARD_BUCKET } from "@/type/casting";

// 파싱 실패 사례
export async function logParseFailure({
  admin,
  showId,
  userId,
  storagePaths,
  type,
  reason,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  userId: string;
  storagePaths: string[];
  type: "no_table_found" | "cast_mismatch" | "show_mismatch" | "exception";
  reason?: string;
}) {
  const { error } = await admin.from("parse_failures").insert(
    storagePaths.map((storagePath) => ({
      show_id: showId,
      user_id: userId,
      storage_path: storagePath,
      type,
      reason,
    })),
  );

  if (error) console.error("parse_failures insert 실패", error);
}

export const PARSE_FAILURE_RETENTION_DAYS = 7;

export async function purgeExpiredParseFailureImages(
  admin: ReturnType<typeof createAdminClient>,
) {
  const cutoff = new Date(
    Date.now() - PARSE_FAILURE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await admin
    .from("parse_failures")
    .select("id, storage_path")
    .is("image_purged_at", null)
    .lt("created_at", cutoff);

  if (error) throw error;

  const rows = data as { id: number; storage_path: string }[];

  if (rows.length === 0) return { purged: 0 };

  const storagePaths = [
    ...new Set(rows.map(({ storage_path }) => storage_path)),
  ];

  const { error: removeError } = await admin.storage
    .from(CASTING_BOARD_BUCKET)
    .remove(storagePaths);

  if (removeError) throw removeError;

  const { error: updateError } = await admin
    .from("parse_failures")
    .update({ image_purged_at: new Date().toISOString() })
    .in(
      "id",
      rows.map(({ id }) => id),
    );

  if (updateError) throw updateError;

  return { purged: rows.length };
}
