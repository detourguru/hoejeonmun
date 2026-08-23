"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";

export type SlotReportType =
  "wrong_date" | "wrong_cast" | "wrong_show" | "other";
export type EventReportType = "wrong_event" | "other";

export type ReportResult =
  { ok: true; hidden: boolean } | { ok: false; message: string };

export async function reportSlot(
  showId: string,
  uploadId: number,
  slotId: number,
  type: SlotReportType,
  context?: string,
): Promise<ReportResult> {
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

  const { data: hidden } = await supabase
    .from("hidden_castings")
    .select("slot_id")
    .eq("upload_id", uploadId)
    .eq("slot_id", slotId)
    .maybeSingle();

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));

  return { ok: true, hidden: !!hidden };
}

export async function cancelReport(
  showId: string,
  uploadId: number,
  slotId: number,
): Promise<ReportResult> {
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
  updateTag(showCastTag(showId));

  return { ok: true, hidden: false };
}

export async function reportEvent(
  showId: string,
  eventId: number,
  type: EventReportType,
  context?: string,
): Promise<ReportResult> {
  if (type === "other" && !context?.trim()) {
    return { ok: false, message: "신고 사유를 입력해 주세요." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = await supabase.from("event_reports").insert({
    user_id: userId,
    event_id: eventId,
    type,
    context: context?.trim() || null,
  });

  if (error) {
    // unique(user_id, event_id) 위반
    if (error.code === "23505") {
      return { ok: false, message: "이미 신고한 이벤트예요." };
    }

    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  const { data: hidden } = await supabase
    .from("hidden_events")
    .select("event_id")
    .eq("event_id", eventId)
    .maybeSingle();

  revalidatePath(`/show/${showId}`);
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: !!hidden };
}

export async function cancelEventReport(
  showId: string,
  eventId: number,
): Promise<ReportResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const { error } = await supabase
    .from("event_reports")
    .delete()
    .eq("user_id", userId)
    .eq("event_id", eventId);

  if (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: false };
}
