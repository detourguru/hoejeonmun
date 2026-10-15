import { normalizeActorName } from "@/lib/actor-name";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  CastingNotices,
  ConfirmedEvent,
  EventSource,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedPerformance,
  SkippedPerformance,
  SLOT_VARIANT_MAX_LENGTH,
} from "@/type/casting";

import { hashImages } from "./duplicate";
import {
  createEventGroupResolver,
  EventSlotRules,
  isExactSameEvent,
  isPlaceholderActorName,
  selectEventSlotIds,
  slotKey,
} from "./normalize";
import {
  buildCastingChangeTargets,
  CastingChangeTarget,
  matchCancelledEventIds,
  matchCancelledSlotIds,
} from "./notice-targets";

export async function hashStoragePaths(
  admin: ReturnType<typeof createAdminClient>,
  storagePaths: string[],
): Promise<string[]> {
  const downloads = await Promise.all(
    storagePaths.map((path) =>
      admin.storage.from(CASTING_BOARD_BUCKET).download(path),
    ),
  );

  if (downloads.some(({ data, error }) => error || !data)) {
    throw new Error("업로드된 이미지를 찾을 수 없어요.");
  }

  return hashImages(downloads.map(({ data }) => data!));
}
type EventRow = {
  group_id: number;
  show_id: string;
  upload_id: number;
  upload_image_id: number;
  title: string;
  description: string | null;
  period_start: string;
  period_end: string;
  sparse_dates: boolean;
  source: EventSource;
  edited_by: string | null;
};

// PostgreSQL 에러 코드: unique_violation
const DUPLICATE_KEY = "23505";

export async function createEventGroup(
  admin: ReturnType<typeof createAdminClient>,
) {
  const { data, error } = await admin
    .from("event_groups")
    .insert({})
    .select("id")
    .single();

  if (error) throw error;

  return data.id as number;
}

export async function insertEvent(
  admin: ReturnType<typeof createAdminClient>,
  row: EventRow,
) {
  const { error, data } = await admin
    .from("events")
    .insert(row)
    .select("id")
    .single();

  if (!error) return data.id;
  if (error.code !== DUPLICATE_KEY) throw error;

  const { data: existing, error: existingError } = await admin
    .from("events")
    .select("id")
    .eq("group_id", row.group_id)
    .eq("upload_id", row.upload_id)
    .eq("period_start", row.period_start)
    .eq("period_end", row.period_end)
    .maybeSingle();

  if (existingError) throw existingError;

  return existing?.id;
}

// 이벤트가 실제로 적용되는 회차 id 목록을 기간 + 막대 외 포함/제외 회차로 계산한다.
// 새로 저장할 때와 정정 제안으로 다시 계산할 때 모두 이 로직을 그대로 써야 한다
export async function computeEventSlotIds(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  rules: EventSlotRules,
): Promise<number[]> {
  const { periodStart, periodEnd, includedSlots = [] } = rules;

  const { data: periodSlots, error: periodSlotsErr } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .is("cancelled_at", null);

  if (periodSlotsErr) throw periodSlotsErr;

  if (includedSlots.length === 0) {
    return selectEventSlotIds(periodSlots, [], rules);
  }

  const { data: extraSlots, error: extraSlotsErr } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .in("date", [...new Set(includedSlots.map(({ date }) => date))])
    .is("cancelled_at", null);

  if (extraSlotsErr) throw extraSlotsErr;

  return selectEventSlotIds(periodSlots, extraSlots, rules);
}

async function resolveCancelledSlotIds(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledSlots: ParsedCancelledSlot[],
): Promise<number[]> {
  if (cancelledSlots.length === 0) return [];

  const { data, error } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .in("date", [...new Set(cancelledSlots.map(({ date }) => date))])
    .is("cancelled_at", null);

  if (error) throw error;

  return matchCancelledSlotIds(
    data as { id: number; date: string; time: string }[],
    cancelledSlots,
  );
}

async function resolveCastingChangeTargets(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  castingChanges: ParsedCastingChange[],
): Promise<CastingChangeTarget[]> {
  if (castingChanges.length === 0) return [];

  const { data: slots, error: slotsError } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .in("date", [...new Set(castingChanges.map(({ date }) => date))])
    .is("cancelled_at", null);

  if (slotsError) throw slotsError;

  const slotRows = slots as { id: number; date: string; time: string }[];
  const slotIds = slotRows.map(({ id }) => id);

  const { data: castings, error: castingsError } =
    slotIds.length > 0
      ? await admin
          .from("current_castings")
          .select("slot_id, upload_id")
          .in("slot_id", slotIds)
      : { data: [] as { slot_id: number; upload_id: number }[], error: null };

  if (castingsError) throw castingsError;

  const actorNames = [
    ...new Set(castingChanges.map(({ actor }) => normalizeActorName(actor))),
  ];

  const { error: actorUpsertError } = await admin.from("actors").upsert(
    actorNames.map((name) => ({ name })),
    { onConflict: "name", ignoreDuplicates: false },
  );

  if (actorUpsertError) throw actorUpsertError;

  const { data: actors, error: actorSelectError } = await admin
    .from("actors")
    .select("id, name")
    .in("name", actorNames);

  if (actorSelectError) throw actorSelectError;

  return buildCastingChangeTargets(castingChanges, {
    slots: slotRows,
    uploadIdBySlotId: new Map(
      (castings as { slot_id: number; upload_id: number }[]).map(
        ({ slot_id, upload_id }) => [slot_id, upload_id],
      ),
    ),
    actorIdByName: new Map(
      (actors as { id: number; name: string }[]).map(({ id, name }) => [
        name,
        id,
      ]),
    ),
  });
}

async function resolveCancelledEventIds(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledEvents: ParsedCancelledEvent[],
): Promise<number[]> {
  if (cancelledEvents.length === 0) return [];

  const from = cancelledEvents.map(({ periodStart }) => periodStart).sort()[0];
  const to = cancelledEvents
    .map(({ periodEnd }) => periodEnd)
    .sort()
    .at(-1)!;

  const { data, error } = await admin
    .from("current_events")
    .select("id, title_key, period_start, period_end")
    .eq("show_id", showId)
    .lte("period_start", to)
    .gte("period_end", from);

  if (error) throw error;

  return matchCancelledEventIds(
    data as {
      id: number;
      title_key: string;
      period_start: string;
      period_end: string;
    }[],
    cancelledEvents,
  );
}

export async function applyCastingNotices(
  admin: ReturnType<typeof createAdminClient>,
  {
    uploadId,
    showId,
    notices,
  }: { uploadId: number; showId: string; notices: CastingNotices },
) {
  const [slotIds, eventIds, castingChanges] = await Promise.all([
    resolveCancelledSlotIds(admin, showId, notices.cancelledSlots),
    resolveCancelledEventIds(admin, showId, notices.cancelledEvents),
    resolveCastingChangeTargets(admin, showId, notices.castingChanges),
  ]);

  if (
    slotIds.length === 0 &&
    eventIds.length === 0 &&
    castingChanges.length === 0
  ) {
    return {
      cancelledSlotCount: 0,
      castingChangeCount: 0,
      cancelledEventCount: 0,
    };
  }

  const { data, error } = await admin.rpc("apply_casting_notices", {
    p_upload_id: uploadId,
    p_slot_ids: slotIds,
    p_event_ids: eventIds,
    p_casting_changes: castingChanges,
  });

  if (error) throw error;

  const counts = data as {
    cancelled_slots: number;
    casting_changes: number;
    cancelled_events: number;
  };

  return {
    cancelledSlotCount: counts.cancelled_slots,
    castingChangeCount: counts.casting_changes,
    cancelledEventCount: counts.cancelled_events,
  };
}

export async function saveCastingBoard({
  showId,
  userId,
  storagePaths,
  performances,
  events,
  skipped,
  cancelledSlots = [],
  castingChanges = [],
  cancelledEvents = [],
  source = "user",
}: {
  showId: string;
  userId: string;
  storagePaths: string[];
  performances: ParsedPerformance[];
  events: ConfirmedEvent[];
  skipped: SkippedPerformance[];
  cancelledSlots?: ParsedCancelledSlot[];
  castingChanges?: ParsedCastingChange[];
  cancelledEvents?: ParsedCancelledEvent[];
  source?: "user" | "system";
}): Promise<CastingBoardResult> {
  const admin = createAdminClient();

  const imageHashes = await hashStoragePaths(admin, storagePaths);

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId, source })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  try {
    return await saveCastingBoardContent({
      admin,
      showId,
      userId,
      storagePaths,
      imageHashes,
      performances,
      events,
      skipped,
      cancelledSlots,
      castingChanges,
      cancelledEvents,
      upload,
    });
  } catch (error) {
    const { error: cleanupError } = await admin
      .from("uploads")
      .delete()
      .eq("id", upload.id);

    if (cleanupError) console.error("업로드 정리 실패", cleanupError);

    throw error;
  }
}

export async function saveCastingBoardContent({
  admin,
  showId,
  userId,
  storagePaths,
  imageHashes,
  performances: rawPerformances,
  events,
  skipped,
  cancelledSlots,
  castingChanges,
  cancelledEvents,
  upload,
}: {
  admin: ReturnType<typeof createAdminClient>;
  showId: string;
  userId: string;
  storagePaths: string[];
  imageHashes: string[];
  performances: ParsedPerformance[];
  events: ConfirmedEvent[];
  skipped: SkippedPerformance[];
  cancelledSlots: ParsedCancelledSlot[];
  castingChanges: ParsedCastingChange[];
  cancelledEvents: ParsedCancelledEvent[];
  upload: { id: number };
}): Promise<CastingBoardResult> {
  const { data: uploadImages, error: uploadImagesError } = await admin
    .from("upload_images")
    .insert(
      storagePaths.map((storagePath, position) => ({
        upload_id: upload.id,
        show_id: showId,
        image_hash: imageHashes[position],
        storage_path: storagePath,
        position,
      })),
    )
    .select("id, position");

  if (uploadImagesError) {
    if (uploadImagesError.code === DUPLICATE_KEY)
      throw new Error("이미 등록된 캐스팅보드예요.");

    throw uploadImagesError;
  }

  const uploadImageIdByPosition = new Map(
    uploadImages.map(({ id, position }) => [position, id]),
  );

  // 이벤트 안내만 있고 캐스팅표는 없는 업로드일 수 있다
  let actorNames: string[] = [];

  const performances = rawPerformances
    .map((performance) => ({
      ...performance,
      casting: Object.fromEntries(
        Object.entries(performance.casting)
          .map(
            ([role, actors]) =>
              [
                role,
                actors.filter((actor) => !isPlaceholderActorName(actor)),
              ] as const,
          )
          .filter(([, actors]) => actors.length > 0),
      ),
    }))
    .filter((performance) => Object.keys(performance.casting).length > 0);

  if (performances.length > 0) {
    const dates = performances.map(({ date }) => date).sort();

    const { error: slotError } = await admin.from("slots").upsert(
      performances.map(({ date, time }) => ({ show_id: showId, date, time })),
      { onConflict: "show_id,date,time", ignoreDuplicates: true },
    );

    if (slotError) throw slotError;

    const { data: slots, error: slotSelectError } = await admin
      .from("slots")
      .select("id, date, time")
      .eq("show_id", showId)
      .gte("date", dates[0])
      .lte("date", dates[dates.length - 1]);

    if (slotSelectError) throw slotSelectError;

    const slotIdByKey = new Map(
      slots.map(({ id, date, time }) => [slotKey(date, time), id]),
    );

    actorNames = [
      ...new Set(
        performances
          .flatMap(({ casting }) => Object.values(casting).flat())
          .map(normalizeActorName),
      ),
    ];

    const { error: actorError } = await admin.from("actors").upsert(
      actorNames.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: true },
    );

    if (actorError) throw actorError;

    const { data: actors, error: actorSelectError } = await admin
      .from("actors")
      .select("id, name")
      .in("name", actorNames);

    if (actorSelectError) throw actorSelectError;

    const actorIdByName = new Map(actors.map(({ id, name }) => [name, id]));

    const assignments = performances.flatMap(
      ({ date, time, casting, imageIndex }) => {
        const slotId = slotIdByKey.get(slotKey(date, time));
        const uploadImageId = uploadImageIdByPosition.get(imageIndex);

        if (!slotId || uploadImageId === undefined) return [];

        return Object.entries(casting).flatMap(([role, actors], roleOrder) =>
          actors.map((actor) => ({
            upload_id: upload.id,
            slot_id: slotId,
            role_name_raw: role,
            actor_name_raw: actor,
            actor_id: actorIdByName.get(normalizeActorName(actor)) ?? null,
            upload_image_id: uploadImageId,
            role_order: roleOrder,
          })),
        );
      },
    );

    const { error: assignmentError } = await admin
      .from("assignments")
      .upsert(assignments, {
        onConflict: "upload_id,slot_id,role_name_raw,actor_name_raw",
        ignoreDuplicates: true,
      });

    if (assignmentError) throw assignmentError;

    const variants = performances.flatMap(({ date, time, variant }) => {
      const slotId = slotIdByKey.get(slotKey(date, time));
      const label = variant?.trim().slice(0, SLOT_VARIANT_MAX_LENGTH);

      return slotId && label
        ? [{ upload_id: upload.id, slot_id: slotId, label }]
        : [];
    });

    if (variants.length > 0) {
      const { error: variantError } = await admin
        .from("slot_variants")
        .upsert(variants, {
          onConflict: "upload_id,slot_id",
          ignoreDuplicates: true,
        });

      if (variantError) throw variantError;
    }
  }

  const resolveGroupId = createEventGroupResolver(() =>
    createEventGroup(admin),
  );

  async function saveEvent(event: ConfirmedEvent): Promise<boolean> {
    const uploadImageId = uploadImageIdByPosition.get(event.imageIndex);

    if (uploadImageId === undefined) return false;

    const selectedReplacement =
      event.replacesGroupId !== undefined &&
      event.overlapping.some(
        ({ groupId: candidateId }) => candidateId === event.replacesGroupId,
      )
        ? event.replacesGroupId
        : undefined;
    const exactMatch = event.overlapping.find((candidate) =>
      isExactSameEvent(event, candidate),
    );

    const groupId = await resolveGroupId(
      event,
      selectedReplacement ?? exactMatch?.groupId,
    );

    const row: EventRow = {
      group_id: groupId,
      show_id: showId,
      upload_id: upload.id,
      upload_image_id: uploadImageId,
      title: event.title,
      description: event.description ?? null,
      period_start: event.periodStart,
      period_end: event.periodEnd,
      sparse_dates: (event.listedSlots?.length ?? 0) > 0,
      source: event.source,
      edited_by: event.edited ? userId : null,
    };

    const eventId = await insertEvent(admin, row);

    if (!eventId) return false;

    const matchedSlotIds = await computeEventSlotIds(admin, showId, {
      periodStart: event.periodStart,
      periodEnd: event.periodEnd,
      includedSlots: event.includedSlots,
      excludedSlots: event.excludedSlots,
      exactTimes: event.exactTimes,
      listedSlots: event.listedSlots,
      periodStartCutoffTime: event.periodStartCutoffTime,
      periodEndCutoffTime: event.periodEndCutoffTime,
    });

    const eventSlots = matchedSlotIds.map((slotId) => ({
      event_id: eventId,
      slot_id: slotId,
    }));

    const { error: eventSlotsErr } = await admin
      .from("event_slots")
      .upsert(eventSlots, {
        onConflict: "event_id,slot_id",
        ignoreDuplicates: true,
      });

    if (eventSlotsErr) throw eventSlotsErr;

    return true;
  }

  const [savedEvents, noticeCounts] = await Promise.all([
    Promise.all(events.map((event) => saveEvent(event))),
    applyCastingNotices(admin, {
      uploadId: upload.id,
      showId,
      notices: { cancelledSlots, castingChanges, cancelledEvents },
    }),
  ]);

  const eventCount = savedEvents.filter(Boolean).length;

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    eventCount,
    skippedCount: skipped.length,
    skipped,
    ...noticeCounts,
  };
}
