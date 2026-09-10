import "server-only";

import { normalizeActorName } from "@/lib/actor-name";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlaceholderActorName } from "@/service/casting-board";
import { EventSlotException } from "@/type/casting";

export type ManualCastingRole = { role: string; actor: string };

export type ManualPerformanceInput = {
  slots: EventSlotException[];
  casting: ManualCastingRole[];
};

const slotKey = (date: string, time: string) => `${date} ${time.slice(0, 5)}`;

export async function saveManualCasting({
  showId,
  userId,
  slots: slotInputs,
  casting,
}: {
  showId: string;
  userId: string;
} & ManualPerformanceInput): Promise<{ slotCount: number }> {
  const admin = createAdminClient();

  const validCasting = casting
    .map(({ role, actor }) => ({ role: role.trim(), actor: actor.trim() }))
    .filter(
      ({ role, actor }) => role && actor && !isPlaceholderActorName(actor),
    );

  if (validCasting.length === 0) {
    throw new Error("배역/배우를 최소 1개 입력해 주세요.");
  }

  const dedupedSlots = [
    ...new Map(
      slotInputs.map((slot) => [slotKey(slot.date, slot.time), slot]),
    ).values(),
  ];

  if (dedupedSlots.length === 0) {
    throw new Error("회차를 최소 1개 입력해 주세요.");
  }

  const { data: upload, error: uploadError } = await admin
    .from("uploads")
    .insert({ show_id: showId, user_id: userId, source: "user" })
    .select("id")
    .single();

  if (uploadError) throw uploadError;

  const { error: slotError } = await admin.from("slots").upsert(
    dedupedSlots.map(({ date, time }) => ({ show_id: showId, date, time })),
    { onConflict: "show_id,date,time", ignoreDuplicates: true },
  );

  if (slotError) throw slotError;

  const dates = dedupedSlots.map(({ date }) => date).sort();

  const { data: slots, error: slotSelectError } = await admin
    .from("slots")
    .select("id, date, time")
    .eq("show_id", showId)
    .gte("date", dates[0])
    .lte("date", dates[dates.length - 1]);

  if (slotSelectError) throw slotSelectError;

  const slotIdByKey = new Map(
    (slots as { id: number; date: string; time: string }[]).map(
      ({ id, date, time }) => [slotKey(date, time), id],
    ),
  );

  const actorNames = [
    ...new Set(validCasting.map(({ actor }) => normalizeActorName(actor))),
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

  const actorIdByName = new Map(
    (actors as { id: number; name: string }[]).map(({ id, name }) => [
      name,
      id,
    ]),
  );

  const assignments = dedupedSlots.flatMap(({ date, time }) => {
    const slotId = slotIdByKey.get(slotKey(date, time));

    if (!slotId) return [];

    return validCasting.map(({ role, actor }) => ({
      upload_id: upload.id,
      slot_id: slotId,
      role_name_raw: role,
      actor_name_raw: actor,
      actor_id: actorIdByName.get(normalizeActorName(actor)) ?? null,
      upload_image_id: null,
    }));
  });

  const { error: assignmentError } = await admin
    .from("assignments")
    .upsert(assignments, {
      onConflict: "upload_id,slot_id,role_name_raw,actor_name_raw",
      ignoreDuplicates: true,
    });

  if (assignmentError) throw assignmentError;

  return { slotCount: dedupedSlots.length };
}
