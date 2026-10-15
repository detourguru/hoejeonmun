import { normalizeActorName } from "@/lib/actor-name";
import {
  ParsedCancelledEvent,
  ParsedCancelledSlot,
  ParsedCastingChange,
} from "@/type/casting";

import { slotKey, toTitleKey } from "./normalize";

type SlotRow = { id: number; date: string; time: string };

type EventCandidate = {
  id: number;
  title_key: string;
  period_start: string;
  period_end: string;
};

export type CastingChangeTarget = {
  slot_id: number;
  upload_id: number;
  role: string;
  actor: string;
  actor_id: number;
};

export const matchCancelledSlotIds = (
  slots: SlotRow[],
  cancelledSlots: ParsedCancelledSlot[],
) => {
  const keys = new Set(
    cancelledSlots.map(({ date, time }) => slotKey(date, time)),
  );

  return slots
    .filter(({ date, time }) => keys.has(slotKey(date, time)))
    .map(({ id }) => id);
};

export const matchCancelledEventIds = (
  candidates: EventCandidate[],
  cancelledEvents: ParsedCancelledEvent[],
) =>
  cancelledEvents.flatMap((cancelled) => {
    const key = toTitleKey(cancelled.title);

    const match = candidates.find(
      (candidate) =>
        candidate.title_key === key &&
        candidate.period_start <= cancelled.periodEnd &&
        cancelled.periodStart <= candidate.period_end,
    );

    return match ? [match.id] : [];
  });

export const buildCastingChangeTargets = (
  changes: ParsedCastingChange[],
  {
    slots,
    uploadIdBySlotId,
    actorIdByName,
  }: {
    slots: SlotRow[];
    uploadIdBySlotId: Map<number, number>;
    actorIdByName: Map<string, number>;
  },
): CastingChangeTarget[] => {
  const slotIdByKey = new Map(
    slots.map(({ id, date, time }) => [slotKey(date, time), id]),
  );

  return changes.flatMap(({ date, time, role, actor }) => {
    const slotId = slotIdByKey.get(slotKey(date, time));
    const uploadId =
      slotId === undefined ? undefined : uploadIdBySlotId.get(slotId);
    const actorId = actorIdByName.get(normalizeActorName(actor));

    if (
      slotId === undefined ||
      uploadId === undefined ||
      actorId === undefined
    ) {
      return [];
    }

    return [
      { slot_id: slotId, upload_id: uploadId, role, actor, actor_id: actorId },
    ];
  });
};
