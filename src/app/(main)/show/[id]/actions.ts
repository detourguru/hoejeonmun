"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";
import { computeEventSlotIds } from "@/service/casting-board";
import { CASTING_BOARD_BUCKET, EventSlotException } from "@/type/casting";

export type SlotReportType =
  "wrong_date" | "wrong_cast" | "wrong_show" | "other";
export type EventReportType = "wrong_event" | "other";

export type ReportResult =
  { ok: true; hidden: boolean } | { ok: false; message: string };

export type CorrectCastingResult =
  { ok: true; count: number } | { ok: false; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// PostgreSQL 에러 코드: unique_violation
const DUPLICATE_KEY = "23505";

export async function correctSlotCasting(
  showId: string,
  slotId: number,
  role: string,
  newRole: string,
  newActor: string,
): Promise<CorrectCastingResult> {
  const trimmedRole = newRole.trim();

  if (!trimmedRole) return { ok: false, message: "배역명을 입력해 주세요." };

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
      {
        role_name_raw: trimmedRole,
        actor_name_raw: newActor,
        actor_id: actor.id,
        verified: false,
      },
      { count: "exact" },
    )
    .eq("upload_id", castingData.upload_id)
    .eq("role_name_raw", role);

  if (updateError) {
    console.error(updateError);

    if (updateError.code === "23505") {
      return {
        ok: false,
        message:
          "이미 같은 배역명을 쓰는 회차가 있어요. 다른 이름을 입력해 주세요.",
      };
    }

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!count) return { ok: false, message: "해당 배역을 찾을 수 없어요." };

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));

  return { ok: true, count };
}

// 날짜/시간이 잘못 읽힌 회차를 이 캐스팅보드 안에서만 다른 회차로 옮긴다
export async function correctSlotDate(
  showId: string,
  slotId: number,
  newDate: string,
  newTime: string,
): Promise<ReportResult> {
  if (!ISO_DATE.test(newDate) || !TIME.test(newTime)) {
    return { ok: false, message: "날짜와 시간을 확인해 주세요." };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();

  const { data: castingData, error: castingError } = await admin
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

  const { error: upsertError } = await admin
    .from("slots")
    .upsert(
      { show_id: showId, date: newDate, time: newTime },
      { onConflict: "show_id,date,time", ignoreDuplicates: true },
    );

  if (upsertError) {
    console.error(upsertError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  const { data: newSlot, error: newSlotError } = await admin
    .from("slots")
    .select("id")
    .eq("show_id", showId)
    .eq("date", newDate)
    .eq("time", newTime)
    .single();

  if (newSlotError) {
    console.error(newSlotError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (newSlot.id === slotId) return { ok: true, hidden: false };

  const { error: moveError, count } = await admin
    .from("assignments")
    .update({ slot_id: newSlot.id }, { count: "exact" })
    .eq("upload_id", castingData.upload_id)
    .eq("slot_id", slotId);

  if (moveError) {
    console.error(moveError);

    if (moveError.code === DUPLICATE_KEY) {
      return {
        ok: false,
        message: "이미 그 날짜/시간에 같은 배역이 있어요.",
      };
    }

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!count) return { ok: false, message: "회차 정보를 찾을 수 없어요." };

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));

  return { ok: true, hidden: false };
}

// 본인이 올린 캐스팅보드에서 이 회차만 지운다. 다른 업로드가 같은 회차를
// 올려둔 게 있으면 그게 대신 보이고, 없으면 회차 자체가 사라진다
export async function deleteMySlotCasting(
  showId: string,
  uploadId: number,
  slotId: number,
): Promise<ReportResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .select("user_id")
    .eq("id", uploadId)
    .maybeSingle();

  if (uploadError) {
    console.error(uploadError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!upload || upload.user_id !== userId) {
    return { ok: false, message: "본인이 올린 회차만 지울 수 있어요." };
  }

  const { error: deleteError, count } = await admin
    .from("assignments")
    .delete({ count: "exact" })
    .eq("upload_id", uploadId)
    .eq("slot_id", slotId);

  if (deleteError) {
    console.error(deleteError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!count) return { ok: false, message: "회차 정보를 찾을 수 없어요." };

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

// 이벤트가 현재 어느 회차에 적용되고 있는지를 "기간 막대 밖 포함/기간 안 제외"
// 형태로 되돌려서 정정 시트에 미리 채워 넣는다. 이게 없으면 정정 저장 시
// 기간만으로 다시 계산해서 막대 밖 회차 연결이 지워진다
export async function getEventSlotAdjustments(
  showId: string,
  eventId: number,
  periodStart: string,
  periodEnd: string,
): Promise<{
  included: EventSlotException[];
  excluded: EventSlotException[];
}> {
  const supabase = await createClient();

  const [
    { data: links, error: linksError },
    { data: periodSlots, error: periodError },
  ] = await Promise.all([
    supabase.from("event_slots").select("slot_id").eq("event_id", eventId),
    supabase
      .from("slots")
      .select("id, date, time")
      .eq("show_id", showId)
      .gte("date", periodStart)
      .lte("date", periodEnd),
  ]);

  if (linksError) throw linksError;
  if (periodError) throw periodError;

  const linkedIds = (links as { slot_id: number }[]).map(
    ({ slot_id }) => slot_id,
  );
  const linkedIdSet = new Set(linkedIds);
  const periodRows = periodSlots as {
    id: number;
    date: string;
    time: string;
  }[];
  const periodIdSet = new Set(periodRows.map(({ id }) => id));

  const outsidePeriodIds = linkedIds.filter((id) => !periodIdSet.has(id));

  const { data: outsideSlots, error: outsideError } =
    outsidePeriodIds.length > 0
      ? await supabase
          .from("slots")
          .select("date, time")
          .in("id", outsidePeriodIds)
      : { data: [] as { date: string; time: string }[], error: null };

  if (outsideError) throw outsideError;

  return {
    included: (outsideSlots as { date: string; time: string }[]).map(
      ({ date, time }) => ({ date, time: time.slice(0, 5) }),
    ),
    excluded: periodRows
      .filter(({ id }) => !linkedIdSet.has(id))
      .map(({ date, time }) => ({ date, time: time.slice(0, 5) })),
  };
}

const sanitizeSlotExceptions = (slots: EventSlotException[]) =>
  slots.filter(({ date, time }) => ISO_DATE.test(date) && TIME.test(time));

export async function correctEventText(
  showId: string,
  eventId: number,
  title: string,
  description: string,
  periodStart: string,
  periodEnd: string,
  includedSlots: EventSlotException[],
  excludedSlots: EventSlotException[],
): Promise<ReportResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const trimmedTitle = title.trim();

  if (!trimmedTitle) return { ok: false, message: "제목을 입력해 주세요." };

  if (
    !ISO_DATE.test(periodStart) ||
    !ISO_DATE.test(periodEnd) ||
    periodStart > periodEnd
  ) {
    return { ok: false, message: "기간을 확인해 주세요." };
  }

  const admin = createAdminClient();

  const { error: updateError, count } = await admin
    .from("events")
    .update(
      {
        title: trimmedTitle,
        description: description.trim() || null,
        period_start: periodStart,
        period_end: periodEnd,
        edited_by: userId,
      },
      { count: "exact" },
    )
    .eq("id", eventId);

  if (updateError) {
    console.error(updateError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!count) return { ok: false, message: "이벤트를 찾을 수 없어요." };

  // 기간 + 막대 밖 포함/제외 회차를 반영해 적용되는 회차를 다시 계산한다
  const matchedSlotIds = await computeEventSlotIds(
    admin,
    showId,
    periodStart,
    periodEnd,
    sanitizeSlotExceptions(includedSlots),
    sanitizeSlotExceptions(excludedSlots),
  );

  const { error: deleteSlotsError } = await admin
    .from("event_slots")
    .delete()
    .eq("event_id", eventId);

  if (deleteSlotsError) console.error(deleteSlotsError);

  if (matchedSlotIds.length > 0) {
    const { error: insertSlotsError } = await admin.from("event_slots").upsert(
      matchedSlotIds.map((slotId) => ({
        event_id: eventId,
        slot_id: slotId,
      })),
      { onConflict: "event_id,slot_id", ignoreDuplicates: true },
    );

    if (insertSlotsError) console.error(insertSlotsError);
  }

  revalidatePath(`/show/${showId}`);
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: false };
}

// 본인이 올린 이벤트를 지운다 (event_slots, event_reports는 cascade로 함께 삭제)
export async function deleteMyEvent(
  showId: string,
  eventId: number,
): Promise<ReportResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();

  const { data: event, error: eventError } = await admin
    .from("events")
    .select("upload_id")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError) {
    console.error(eventError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!event) return { ok: false, message: "이벤트를 찾을 수 없어요." };

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .select("user_id")
    .eq("id", event.upload_id)
    .maybeSingle();

  if (uploadError) {
    console.error(uploadError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (!upload || upload.user_id !== userId) {
    return { ok: false, message: "본인이 올린 이벤트만 지울 수 있어요." };
  }

  const { error: deleteError } = await admin
    .from("events")
    .delete()
    .eq("id", eventId);

  if (deleteError) {
    console.error(deleteError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: false };
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

// 업로드 후 취소 시 storage에서 이미지를 삭제한다.
export async function discardUploadImages(
  storagePaths: string[],
): Promise<{ ok: boolean }> {
  if (storagePaths.length === 0) return { ok: true };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false };

  if (!storagePaths.every((path) => path.startsWith(`${userId}/`))) {
    return { ok: false };
  }

  const admin = createAdminClient();

  const { data: linked } = await admin
    .from("upload_images")
    .select("storage_path")
    .in("storage_path", storagePaths);

  const linkedPaths = new Set((linked ?? []).map((row) => row.storage_path));
  const deletable = storagePaths.filter((path) => !linkedPaths.has(path));

  if (deletable.length === 0) return { ok: true };

  const { error } = await admin.storage
    .from(CASTING_BOARD_BUCKET)
    .remove(deletable);

  if (error) {
    console.error(error);
    return { ok: false };
  }

  return { ok: true };
}
