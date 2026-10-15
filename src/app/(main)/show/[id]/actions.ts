"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CASTING_FEED_CACHE_TAG, showCastTag } from "@/service/casting";
import { computeEventSlotIds } from "@/service/casting-board";
import { ManualCastingRole, saveManualCasting } from "@/service/manual-casting";
import {
  canManageUpload,
  getRequester,
  isCorrectionLimited,
  Requester,
} from "@/service/permission";
import {
  CASTING_BOARD_BUCKET,
  EventSlotException,
  SLOT_VARIANT_MAX_LENGTH,
} from "@/type/casting";

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

async function deleteUploadIfEmpty(
  admin: ReturnType<typeof createAdminClient>,
  uploadId: number,
  requester: Requester,
) {
  const [assignments, events, upload] = await Promise.all([
    admin
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("upload_id", uploadId),
    admin
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("upload_id", uploadId),
    admin.from("uploads").select("user_id").eq("id", uploadId).maybeSingle(),
  ]);

  // 조회 에러 시 빈 업로드로 판단하면 cascade로 전부 삭제되므로 지우지 않고 에러로만 표기한다
  if (assignments.error || events.error || upload.error) {
    console.error(
      "빈 업로드 확인 실패",
      assignments.error ?? events.error ?? upload.error,
    );
    return;
  }

  if (assignments.count !== 0 || events.count !== 0 || !upload.data) return;

  try {
    if (!(await canManageUpload(requester, upload.data.user_id))) return;
  } catch (error) {
    console.error("빈 업로드 권한 확인 실패", error);
    return;
  }

  const { error } = await admin.from("uploads").delete().eq("id", uploadId);

  if (error) console.error("빈 업로드 정리 실패", error);
}

type CorrectionStatus =
  | "ok"
  | "slot_not_found"
  | "role_not_found"
  | "duplicate"
  | "event_not_found"
  | "rate_limited";

type CorrectionResult = {
  status: CorrectionStatus;
  count?: number;
  upload_id?: number;
};

const CORRECTION_FAILURE_MESSAGE: Record<
  Exclude<CorrectionStatus, "ok">,
  string
> = {
  slot_not_found: "회차 정보를 찾을 수 없어요.",
  role_not_found: "해당 배역을 찾을 수 없어요.",
  duplicate: "이미 같은 배역·배우가 있어요.",
  event_not_found: "이벤트를 찾을 수 없어요.",
  rate_limited: "정정을 너무 자주 했어요. 잠시 후 다시 시도해 주세요.",
};

const isDuplicateKey = (error: unknown) =>
  (error as { code?: string } | null)?.code === DUPLICATE_KEY;

async function runCorrection(
  admin: ReturnType<typeof createAdminClient>,
  requester: Requester,
  name: string,
  args: Record<string, unknown>,
): Promise<CorrectionResult> {
  if (await isCorrectionLimited(admin, requester)) {
    return { status: "rate_limited" };
  }

  const { data, error } = await admin.rpc(name, {
    p_user_id: requester.userId,
    ...args,
  });

  if (error) throw error;

  return data as CorrectionResult;
}

async function upsertActorId(
  admin: ReturnType<typeof createAdminClient>,
  name: string,
): Promise<number> {
  const { data, error } = await admin
    .from("actors")
    .upsert([{ name }], { onConflict: "name", ignoreDuplicates: false })
    .select("id")
    .single();

  if (error) throw error;

  return data.id as number;
}

export async function correctSlotCasting({
  showId,
  slotId,
  role,
  oldActor,
  newRole,
  newActor,
  applyToAllSlots,
}: {
  showId: string;
  slotId: number;
  role: string;
  oldActor: string;
  newRole: string;
  newActor: string;
  applyToAllSlots: boolean;
}): Promise<CorrectCastingResult> {
  const trimmedRole = newRole.trim();
  const trimmedActor = newActor.trim();

  if (!trimmedRole) return { ok: false, message: "배역명을 입력해 주세요." };
  if (!trimmedActor) return { ok: false, message: "배우명을 입력해 주세요." };

  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();
  let result: CorrectionResult;

  try {
    result = await runCorrection(admin, requester, "correct_casting", {
      p_show_id: showId,
      p_slot_id: slotId,
      p_all_slots: applyToAllSlots,
      p_role: role,
      p_actor: oldActor,
      p_new_role: trimmedRole,
      p_new_actor: trimmedActor,
      p_new_actor_id: await upsertActorId(admin, trimmedActor),
    });
  } catch (error) {
    console.error(error);

    if (isDuplicateKey(error)) {
      return {
        ok: false,
        message:
          "이미 같은 배역명을 쓰는 회차가 있어요. 다른 이름을 입력해 주세요.",
      };
    }

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, count: result.count ?? 0 };
}

export async function addSlotCasting({
  showId,
  slotId,
  role,
  actor,
  applyToAllSlots,
}: {
  showId: string;
  slotId: number;
  role: string;
  actor: string;
  applyToAllSlots: boolean;
}): Promise<CorrectCastingResult> {
  const trimmedRole = role.trim();
  const trimmedActor = actor.trim();

  if (!trimmedRole) return { ok: false, message: "배역명을 입력해 주세요." };
  if (!trimmedActor) return { ok: false, message: "배우명을 입력해 주세요." };

  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();
  let result: CorrectionResult;

  try {
    result = await runCorrection(admin, requester, "add_casting", {
      p_show_id: showId,
      p_slot_id: slotId,
      p_all_slots: applyToAllSlots,
      p_role: trimmedRole,
      p_actor: trimmedActor,
      p_actor_id: await upsertActorId(admin, trimmedActor),
    });
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, count: result.count ?? 0 };
}

export async function deleteSlotCasting({
  showId,
  slotId,
  role,
  actor,
  applyToAllSlots,
}: {
  showId: string;
  slotId: number;
  role: string;
  actor: string;
  applyToAllSlots: boolean;
}): Promise<CorrectCastingResult> {
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();
  let result: CorrectionResult;

  try {
    result = await runCorrection(admin, requester, "delete_casting", {
      p_show_id: showId,
      p_slot_id: slotId,
      p_all_slots: applyToAllSlots,
      p_role: role,
      p_actor: actor,
    });
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
  }

  if (result.upload_id !== undefined) {
    await deleteUploadIfEmpty(admin, result.upload_id, requester);
  }

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, count: result.count ?? 0 };
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

  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();
  let result: CorrectionResult;

  try {
    result = await runCorrection(admin, requester, "move_slot_casting", {
      p_show_id: showId,
      p_slot_id: slotId,
      p_date: newDate,
      p_time: newTime,
    });
  } catch (error) {
    console.error(error);

    if (isDuplicateKey(error)) {
      return { ok: false, message: "이미 그 날짜/시간에 같은 배역이 있어요." };
    }

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: false };
}

async function getCurrentUploadId(
  admin: ReturnType<typeof createAdminClient>,
  slotId: number,
) {
  const { data, error } = await admin
    .from("current_castings")
    .select("upload_id")
    .eq("slot_id", slotId)
    .maybeSingle();

  if (error) throw error;

  return (data?.upload_id as number | undefined) ?? null;
}

// 지금 보이는 캐스팅보드의 회차 구분(EPISODE 등)을 고치거나 새로 단다
export async function correctSlotVariant(
  showId: string,
  slotId: number,
  variant: string,
): Promise<ReportResult> {
  const label = variant.trim().replace(/\s+/g, " ");

  if (!label) return { ok: false, message: "회차 구분을 입력해 주세요." };

  if (label.length > SLOT_VARIANT_MAX_LENGTH) {
    return {
      ok: false,
      message: `회차 구분은 ${SLOT_VARIANT_MAX_LENGTH}자까지 쓸 수 있어요.`,
    };
  }

  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();
  let result: CorrectionResult;

  try {
    result = await runCorrection(admin, requester, "set_slot_variant", {
      p_show_id: showId,
      p_slot_id: slotId,
      p_label: label,
    });
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
  }

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));

  return { ok: true, hidden: false };
}

export async function deleteSlotVariant(
  showId: string,
  slotId: number,
): Promise<ReportResult> {
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

  const admin = createAdminClient();

  try {
    const uploadId = await getCurrentUploadId(admin, slotId);

    if (!uploadId) return { ok: false, message: "회차 정보를 찾을 수 없어요." };

    const { data: upload, error: uploadError } = await admin
      .from("uploads")
      .select("user_id")
      .eq("id", uploadId)
      .single();

    if (uploadError) throw uploadError;

    if (!(await canManageUpload(requester, upload.user_id))) {
      return {
        ok: false,
        message: "본인이 올린 회차의 구분만 지울 수 있어요.",
      };
    }

    const { error } = await admin
      .from("slot_variants")
      .delete()
      .eq("upload_id", uploadId)
      .eq("slot_id", slotId);

    if (error) throw error;
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

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
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

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

  if (!upload) return { ok: false, message: "회차 정보를 찾을 수 없어요." };

  if (!(await canManageUpload(requester, upload.user_id))) {
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

  const { error: variantError } = await admin
    .from("slot_variants")
    .delete()
    .eq("upload_id", uploadId)
    .eq("slot_id", slotId);

  if (variantError) console.error(variantError);

  await deleteUploadIfEmpty(admin, uploadId, requester);

  revalidatePath(`/show/${showId}`);
  updateTag(showCastTag(showId));
  updateTag(CASTING_FEED_CACHE_TAG);

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
  updateTag(CASTING_FEED_CACHE_TAG);

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
  updateTag(CASTING_FEED_CACHE_TAG);

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

export async function getShowSlotTimes(
  showId: string,
): Promise<EventSlotException[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slots")
    .select("date, time")
    .eq("show_id", showId)
    .is("cancelled_at", null)
    .order("date")
    .order("time");

  if (error) throw error;

  return (data as EventSlotException[]).map(({ date, time }) => ({
    date,
    time: time.slice(0, 5),
  }));
}

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
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

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
  let result: CorrectionResult;

  try {
    // 기간 + 막대 밖 포함/제외 회차를 반영해 적용되는 회차를 다시 계산한다
    const matchedSlotIds = await computeEventSlotIds(admin, showId, {
      periodStart,
      periodEnd,
      includedSlots: sanitizeSlotExceptions(includedSlots),
      excludedSlots: sanitizeSlotExceptions(excludedSlots),
    });

    result = await runCorrection(admin, requester, "update_event_text", {
      p_show_id: showId,
      p_event_id: eventId,
      p_title: trimmedTitle,
      p_description: description.trim() || null,
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_slot_ids: matchedSlotIds,
    });
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (result.status !== "ok") {
    return { ok: false, message: CORRECTION_FAILURE_MESSAGE[result.status] };
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
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

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

  if (!upload) return { ok: false, message: "이벤트를 찾을 수 없어요." };

  if (!(await canManageUpload(requester, upload.user_id))) {
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

  await deleteUploadIfEmpty(admin, event.upload_id, requester);

  revalidatePath(`/show/${showId}`);
  updateTag(CASTING_FEED_CACHE_TAG);

  return { ok: true, hidden: false };
}

export async function deleteMyUpload(
  showId: string,
  uploadId: number,
): Promise<ReportResult> {
  const requester = await getRequester();

  if (!requester) return { ok: false, message: "로그인이 필요해요." };

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

  if (!upload || !(await canManageUpload(requester, upload.user_id))) {
    return { ok: false, message: "본인이 올린 캐스팅보드만 지울 수 있어요." };
  }

  const [{ data: assignments }, { data: images }] = await Promise.all([
    admin.from("assignments").select("slot_id").eq("upload_id", uploadId),
    admin
      .from("upload_images")
      .select("storage_path")
      .eq("upload_id", uploadId),
  ]);

  const slotIds = [
    ...new Set((assignments ?? []).map(({ slot_id }) => slot_id)),
  ];
  const storagePaths = (images ?? []).map(({ storage_path }) => storage_path);

  const { error: deleteError } = await admin
    .from("uploads")
    .delete()
    .eq("id", uploadId);

  if (deleteError) {
    console.error(deleteError);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }

  if (slotIds.length > 0) {
    const { data: remaining } = await admin
      .from("assignments")
      .select("slot_id")
      .in("slot_id", slotIds);

    const stillUsed = new Set((remaining ?? []).map(({ slot_id }) => slot_id));
    const emptySlotIds = slotIds.filter((id) => !stillUsed.has(id));

    if (emptySlotIds.length > 0) {
      const { error: slotDeleteError } = await admin
        .from("slots")
        .delete()
        .in("id", emptySlotIds);

      if (slotDeleteError) console.error("빈 회차 정리 실패", slotDeleteError);
    }
  }

  if (storagePaths.length > 0) {
    const { error: storageError } = await admin.storage
      .from(CASTING_BOARD_BUCKET)
      .remove(storagePaths);

    if (storageError) console.error("원본 이미지 정리 실패", storageError);
  }

  revalidatePath(`/show/${showId}`);
  revalidatePath("/mypage/uploads");
  updateTag(showCastTag(showId));
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

export type SubmitManualCastingResult =
  { ok: true; slotCount: number } | { ok: false; message: string };

export async function submitManualCasting(
  showId: string,
  slots: EventSlotException[],
  casting: ManualCastingRole[],
): Promise<SubmitManualCastingResult> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const userId = data?.claims?.sub;

  if (!userId) return { ok: false, message: "로그인이 필요해요." };

  const validSlots = slots.filter(
    ({ date, time }) => ISO_DATE.test(date) && TIME.test(time),
  );

  if (validSlots.length === 0) {
    return { ok: false, message: "회차(날짜/시간)를 입력해 주세요." };
  }

  const validCasting = casting.filter(
    ({ role, actor }) => role.trim() && actor.trim(),
  );

  if (validCasting.length === 0) {
    return { ok: false, message: "배역/배우를 최소 1개 입력해 주세요." };
  }

  try {
    const { slotCount } = await saveManualCasting({
      showId,
      userId,
      slots: validSlots,
      casting: validCasting,
    });

    revalidatePath(`/show/${showId}`);
    updateTag(showCastTag(showId));
    updateTag(CASTING_FEED_CACHE_TAG);

    return { ok: true, slotCount };
  } catch (error) {
    console.error(error);

    return { ok: false, message: "잠시 후 다시 시도해 주세요." };
  }
}
