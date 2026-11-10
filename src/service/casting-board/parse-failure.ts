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
  type:
    | "all_filtered"
    | "no_table_found"
    | "cast_mismatch"
    | "show_mismatch"
    | "exception"
    | "timeout";
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

  // A failed parse can share an object with a later saved upload. Use the same
  // reference-aware selection as the daily orphan cleanup before removing it.
  const { data: candidates, error: candidateError } = await admin.rpc(
    "storage_cleanup_candidates",
    { p_limit: 1000 },
  );
  if (candidateError) throw candidateError;
  const safePaths = new Set(
    (candidates as { bucket_id: string; name: string }[])
      .filter(({ bucket_id }) => bucket_id === CASTING_BOARD_BUCKET)
      .map(({ name }) => name),
  );
  const removableRows = rows.filter(({ storage_path }) =>
    safePaths.has(storage_path),
  );
  const storagePaths = [
    ...new Set(removableRows.map(({ storage_path }) => storage_path)),
  ];
  if (storagePaths.length === 0) return { purged: 0 };

  const { error: removeError } = await admin.storage
    .from(CASTING_BOARD_BUCKET)
    .remove(storagePaths);

  if (removeError) throw removeError;

  const { error: updateError } = await admin
    .from("parse_failures")
    .update({ image_purged_at: new Date().toISOString() })
    .in(
      "id",
      removableRows.map(({ id }) => id),
    );

  if (updateError) throw updateError;

  return { purged: removableRows.length };
}
