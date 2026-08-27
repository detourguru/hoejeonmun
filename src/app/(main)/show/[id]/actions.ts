"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";

export type SlotReportType =
  "wrong_date" | "wrong_cast" | "wrong_show" | "other";
export type EventReportType = "wrong_event" | "other";

export type ReportResult =
  { ok: true; hidden: boolean } | { ok: false; message: string };

export async function correctSlotCasting(
  showId: string,
  slotId: number,
  role: string,
  newActor: string,
): Promise<ReportResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();

  const { error: castingError, data: castingData } = await admin
    .from("current_castings")
    .select("upload_id")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (castingError) {
    console.error(castingError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!castingData)
    return { ok: false, message: "회차 정보를 찾을 수 없어요." };

  const { data: actor, error: actorError } = await admin
    .from("actors")
    .upsert([{ name: newActor }], {
      onConflict: "name",
      ignoreDuplicates: false,
    })
    .select("id")
    .single();

  if (actorError) {
    console.error(actorError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  const { error: updateError, count } = await admin
    .from("assignments")
    .update(
      { actor_name_raw: newActor, actor_id: actor.id, verified: false },
      { count: "exact" },
    )
    .eq("upload_id", castingData.upload_id)
    .eq("slot_id", slotId)
    .eq("role_name_raw", role);

  if (updateError) {
    console.error(updateError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!count) return { ok: false, message: "해당 배역을 찾을 수 없어요." };

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));

  return { ok: true, hidden: false };
}

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
