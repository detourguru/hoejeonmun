import type { EventSlotException } from "@/type/casting";

type Slot = { date: string; time: string };

export type SlotRules = {
  excludedSlots: EventSlotException[];
  exactTimes?: string[];
  listedSlots?: EventSlotException[];
  periodStart: string;
  periodEnd: string;
  periodStartCutoffTime?: string;
  periodEndCutoffTime?: string;
};

export const slotKey = (slot: Slot) => `${slot.date} ${slot.time}`;

export function createSlotChecker({
  excludedSlots,
  exactTimes,
  listedSlots,
  periodStart,
  periodEnd,
  periodStartCutoffTime,
  periodEndCutoffTime,
}: SlotRules): (slot: Slot) => boolean {
  const excludedKeys = new Set(excludedSlots.map(slotKey));
  const exactTimeSet = exactTimes?.length ? new Set(exactTimes) : null;
  const listedKeys = listedSlots?.length
    ? new Set(listedSlots.map(slotKey))
    : null;

  return (slot) =>
    !excludedKeys.has(slotKey(slot)) &&
    (!exactTimeSet || exactTimeSet.has(slot.time)) &&
    (!listedKeys || listedKeys.has(slotKey(slot))) &&
    (!periodStartCutoffTime ||
      slot.date !== periodStart ||
      slot.time >= periodStartCutoffTime) &&
    (!periodEndCutoffTime ||
      slot.date !== periodEnd ||
      slot.time <= periodEndCutoffTime);
}

export function toggleExcludedSlot(
  slots: Slot[],
  isChecked: (slot: Slot) => boolean,
  target: Slot,
): EventSlotException[] {
  const nextExcluded = new Set(
    slots.filter((slot) => !isChecked(slot)).map(slotKey),
  );
  const key = slotKey(target);

  if (nextExcluded.has(key)) nextExcluded.delete(key);
  else nextExcluded.add(key);

  return slots
    .filter((slot) => nextExcluded.has(slotKey(slot)))
    .map(({ date, time }) => ({ date, time }));
}

// periodStart~periodEnd 중 공연이 없는 날
export function datesWithoutSchedule(
  periodStart: string,
  periodEnd: string,
  knownDates: Set<string>,
): string[] {
  if (!periodStart || !periodEnd || periodStart > periodEnd) return [];

  const missing: string[] = [];
  let cursor = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);

    if (!knownDates.has(iso)) missing.push(iso);

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return missing;
}

export function slotsWithinPeriod(
  periodStart: string,
  periodEnd: string,
  knownSlots: Slot[],
): Slot[] {
  return knownSlots
    .filter(({ date }) => date >= periodStart && date <= periodEnd)
    .sort(
      (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time),
    );
}
