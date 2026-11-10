"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { getActionAuth } from "@/service/action-auth";
import { getIsAdmin } from "@/service/admin";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";
import { retryUploadStorageCleanup } from "@/service/upload-moderation";

const idSchema = z.number().int().positive();
const requestSchema = z.object({
  uploadId: idSchema,
  allUploads: z.boolean(),
  ban: z.boolean(),
  reason: z.string().trim().min(1).max(1000),
  expectedIds: z.array(idSchema).min(1),
});

async function requireAdmin() {
  const { supabase, userId } = await getActionAuth();
  if (!userId || !(await getIsAdmin(supabase)))
    throw new Error("운영자만 실행할 수 있어요.");
  return userId;
}

export async function previewUploadModeration(
  uploadId: number,
  allUploads: boolean,
) {
  await requireAdmin();
  if (!idSchema.safeParse(uploadId).success || typeof allUploads !== "boolean")
    throw new Error("잘못된 요청이에요.");
  const admin = createAdminClient();
  const { data: target, error } = await admin
    .from("uploads")
    .select("user_id")
    .eq("id", uploadId)
    .single();
  if (error || !target) throw new Error("업로드를 찾지 못했어요.");
  let query = admin
    .from("uploads")
    .select("id, show_id, show_title")
    .eq("user_id", target.user_id)
    .order("id");
  if (!allUploads) query = query.eq("id", uploadId);
  const { data: uploads, error: listError } = await query;
  if (listError) throw listError;
  return {
    userId: target.user_id as string,
    uploads: (uploads ?? []) as {
      id: number;
      show_id: string;
      show_title: string;
    }[],
  };
}

export async function moderateUpload(input: z.infer<typeof requestSchema>) {
  try {
    const userId = await requireAdmin();
    const parsed = requestSchema.safeParse(input);
    if (!parsed.success)
      return {
        ok: false as const,
        message: "조치 사유와 삭제 범위를 확인해 주세요.",
      };
    const { uploadId, allUploads, ban, reason, expectedIds } = parsed.data;
    const { data, error } = await createAdminClient().rpc("moderate_upload", {
      p_moderator_id: userId,
      p_upload_id: uploadId,
      p_all: allUploads,
      p_ban: ban,
      p_reason: reason,
      p_expected_ids: expectedIds,
    });
    if (error) {
      console.error(error);
      return {
        ok: false as const,
        message: error.message.includes("preview_changed")
          ? "대상 업로드가 변경됐어요. 범위를 다시 확인해 주세요."
          : "삭제하지 못했어요. 범위를 다시 확인해 주세요.",
      };
    }
    const result = data as { id: number; showIds: string[]; deleted: number };
    for (const showId of result.showIds) {
      revalidatePath(`/show/${showId}`);
      updateTag(showCastTag(showId));
    }
    revalidatePath("/mypage/uploads");
    revalidatePath("/mypage/moderation");
    updateTag(CASTING_FEED_CACHE_TAG);
    // DB success is independent of Storage cleanup; the durable queue remains on failure.
    try {
      await retryUploadStorageCleanup(result.id);
    } catch (error) {
      console.error(error);
    }
    return { ok: true as const, deleted: result.deleted };
  } catch (error) {
    console.error(error);
    return {
      ok: false as const,
      message: "운영자 권한과 요청 내용을 확인해 주세요.",
    };
  }
}

export async function unbanUploadUser(userId: string, reason: string) {
  const moderatorId = await requireAdmin();
  if (
    !z.string().uuid().safeParse(userId).success ||
    !z.string().trim().min(1).max(1000).safeParse(reason).success
  )
    throw new Error("대상과 사유를 확인해 주세요.");
  const { error } = await createAdminClient().rpc("unban_upload_user", {
    p_moderator_id: moderatorId,
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) throw error;
  revalidatePath("/mypage/moderation");
}

export async function retryModerationCleanup() {
  await requireAdmin();
  const result = await retryUploadStorageCleanup();
  revalidatePath("/mypage/moderation");
  return result;
}
