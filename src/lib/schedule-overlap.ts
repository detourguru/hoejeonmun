import { DEFAULT_RUNTIME_MINUTES } from "@/lib/runtime";

export type ScheduleOverlapSlot = {
  id: number;
  // YYYY-MM-DD
  date: string;
  // HH:mm 또는 HH:mm:ss (앞 두 자리만 사용)
  time: string;
  showId: string;
};

const toMinutes = (time: string) => {
  const [h, m] = time.split(":");

  return Number(h) * 60 + Number(m);
};

export function findOverlappingSlotIds(
  slots: ScheduleOverlapSlot[],
  runtimeByShowId: Record<string, number | null | undefined>,
  fallbackMinutes = DEFAULT_RUNTIME_MINUTES,
): Set<number> {
  const overlapping = new Set<number>();

  const byDate = new Map<string, ScheduleOverlapSlot[]>();

  for (const slot of slots) {
    const list = byDate.get(slot.date);

    if (list) list.push(slot);
    else byDate.set(slot.date, [slot]);
  }

  for (const daySlots of byDate.values()) {
    const ranges = daySlots
      .map((slot) => {
        const start = toMinutes(slot.time);
        const runtime = runtimeByShowId[slot.showId] ?? fallbackMinutes;

        return { id: slot.id, start, end: start + runtime };
      })
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < ranges.length; i++) {
      for (let j = i + 1; j < ranges.length; j++) {
        if (ranges[j].start >= ranges[i].end) break;

        overlapping.add(ranges[i].id);
        overlapping.add(ranges[j].id);
      }
    }
  }

  return overlapping;
}
