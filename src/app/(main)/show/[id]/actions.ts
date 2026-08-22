"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type VandalReportType = "wrong_info" | "other";

export type ReportSlotResult =
  | { ok: true }
  | { ok: false; message: string };

export async function reportSlot(
  showId: string,
  uploadId: number,
  slotId: number,
  type: VandalReportType,
  context?: string,
): Promise<ReportSlotResult> {
  if (type === "other" && !context?.trim()) {
    return { ok: false, message: "신고 사유를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = await supabase.from("vandal_reports").insert({
    user_id: userId,
    upload_id: uploadId,
    slot_id: slotId,
    type,
    context: context?.trim() || null,
  });

  if (error) {
    // unique(user_id, upload_id, slot_id) 위반
    if (error.code === "23505") {
      return { ok: false, message: "이미 신고한 회차예요." };
    }

    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/show/${showId}`);

  return { ok: true };
}

export async function cancelReport(
  showId: string,
  uploadId: number,
  slotId: number,
): Promise<ReportSlotResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = await supabase
    .from("vandal_reports")
    .delete()
    .eq("user_id", userId)
    .eq("upload_id", uploadId)
    .eq("slot_id", slotId);

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/show/${showId}`);

  return { ok: true };
}
