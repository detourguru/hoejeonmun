import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CASTING_BOARD_BUCKET } from "@/type/casting";

export const UPLOAD_BANNED_MESSAGE =
  "업로드가 제한된 계정이에요. 운영자에게 문의해 주세요.";

export async function isUploadBanned(userId: string) {
  const { data, error } = await createAdminClient()
    .from("upload_bans")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

// Each queue row is deleted only after Storage confirms success. Retrying is safe.
export async function retryUploadStorageCleanup(moderationId?: number) {
  const admin = createAdminClient();
  let query = admin
    .from("upload_storage_cleanup")
    .select("id, storage_paths, attempts")
    .order("id")
    .limit(50);
  if (moderationId !== undefined)
    query = query.eq("moderation_id", moderationId);
  const { data, error } = await query;
  if (error) throw error;
  let failed = 0;
  for (const row of data ?? []) {
    const { error: storageError } = await admin.storage
      .from(CASTING_BOARD_BUCKET)
      .remove(row.storage_paths);
    const result = storageError
      ? await admin
          .from("upload_storage_cleanup")
          .update({
            attempts: row.attempts + 1,
            last_error: storageError.message,
          })
          .eq("id", row.id)
      : await admin.from("upload_storage_cleanup").delete().eq("id", row.id);
    if (storageError || result.error) failed++;
  }
  return { checked: data?.length ?? 0, failed };
}
