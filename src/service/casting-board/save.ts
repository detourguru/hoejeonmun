import { normalizeActorName } from "@/lib/actor-name";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CASTING_BOARD_BUCKET,
  CastingBoardResult,
  ConfirmedEvent,
  EventSlotException,
  EventSource,
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
  ParsedPerformance,
  SkippedPerformance,
} from "@/type/casting";

import { hashImages } from "./duplicate";
import {
  isExactSameEvent,
  isPlaceholderActorName,
  slotKey,
  toTitleKey,
} from "./normalize";

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

export async function createEventGroup(admin: ReturnType<typeof createAdminClient>) {
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
  {
    periodStart,
    periodEnd,
    includedSlots = [],
    excludedSlots = [],
    exactTimes,
    listedSlots = [],
    periodStartCutoffTime,
    periodEndCutoffTime,
  }: {
    periodStart: string;
    periodEnd: string;
    includedSlots?: EventSlotException[];
    excludedSlots?: EventSlotException[];
    exactTimes?: string[];
    listedSlots?: EventSlotException[];
    periodStartCutoffTime?: string;
    periodEndCutoffTime?: string;
  },
): Promise<number[]> {
  const { data: periodSlots, error: periodSlotsErr } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .is("cancelled_at", null);

  if (periodSlotsErr) throw periodSlotsErr;

  const excludedKeys = new Set(
    excludedSlots.map(({ date, time }) => slotKey(date, time)),
  );

  const exactTimeSet = exactTimes?.length
    ? new Set(exactTimes.map((time) => time.slice(0, 5)))
    : null;

  const listedKeys = listedSlots.length
    ? new Set(listedSlots.map(({ date, time }) => slotKey(date, time)))
    : null;

  const matchedSlotIds = new Set(
    periodSlots
      .filter(
        (slot) => !listedKeys || listedKeys.has(slotKey(slot.date, slot.time)),
      )
      .filter((slot) => !excludedKeys.has(slotKey(slot.date, slot.time)))
      .filter(
        (slot) => !exactTimeSet || exactTimeSet.has(slot.time.slice(0, 5)),
      )
      .filter(
        (slot) =>
          !periodStartCutoffTime ||
          slot.date !== periodStart ||
          slot.time.slice(0, 5) >= periodStartCutoffTime,
      )
      .filter(
        (slot) =>
          !periodEndCutoffTime ||
          slot.date !== periodEnd ||
          slot.time.slice(0, 5) <= periodEndCutoffTime,
      )
      .map(({ id }) => id),
  );

  if (includedSlots.length > 0) {
    const { data: extraSlots, error: extraSlotsErr } = await admin
      .from("slots")
      .select("id, date, time")
      .eq("show_id", showId)
      .in("date", [...new Set(includedSlots.map(({ date }) => date))])
      .is("cancelled_at", null);

    if (extraSlotsErr) throw extraSlotsErr;

    const includedKeys = new Set(
      includedSlots.map(({ date, time }) => slotKey(date, time)),
    );

    for (const slot of extraSlots) {
      if (includedKeys.has(slotKey(slot.date, slot.time))) {
        matchedSlotIds.add(slot.id);
      }
    }
  }

  return [...matchedSlotIds];
}

// 이미 등록된 회차를 취소 처리한다 (삭제하지 않고 cancelled_at만 채워 이력을 남긴다)
export async function applyCancelledSlots(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledSlots: ParsedCancelledSlot[],
): Promise<number> {
  if (cancelledSlots.length === 0) return 0;

  const dates = [...new Set(cancelledSlots.map(({ date }) => date))];

  const { data: slots, error: selectError } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .in("date", dates)
    .is("cancelled_at", null);

  if (selectError) throw selectError;

  const cancelledKeys = new Set(
    cancelledSlots.map(({ date, time }) => slotKey(date, time)),
  );
  const matchedIds = (slots as { id: number; date: string; time: string }[])
    .filter((slot) => cancelledKeys.has(slotKey(slot.date, slot.time)))
    .map(({ id }) => id);

  if (matchedIds.length === 0) return 0;

  const { error: updateError, count } = await admin
    .from("slots")
    .update({ cancelled_at: new Date().toISOString() }, { count: "exact" })
    .in("id", matchedIds);

  if (updateError) throw updateError;

  return count ?? 0;
}

// 배역 하나에 배우가 여럿(앙상블)인 경우, 이 함수는 옛 배우를 특정하지 않고
// role_name_raw만으로 매칭해 그 배역의 모든 배우를 새 배우 한 명으로 덮어쓴다.
// castingChanges는 "배역 하나 = 배우 하나" 교체 공지만 다루므로 앙상블 배역
// 캐스팅 변경 공지는 대상이 아니다
export async function applyCastingChanges(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  castingChanges: ParsedCastingChange[],
): Promise<number> {
  if (castingChanges.length === 0) return 0;

  const dates = [...new Set(castingChanges.map(({ date }) => date))];

  const { data: slots, error: slotsError } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .in("date", dates)
    .is("cancelled_at", null);

  if (slotsError) throw slotsError;

  const slotIdByKey = new Map(
    (slots as { id: number; date: string; time: string }[]).map(
      ({ id, date, time }) => [slotKey(date, time), id],
    ),
  );
  const slotIds = [...slotIdByKey.values()];

  const { data: castings, error: castingsError } =
    slotIds.length > 0
      ? await admin
          .from("current_castings")
          .select("slot_id, upload_id")
          .in("slot_id", slotIds)
      : { data: [] as { slot_id: number; upload_id: number }[], error: null };

  if (castingsError) throw castingsError;

  const uploadIdBySlotId = new Map(
    (castings as { slot_id: number; upload_id: number }[]).map(
      ({ slot_id, upload_id }) => [slot_id, upload_id],
    ),
  );

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

  const actorIdByName = new Map(
    (actors as { id: number; name: string }[]).map(({ id, name }) => [
      name,
      id,
    ]),
  );

  const updates = await Promise.all(
    castingChanges.map(({ date, time, role, actor }) => {
      const slotId = slotIdByKey.get(slotKey(date, time));
      const uploadId = slotId && uploadIdBySlotId.get(slotId);
      const actorId = actorIdByName.get(normalizeActorName(actor));

      if (!slotId || !uploadId || actorId === undefined) return 0;

      return admin
        .from("assignments")
        .update(
          { actor_name_raw: actor, actor_id: actorId, verified: false },
          { count: "exact" },
        )
        .eq("upload_id", uploadId)
        .eq("slot_id", slotId)
        .eq("role_name_raw", role)
        .then(({ error, count }) => {
          if (error) throw error;

          return count ?? 0;
        });
    }),
  );

  return updates.reduce((sum, updated) => sum + updated, 0);
}

export async function applyCancelledEvents(
  admin: ReturnType<typeof createAdminClient>,
  showId: string,
  cancelledEvents: ParsedCancelledEvent[],
): Promise<number> {
  if (cancelledEvents.length === 0) return 0;

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

  const candidates = data as {
    id: number;
    title_key: string;
    period_start: string;
    period_end: string;
  }[];

  const matchedIds = cancelledEvents.flatMap((cancelled) => {
    const key = toTitleKey(cancelled.title);

    const match = candidates.find(
      (candidate) =>
        candidate.title_key === key &&
        candidate.period_start <= cancelled.periodEnd &&
        cancelled.periodStart <= candidate.period_end,
    );

    return match ? [match.id] : [];
  });

  if (matchedIds.length === 0) return 0;

  const { error: updateError, count } = await admin
    .from("events")
    .update({ cancelled_at: new Date().toISOString() }, { count: "exact" })
    .in("id", matchedIds);

  if (updateError) throw updateError;

  return count ?? 0;
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
  }

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

    const groupId =
      selectedReplacement ??
      exactMatch?.groupId ??
      (await createEventGroup(admin));

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

  const [
    savedEvents,
    cancelledSlotCount,
    castingChangeCount,
    cancelledEventCount,
  ] = await Promise.all([
    Promise.all(events.map((event) => saveEvent(event))),
    applyCancelledSlots(admin, showId, cancelledSlots),
    applyCastingChanges(admin, showId, castingChanges),
    applyCancelledEvents(admin, showId, cancelledEvents),
  ]);

  const eventCount = savedEvents.filter(Boolean).length;

  return {
    uploadId: upload.id,
    slotCount: performances.length,
    actorCount: actorNames.length,
    eventCount,
    skippedCount: skipped.length,
    skipped,
    cancelledSlotCount,
    castingChangeCount,
    cancelledEventCount,
  };
}
